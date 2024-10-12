import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { CreateMaterialPurchaseOrderDto } from '../dtos/create-material-purchase-order.dto';
import { v4 as uuidv4 } from 'uuid';
import { MPOStatus } from '../enums/material-purchase-orders-status.enum';
import { RequisitionsService } from 'src/requisitions/provider/requisitions.service';
import { TransactionsService } from 'src/transactions/providers/transactions.service';
import { UpdateMpoOrderLineDto } from '../dtos/update-mpo-order-line.dto';

@Injectable()
export class MaterialPurchaseOrdersService {
  constructor(
    @Inject('PG_CONNECTION')
    private readonly db: Pool,

    private readonly requisitionsService: RequisitionsService,
    private readonly transactionsService: TransactionsService,
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

      const requisitions = material.map((m) => {
        return m.requisition_id;
      });

      await this.transactionsService.craete({ po_id: mpoId });

      await this.requisitionsService.deleteManyById(requisitions);

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

  public async getAllMPO() {
    const query = `
    SELECT id, supplier, status, create_date_time, receive_date_time, total_amount
    FROM material_purchase_orders
  `;

    const { rows } = await this.db.query(query);

    return rows;
  }

  public async findOneById(id: string) {
    const query = `
    SELECT mpo.id AS id, mpo.supplier AS supplier, mpo.create_date_time AS create_date_time, mpo.receive_date_time AS receive_date_time, mpo_ol.id AS mpo_ol_id,  m.name AS material_name, mpo_ol.quantity AS material_quantity, m.unit AS material_unit, mpo_ol.price AS material_price, mpo.total_amount AS total_amount
    FROM material_purchase_orders AS mpo
    JOIN mpo_order_lines AS mpo_ol ON mpo.id = mpo_ol.mpo_id
    JOIN materials AS m ON mpo_ol.material_id = m.id
    JOIN transactions AS t ON mpo.id = t.po_id
    WHERE mpo.id = $1
  `;

    const { rows } = await this.db.query(query, [id]);

    const groupedResult = rows.reduce((acc, curr) => {
      const existingOrder = acc.find((order) => order.id === curr.id);

      if (existingOrder) {
        existingOrder.materials.push({
          mpo_ol_id: curr.mpo_ol_id,
          material_name: curr.material_name,
          material_quantity: curr.material_quantity,
          material_unit: curr.material_unit,
          material_price: curr.material_price,
        });
      } else {
        acc.push({
          id: curr.id,
          supplier: curr.supplier,
          create_date_time: curr.create_date_time,
          receive_date_time: curr.receive_date_time,
          total_amount: curr.total_amount,
          materials: [
            {
              mpo_ol_id: curr.mpo_ol_id,
              material_name: curr.material_name,
              material_quantity: curr.material_quantity,
              material_unit: curr.material_unit,
              material_price: curr.material_price,
            },
          ],
        });
      }

      return acc;
    }, []);

    return groupedResult[0];
  }

  public async updatePriceMpoOrderLine(
    updateMpoOrderLineDto: UpdateMpoOrderLineDto,
  ) {
    const { id, price } = updateMpoOrderLineDto;

    const existingMpoOrderLine = await this.findMpoOrderLineById(id);

    if (!existingMpoOrderLine) {
      throw new HttpException('Material not found', HttpStatus.NOT_FOUND);
    }

    const query = `
    UPDATE mpo_order_lines
    SET price = $1
    WHERE id = $2
    RETURNING *
  `;

    const { rows } = await this.db.query(query, [price, id]);

    return rows[0];
  }

  public async findMpoOrderLineById(id: string) {
    const query = `
      SELECT id, material_id, mpo_id, quantity, price
      FROM mpo_order_lines
      WHERE id = $1
    `;

    const { rows } = await this.db.query(query, [id]);

    return rows.length > 0 ? rows[0] : null;
  }
}
