import { Inject, Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { Pool } from 'pg';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import generatePayload = require('promptpay-qr');
import * as QRCode from 'qrcode';
import { GenerateQRCodeDto } from '../dtos/generate-qr-code.dto';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import FormData from 'form-data';
import { SlipVerifyDto } from '../dtos/slip-verify.dto';
import { v4 as uuidv4 } from 'uuid';
import { CustomerPurchaseOrdersService } from 'src/customer-purchase-orders/provider/customer-purchase-orders.service';
import { TestPaymentDto } from '../dtos/test-payment.dto';

export interface VerificationResult {
  success: boolean;
  message: string;
  details?: {
    amount: number;
    sender_name: string;
    sender_bank: string;
    transaction_time: string;
    transaction_id: string;
  };
  error?: {
    code: string;
    expectedAmount?: number;
    actualAmount?: number;
    expectedAccount?: string;
    actualAccount?: string;
  };
}

interface SlipApiResponse {
  success: boolean;
  data: {
    success: boolean;
    message: string;
    language: string | null;
    transRef: string;
    sendingBank: string;
    receivingBank: string;
    transDate: string;
    transTime: string;
    transTimestamp: string;
    sender: {
      displayName: string;
      name: string | null;
      proxy: {
        type: string | null;
        value: string | null;
      };
      account: {
        type: string;
        value: string;
      };
    };
    receiver: {
      displayName: string;
      name: string | null;
      proxy: {
        type: string;
        value: string;
      };
      account: {
        type: string;
        value: string;
      };
    };
    amount: number;
    paidLocalAmount: number | null;
    paidLocalCurrency: string | null;
    countryCode: string;
    transFeeAmount: number | null;
    ref1: string;
    ref2: string;
    ref3: string;
    toMerchantId: string;
    qrcodeData: string;
  };
}

@Injectable()
export class PaymentService {
  private readonly promptpayMobileNumber: string;
  private readonly bankAccountName: string;
  private readonly slipokApiKey: string;
  private readonly slipokEndpoint: string;

  constructor(
    @Inject('PG_CONNECTION')
    private readonly db: Pool,
    private configService: ConfigService,

    private readonly customerPurchaseOrdersService: CustomerPurchaseOrdersService,
  ) {
    this.promptpayMobileNumber = this.configService.get<string>(
      'appConfig.promptpayMobileNumber',
    );
    this.slipokApiKey = this.configService.get<string>(
      'appConfig.slipokApiKey',
    );
    this.slipokEndpoint = this.configService.get<string>(
      'appConfig.slipokEndpoint',
    );
    this.bankAccountName = this.configService.get<string>(
      'appConfig.bankAccountName',
    );

    if (!this.promptpayMobileNumber) {
      throw new Error(
        'PROMPTPAY_MOBILE_NUMBER is not configured in environment',
      );
    }
  }

  public async generateQRCode(generateQRCodeDto: GenerateQRCodeDto) {
    const { amount } = generateQRCodeDto;
    try {
      const payload = generatePayload(this.promptpayMobileNumber, { amount });
      const qrCode = await QRCode.toDataURL(payload);
      return { qrCode };
    } catch (error) {
      throw new Error(`Failed to generate QR code: ${error.message}`);
    }
  }

  public async verifySlip(
    slipVerifyDto: SlipVerifyDto,
    file: Express.Multer.File,
  ): Promise<VerificationResult> {
    const { orderId, expectedAmount } = slipVerifyDto;
    try {
      const orderCreatedDate = await this.getOrderCreatedDate(orderId);

      const formData = new FormData();
      formData.append('files', file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype,
      });

      const response = await axios.post<SlipApiResponse>(
        this.slipokEndpoint,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'x-authorization': this.slipokApiKey,
          },
        },
      );

      const slipData = response.data.data;

      if (!slipData.success) {
        return {
          success: false,
          message: 'Invalid slip image',
          error: {
            code: 'INVALID_SLIP',
          },
        };
      }

      const transferDate = new Date(slipData.transTimestamp);
      if (transferDate < orderCreatedDate) {
        return {
          success: false,
          message: 'Transfer date is before order creation date',
          error: {
            code: 'INVALID_TRANSFER_DATE',
          },
          details: {
            amount: slipData.amount,
            sender_name: slipData.sender.displayName,
            sender_bank: this.getBankName(slipData.sendingBank),
            transaction_time: slipData.transTimestamp,
            transaction_id: slipData.transRef,
          },
        };
      }

      const now = new Date();
      const timeDifference = now.getTime() - transferDate.getTime();
      const hoursDifference = timeDifference / (1000 * 60 * 60);

      if (hoursDifference > 48) {
        return {
          success: false,
          message: 'Transfer is too old (more than 48 hours)',
          error: {
            code: 'TRANSFER_TOO_OLD',
          },
          details: {
            amount: slipData.amount,
            sender_name: slipData.sender.displayName,
            sender_bank: this.getBankName(slipData.sendingBank),
            transaction_time: slipData.transTimestamp,
            transaction_id: slipData.transRef,
          },
        };
      }

      if (slipData.amount !== expectedAmount) {
        return {
          success: false,
          message: 'Payment amount does not match order amount',
          error: {
            code: 'AMOUNT_MISMATCH',
            expectedAmount: expectedAmount,
            actualAmount: slipData.amount,
          },
          details: {
            amount: slipData.amount,
            sender_name: slipData.sender.displayName,
            sender_bank: this.getBankName(slipData.sendingBank),
            transaction_time: slipData.transTimestamp,
            transaction_id: slipData.transRef,
          },
        };
      }

      if (slipData.receiver.displayName !== this.bankAccountName) {
        return {
          success: false,
          message: 'Payment was sent to wrong account',
          error: {
            code: 'WRONG_ACCOUNT',
            expectedAccount: this.bankAccountName,
            actualAccount: slipData.receiver.displayName,
          },
          details: {
            amount: slipData.amount,
            sender_name: slipData.sender.displayName,
            sender_bank: this.getBankName(slipData.sendingBank),
            transaction_time: slipData.transTimestamp,
            transaction_id: slipData.transRef,
          },
        };
      }

      await this.savePaymentDetails(orderId, {
        amount: slipData.amount,
        transaction_id: slipData.transRef,
        transaction_time: slipData.transTimestamp,
      });

      return {
        success: true,
        message: 'Payment verified successfully',
        details: {
          amount: slipData.amount,
          sender_name: slipData.sender.displayName,
          sender_bank: this.getBankName(slipData.sendingBank),
          transaction_time: slipData.transTimestamp,
          transaction_id: slipData.transRef,
        },
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return {
          success: false,
          message: 'Failed to verify slip with external service',
          error: {
            code: 'API_ERROR',
          },
        };
      }

      console.error('Slip verification error:', error);
      return {
        success: false,
        message: 'An unexpected error occurred during verification',
        error: {
          code: 'INTERNAL_ERROR',
        },
      };
    }
  }

  private getBankName(bankCode: string): string {
    const bankMap: { [key: string]: string } = {
      '014': 'SCB',
      '004': 'KBANK',
      '002': 'BBL',
      '006': 'KTB',
      '011': 'TMB',
      '025': 'BAY',
      // ... add more banks as needed
    };
    return bankMap[bankCode] || bankCode;
  }

  private async savePaymentDetails(
    cpoId: string,
    paymentData: {
      amount: number;
      transaction_id: string;
      transaction_time: string;
    },
  ) {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      const transactionQuery = `
        INSERT INTO transactions (
          id,
          po_id,
          amount,
          create_date_time,
          payment_method,
          type
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `;

      const transactionValues = [
        paymentData.transaction_id,
        cpoId,
        paymentData.amount,
        paymentData.transaction_time,
        'qr',
        'cpo',
      ];

      const transactionResult = await client.query(
        transactionQuery,
        transactionValues,
      );

      const updateCPOQuery = `
        UPDATE customer_purchase_orders 
        SET 
          status = 'PAID',
          paid_date_time = $1
        WHERE id = $2
        RETURNING id
      `;

      await client.query(updateCPOQuery, [paymentData.transaction_time, cpoId]);

      await this.customerPurchaseOrdersService.checkAndCreateMaterialRequisitions(
        cpoId,
        client,
      );

      const historyQuery = `
        INSERT INTO history (
          id,
          cpo_id,
          status,
          date_time
        ) VALUES ($1, $2, $3, $4)
        RETURNING id
      `;

      await client.query(historyQuery, [uuidv4(), cpoId, 'PAID', new Date()]);

      const getOrderLinesQuery = `
        SELECT product_id, quantity 
        FROM order_lines 
        WHERE order_id = $1
      `;

      const orderLines = await client.query(getOrderLinesQuery, [cpoId]);

      if (orderLines.rows.length > 0) {
        const updateQueries = orderLines.rows.map(
          (line, index) =>
            `UPDATE products 
             SET sale = COALESCE(sale, 0) + $${index * 2 + 1}
             WHERE id = $${index * 2 + 2}`,
        );

        const updateSalesQuery = `
          ${updateQueries.join(';')}
        `;

        const updateSalesValues = orderLines.rows.flatMap((line) => [
          line.quantity,
          line.product_id,
        ]);

        await client.query(updateSalesQuery, updateSalesValues);
      }

      await client.query('COMMIT');

      return {
        success: true,
        transactionId: transactionResult.rows[0].id,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Database error:', error);
      throw new HttpException(
        'Failed to save payment details',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      client.release();
    }
  }

  private async getOrderCreatedDate(orderId: string): Promise<Date> {
    try {
      const query = `
        SELECT date_time 
        FROM history 
        WHERE cpo_id = $1 
        AND status = 'NEW' 
        ORDER BY date_time ASC 
        LIMIT 1
      `;

      const result = await this.db.query(query, [orderId]);

      if (!result.rows[0]) {
        throw new Error('Order creation date not found');
      }

      return new Date(result.rows[0].date_time);
    } catch (error) {
      console.error('Error getting order creation date:', error);
      throw new Error('Failed to get order creation date');
    }
  }

  public async testPayment(testPaymentDto: TestPaymentDto) {
    const client = await this.db.connect();
    try {
      const { cpoId, amount } = testPaymentDto;
      await client.query('BEGIN');

      const transactionQuery = `
        INSERT INTO transactions (
          id,
          po_id,
          amount,
          create_date_time,
          payment_method,
          type
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `;

      const transactionValues = [
        uuidv4(),
        cpoId,
        amount,
        new Date(),
        'qr',
        'cpo',
      ];

      const transactionResult = await client.query(
        transactionQuery,
        transactionValues,
      );

      const updateCPOQuery = `
        UPDATE customer_purchase_orders 
        SET 
          status = 'PAID',
          paid_date_time = $1
        WHERE id = $2
        RETURNING id
      `;

      await client.query(updateCPOQuery, [new Date(), cpoId]);

      await this.customerPurchaseOrdersService.checkAndCreateMaterialRequisitions(
        cpoId,
        client,
      );

      const historyQuery = `
        INSERT INTO history (
          id,
          cpo_id,
          status,
          date_time
        ) VALUES ($1, $2, $3, $4)
        RETURNING id
      `;

      await client.query(historyQuery, [uuidv4(), cpoId, 'PAID', new Date()]);

      const getOrderLinesQuery = `
        SELECT product_id, quantity 
        FROM order_lines 
        WHERE order_id = $1
      `;

      const orderLines = await client.query(getOrderLinesQuery, [cpoId]);

      if (orderLines.rows.length > 0) {
        const updateQueries = orderLines.rows.map(
          (line, index) =>
            `UPDATE products 
             SET sale = COALESCE(sale, 0) + $${index * 2 + 1}
             WHERE id = $${index * 2 + 2}`,
        );

        const updateSalesQuery = `
          ${updateQueries.join(';')}
        `;

        const updateSalesValues = orderLines.rows.flatMap((line) => [
          line.quantity,
          line.product_id,
        ]);

        await client.query(updateSalesQuery, updateSalesValues);
      }

      await client.query('COMMIT');

      return {
        success: true,
        transactionId: transactionResult.rows[0].id,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Database error:', error);
      throw new HttpException(
        'Failed to save payment details',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      client.release();
    }
  }
}
