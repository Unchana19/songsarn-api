import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { CreateTransactionDto } from '../dtos/create-transaction.dto';
import { v4 as uuidv4 } from 'uuid';
import { UpdateTransactionDto } from '../dtos/update-transaction.dto';

@Injectable()
export class TransactionsService {
  constructor(
    @Inject('PG_CONNECTION')
    private readonly db: Pool,
  ) {}

  public async craete(createTransactionDto: CreateTransactionDto) {
    const { po_id } = createTransactionDto;

    const existingTransaction = await this.findOneByPOId(po_id);

    if (existingTransaction) {
      throw new HttpException(
        'Transaction already exists',
        HttpStatus.BAD_REQUEST,
      );
    }

    const id = uuidv4();

    await this.db.query(
      'INSERT INTO transactions (id, po_id) VALUES ($1, $2) RETURNING *',
      [id, po_id],
    );

    const transaction = await this.findOneById(id);

    return transaction;
  }

  public async findOneById(id: string) {
    const query = `
      SELECT id, po_id
      FROM transactions
      WHERE id = $1
    `;

    const { rows } = await this.db.query(query, [id]);

    return rows.length > 0 ? rows[0] : null;
  }

  public async findOneByPOId(po_id: string) {
    const query = `
      SELECT id, po_id
      FROM transactions
      WHERE po_id = $1
    `;

    const { rows } = await this.db.query(query, [po_id]);

    return rows.length > 0 ? rows[0] : null;
  }

  public async updateTransactionByPOId(
    updateTransactionDto: UpdateTransactionDto,
  ) {
    const { po_id, payment_method, amount } = updateTransactionDto;
    const existingTransaction = await this.findOneByPOId(po_id);

    if (!existingTransaction) {
      throw new HttpException('Transaction not found', HttpStatus.NOT_FOUND);
    }

    const query = `
    UPDATE transactions
    SET payment_method = $1, amount = $2
    WHERE po_id = $3
    RETURNING *
  `;

    const { rows } = await this.db.query(query, [
      payment_method,
      amount,
      po_id,
    ]);

    return rows[0];
  }

  public async cancelTransactionByPOID(po_id: string) {
    const query = `
    UPDATE transactions
    SET amount = 0
    WHERE po_id = $1
    RETURNING *
  `;

    const { rows } = await this.db.query(query, [po_id]);

    return rows[0];
  }
}
