import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { CreateHistoryDto } from '../dtos/create-history.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class HistoryService {
  constructor(
    @Inject('PG_CONNECTION')
    private readonly db: Pool,
  ) {}

  public async create(createHistoryDto: CreateHistoryDto) {
    const { cpo_id, status } = createHistoryDto;

    const query = `
      INSERT INTO history (
        id,
        cpo_id,
        status,
        date_time
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    try {
      const values = [uuidv4(), cpo_id, status, new Date()];

      const { rows } = await this.db.query(query, values);
      return rows[0];
    } catch (error) {
      console.error('Error creating history:', error);
      throw new Error('Failed to create history record');
    }
  }

  public async getHistoryByCPOId(cpoId: string) {
    const query = `
      SELECT 
        h.id,
        h.status,
        h.date_time,
        cpo.id as cpo_id
      FROM history h
      JOIN customer_purchase_order cpo ON h.cpo_id = cpo.id
      WHERE h.cpo_id = $1
      ORDER BY h.date_time DESC
    `;

    try {
      const { rows } = await this.db.query(query, [cpoId]);
      return rows;
    } catch (error) {
      console.error('Error getting history:', error);
      throw new Error('Failed to get history records');
    }
  }

  public async getAllHistory() {
    const query = `
      (
        SELECT 
          h.id,
          h.cpo_id as reference_id,
          h.status,
          h.date_time,
          'CPO' as type
        FROM history h
      )
      UNION ALL
      (
        SELECT 
          m.id,
          m.id as reference_id,
          m.status,
          m.create_date_time as date_time,
          'MPO' as type
        FROM material_purchase_orders m
        WHERE m.create_date_time IS NOT NULL
      )
      UNION ALL
      (
        SELECT 
          m.id,
          m.id as reference_id,
          'RECEIVED' as status,
          m.receive_date_time as date_time,
          'MPO' as type
        FROM material_purchase_orders m
        WHERE m.receive_date_time IS NOT NULL
      )
      UNION ALL
      (
        SELECT 
          m.id,
          m.id as reference_id,
          'CANCELLED' as status,
          m.cancel_date_time as date_time,
          'MPO' as type
        FROM material_purchase_orders m
        WHERE m.cancel_date_time IS NOT NULL
      )
      ORDER BY date_time DESC
    `;

    try {
      const { rows } = await this.db.query(query);

      return rows.map((row) => ({
        id: row.id,
        po_id: row.reference_id,
        status: row.status,
        date_time: row.date_time,
        type: row.type,
      }));
    } catch (error) {
      console.error('Error getting combined history:', error);
      throw new Error('Failed to get history records');
    }
  }
}
