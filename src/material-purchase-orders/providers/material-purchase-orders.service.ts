import { Inject, Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { CreateMaterialPurchaseOrderDto } from '../dtos/create-material-purchase-order.dto';
import { v4 as uuidv4 } from 'uuid';
import { RequisitionsService } from 'src/requisitions/provider/requisitions.service';
import { TransactionsService } from 'src/transactions/providers/transactions.service';
import { UpdateMpoOrderLineDto } from '../dtos/update-mpo-order-line.dto';
import { UpdateMPOTotalPriceDto } from '../dtos/update-mpo-total-price.dto';
import { CancelMpoDto } from '../dtos/cancel-mpo.dto';
import { ReceiveMPODto } from '../dtos/receive-mpo.dto';
import { MaterialsService } from 'src/materials/providers/materials.service';
import { MaterialItemDto } from '../dtos/material-item.dto';

@Injectable()
export class MaterialPurchaseOrdersService {
  constructor(
    @Inject('PG_CONNECTION')
    private readonly db: Pool,

    private readonly requisitionsService: RequisitionsService,
    private readonly transactionsService: TransactionsService,
    private readonly materialsService: MaterialsService,
  ) {}

  public async createMPO(
    createMaterialPurchaseOrderDto: CreateMaterialPurchaseOrderDto,
  ) {
    const { supplier, material } = createMaterialPurchaseOrderDto;

    if (!material || material.length === 0) {
      throw new Error('At least one material item is required');
    }

    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      const mpoId = uuidv4();
      const mpo = await this.insertMPO(client, mpoId, supplier);
      const items = await this.insertMPOItems(client, mpoId, material);

      await this.transactionsService.create({ po_id: mpoId, type: 'mpo' });

      const requisitions = material.map((m) => m.requisition_id);
      await this.requisitionsService.deleteManyById(requisitions);

      await client.query('COMMIT');

      return { ...mpo, items };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating MPO:', error);
      throw new Error('Failed to create Material Purchase Order');
    } finally {
      client.release();
    }
  }

  private async insertMPO(client: PoolClient, mpoId: string, supplier: string) {
    const query = `
    INSERT INTO material_purchase_orders (id, supplier, status)
    VALUES ($1, $2, $3)
    RETURNING *
  `;
    const result = await client.query(query, [mpoId, supplier, 'NEW']);
    return result.rows[0];
  }

  private async insertMPOItems(
    client: PoolClient,
    mpoId: string,
    materials: MaterialItemDto[],
  ) {
    const values = materials
      .map((_, i) => `($1, $${i * 3 + 2}, $${i * 3 + 3}, $${i * 3 + 4})`)
      .join(', ');
    const params = [
      mpoId,
      ...materials.flatMap((m) => [uuidv4(), m.material_id, m.quantity]),
    ];

    const query = `
    INSERT INTO mpo_order_lines (mpo_id, id, material_id, quantity)
    VALUES ${values}
    RETURNING *
  `;
    const result = await client.query(query, params);
    return result.rows;
  }

  public async getAllMPO() {
    const query = `
    SELECT id, supplier, status, create_date_time, receive_date_time, total_price
    FROM material_purchase_orders
  `;

    const { rows } = await this.db.query(query);

    return rows;
  }

  public async findOneById(id: string) {
    const query = `
    SELECT mpo.id AS id, mpo.supplier AS supplier, mpo.create_date_time AS create_date_time, mpo.receive_date_time AS receive_date_time, t.payment_method AS payment_method, mpo_ol.id AS mpo_ol_id, m.id AS material_id, m.name AS material_name, mpo_ol.quantity AS material_quantity, m.unit AS material_unit, mpo_ol.price AS material_price, mpo.total_price AS total_price
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
          material_id: curr.material_id,
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
          total_price: curr.total_price,
          payment_method: curr.payment_method,
          materials: [
            {
              mpo_ol_id: curr.mpo_ol_id,
              material_id: curr.material_id,
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
    const { mpo_id, payment_method, materials } = updateMpoOrderLineDto;

    let totalPrice = 0;

    const updatedOrderLines = await Promise.all(
      materials.map(async (material) => {
        const query = `
      UPDATE mpo_order_lines
      SET price = $1
      WHERE id = $2
      RETURNING *
      `;
        const values = [material.material_price, material.mpo_ol_id];

        const { rows } = await this.db.query(query, values);

        totalPrice += material.material_price;

        return rows[0];
      }),
    );

    await this.updateMPOTotalPrice({ mpo_id, total_price: totalPrice });

    await this.transactionsService.updateTransactionByPOId({
      po_id: mpo_id,
      payment_method,
      amount: totalPrice,
    });

    return updatedOrderLines;
  }

  public async updateMPOTotalPrice(
    updateMPOTotalPriceDto: UpdateMPOTotalPriceDto,
  ) {
    const { mpo_id, total_price } = updateMPOTotalPriceDto;

    const query = `
    UPDATE material_purchase_orders
    SET total_price = $1
    WHERE id = $2
    RETURNING *
  `;

    const { rows } = await this.db.query(query, [total_price, mpo_id]);

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

  public async receiveMPOById(receiveMPODto: ReceiveMPODto) {
    const { id } = receiveMPODto;

    const query = `
    UPDATE material_purchase_orders
    SET status = $1, receive_date_time = $2
    WHERE id = $3
    RETURNING *
  `;

    const { rows } = await this.db.query(query, ['RECEIVED', new Date(), id]);

    const mpo = await this.findOneById(id);

    for (const material of mpo.materials) {
      await this.materialsService.updateQuantityById(
        material.material_id,
        material.material_quantity,
      );
    }

    return rows[0];
  }

  public async cancelMPOById(cancelMpoDto: CancelMpoDto) {
    const { id } = cancelMpoDto;
    const query = `
    UPDATE material_purchase_orders
    SET status = $1, total_price = $2, cancel_date_time = $3
    WHERE id = $4
    RETURNING *
  `;

    const { rows } = await this.db.query(query, [
      'CANCELLED',
      0,
      new Date(),
      id,
    ]);

    await this.transactionsService.cancelTransactionByPOID(id);

    return rows[0];
  }
}
