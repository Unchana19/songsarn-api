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

interface SlipResponse {
  amount: number;
  bank_account: string;
  ref1: string;
  ref2: string;
  ref3: string;
  sender_bank_account: string;
  sender_bank_name: string;
  sender_name: string;
  service_name: string;
  time: string;
  transaction_id: string;
}

@Injectable()
export class PaymentService {
  private readonly promptpayMobileNumber: string;
  private readonly slipokApiKey: string;
  private readonly slipokEndpoint: string;

  constructor(
    @Inject('PG_CONNECTION')
    private readonly db: Pool,
    private configService: ConfigService,
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
      const formData = new FormData();
      formData.append('file', file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype,
      });

      const response = await axios.post<SlipResponse>(
        this.slipokEndpoint,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'x-authorization': this.slipokApiKey,
          },
        },
      );

      const slipData = response.data;

      if (!slipData) {
        return {
          success: false,
          message: 'Invalid slip image',
          error: {
            code: 'INVALID_SLIP',
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
            sender_name: slipData.sender_name,
            sender_bank: slipData.sender_bank_name,
            transaction_time: slipData.time,
            transaction_id: slipData.transaction_id,
          },
        };
      }

      if (slipData.bank_account !== this.promptpayMobileNumber) {
        return {
          success: false,
          message: 'Payment was sent to wrong account',
          error: {
            code: 'WRONG_ACCOUNT',
            expectedAccount: this.promptpayMobileNumber,
            actualAccount: slipData.bank_account,
          },
          details: {
            amount: slipData.amount,
            sender_name: slipData.sender_name,
            sender_bank: slipData.sender_bank_name,
            transaction_time: slipData.time,
            transaction_id: slipData.transaction_id,
          },
        };
      }

      await this.savePaymentDetails(orderId, slipData);

      return {
        success: true,
        message: 'Payment verified successfully',
        details: {
          amount: slipData.amount,
          sender_name: slipData.sender_name,
          sender_bank: slipData.sender_bank_name,
          transaction_time: slipData.time,
          transaction_id: slipData.transaction_id,
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

  private async savePaymentDetails(cpoId: string, slipData: SlipResponse) {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      const transactionQuery = `
        INSERT INTO transactions (
          id,
          po_id,
          amount,
          create_date_time,
          payment_method
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `;

      const transactionValues = [
        slipData.transaction_id,
        cpoId,
        slipData.amount,
        slipData.time,
        'qr',
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

      await client.query(updateCPOQuery, [slipData.time, cpoId]);

      const historyQuery = `
        INSERT INTO history (
          cpo_id,
          status,
          date_time
        ) VALUES ($1, $2, $3)
        RETURNING id
      `;

      await client.query(historyQuery, [cpoId, 'PAID', new Date()]);

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
