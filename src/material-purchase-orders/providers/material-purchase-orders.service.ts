import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { CreateMaterialPurchaseOrderDto } from '../dtos/create-material-purchase-order.dto';
import { v4 as uuidv4 } from 'uuid';
import { MPOStatus } from '../enums/material-purchase-orders-status.enum';

@Injectable()
export class MaterialPurchaseOrdersService {
  constructor(
    @Inject('PG_CONNECTION')
    private readonly db: Pool,
  ) {}

  public async createMPO(
    createMaterialPurchaseOrderDto: CreateMaterialPurchaseOrderDto,
  ) {
    const { supplier, material } = createMaterialPurchaseOrderDto;

    const client = await this.db.connect();

    try {
      const mpoId = uuidv4();

      const mpoQuery = `
      INSERT INTO material_purchase_orders (id, supplier, status)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
      await client.query('BEGIN');
      const mpoResult = await client.query(mpoQuery, [
        mpoId,
        supplier,
        MPOStatus.NEW,
      ]);
      const mpo = mpoResult.rows[0];

      const itemValues = material
        .map((_, index) => {
          const offset = index * 3;
          return `($1, $${offset + 2}, $${offset + 3}, $${offset + 4})`;
        })
        .join(', ');

      const itemParams = [mpo.id];
      material.forEach((item) => {
        const newItemId = uuidv4();
        itemParams.push(newItemId, item.material_id, item.quantity);
      });

      const itemsQuery = `
      INSERT INTO mpo_order_lines (mpo_id, id, material_id, quantity)
      VALUES ${itemValues}
      RETURNING *
    `;
      const itemsResult = await client.query(itemsQuery, itemParams);

      await client.query('COMMIT');

      return {
        ...mpo,
        items: itemsResult.rows,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
