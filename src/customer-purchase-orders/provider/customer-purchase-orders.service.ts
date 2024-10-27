import { Inject, Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { CreateCPODto } from '../dtos/create-cpo.dto';
import { v4 as uuidv4 } from 'uuid';
import { OrderLineItemDto } from '../dtos/order-line-item.dto';
import { HistoryService } from 'src/history/providers/history.service';

@Injectable()
export class CustomerPurchaseOrdersService {
  constructor(
    @Inject('PG_CONNECTION')
    private readonly db: Pool,

    private readonly historyService: HistoryService,
  ) {}

  public async create(createCpoDto: CreateCPODto) {
    const {
      user_id,
      delivery_price,
      address,
      total_price,
      phone_number,
      payment_method,
      order_lines,
    } = createCpoDto;

    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      const cpoId = uuidv4();
      const cpo = await this.insertCPO(client, {
        id: cpoId,
        user_id,
        delivery_price,
        address,
        total_price,
        phone_number,
        payment_method,
        est_delivery_date: this.getEstimatedDeliveryDateRange(),
      });

      await this.deleteOldOrderLines(client, user_id);

      const items = await this.insertOrderLines(client, cpoId, order_lines);

      await this.historyService.create({
        cpo_id: cpoId,
        status: 'NEW',
      });

      await client.query('COMMIT');

      return { ...cpo, items };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating CPO:', error);
      throw new Error('Failed to create Customer Purchase Order');
    } finally {
      client.release();
    }
  }

  private async insertCPO(
    client: PoolClient,
    data: {
      id: string;
      user_id: string;
      delivery_price: number;
      address: string;
      total_price: number;
      phone_number: string;
      payment_method: string;
      est_delivery_date: string;
    },
  ) {
    const query = `
      INSERT INTO customer_purchase_orders (
        id,
        user_id,
        status,
        delivery_price,
        address,
        total_price,
        phone_number,
        payment_method,
        est_delivery_date
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      data.id,
      data.user_id,
      'NEW',
      data.delivery_price,
      data.address,
      data.total_price,
      data.phone_number,
      data.payment_method,
      data.est_delivery_date,
    ];

    const result = await client.query(query, values);
    return result.rows[0];
  }

  private getEstimatedDeliveryDateRange(): string {
    const start = new Date();
    const end = new Date();

    start.setDate(start.getDate() + 6);
    end.setDate(end.getDate() + 8);

    const monthAbbr = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    const formatDate = (date: Date) => {
      const day = String(date.getDate()).padStart(2, '0');
      const month = monthAbbr[date.getMonth()];
      const year = date.getFullYear();

      return `${day}-${month}-${year}`;
    };

    return `${formatDate(start)} - ${formatDate(end)}`;
  }

  private async deleteOldOrderLines(client: PoolClient, userId: string) {
    const query = `
      DELETE FROM order_lines
      WHERE order_id IN (
        SELECT user_id FROM customer_purchase_orders
        WHERE user_id = $1
      )
    `;

    await client.query(query, [userId]);
  }

  private async insertOrderLines(
    client: PoolClient,
    cpoId: string,
    orderLines: OrderLineItemDto[],
  ) {
    const values = orderLines
      .map(
        (_, index) =>
          `($1, $${index * 3 + 2}, $${index * 3 + 3}, $${index * 3 + 4})`,
      )
      .join(', ');

    const params = [
      cpoId,
      ...orderLines.flatMap((item) => [
        uuidv4(),
        item.product_id,
        item.quantity,
      ]),
    ];

    const query = `
      INSERT INTO order_lines (order_id, id, product_id, quantity)
      VALUES ${values}
      RETURNING *
    `;

    const result = await client.query(query, params);
    return result.rows;
  }

  public async getAllCPOByUserId(id: string) {
    const query = `
      SELECT 
        cpo.id,
        cpo.paid_date_time,
        cpo.status,
        cpo.total_price,
        COALESCE(SUM(ol.quantity), 0) as quantity
      FROM customer_purchase_orders cpo
      LEFT JOIN order_lines ol ON cpo.id = ol.order_id
      LEFT JOIN history h ON cpo.id = h.cpo_id AND h.status = 'NEW'
      WHERE cpo.user_id = $1
      GROUP BY 
        cpo.id,
        cpo.paid_date_time,
        cpo.status,
        cpo.total_price,
        h.date_time
      ORDER BY h.date_time DESC
    `;

    const { rows } = await this.db.query(query, [id]);

    return rows;
  }

  public async getCPOById(id: string) {
    const query = `
      SELECT 
        cpo.id,
        cpo.status,
        cpo.paid_date_time,
        cpo.est_delivery_date,
        cpo.delivery_price,
        cpo.address,
        cpo.phone_number,
        cpo.total_price,
        cpo.payment_method,
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', ol.id,
            'product_id', p.id,
            'name', p.name,
            'price', p.price,
            'quantity', ol.quantity,
            'image', p.img
          )
        ) as products
      FROM customer_purchase_orders cpo
      LEFT JOIN order_lines ol ON cpo.id = ol.order_id
      LEFT JOIN products p ON ol.product_id = p.id
      WHERE cpo.id = $1
      GROUP BY 
        cpo.id,
        cpo.status,
        cpo.paid_date_time,
        cpo.est_delivery_date,
        cpo.delivery_price,
        cpo.address,
        cpo.phone_number,
        cpo.total_price,
        cpo.payment_method
    `;

    try {
      const { rows } = await this.db.query(query, [id]);

      if (rows.length === 0) {
        throw new Error('Order not found');
      }

      const order = rows[0];
      let products = order.products;

      if (products.length === 1 && products[0] === null) {
        products = [];
      }

      return {
        cpo: {
          id: order.id,
          payment_status: order.paid_date_time ? 'Completed' : 'Not paid',
          order_status: order.status,
          delivery_date: order.est_delivery_date,
          payment_method: order.payment_method,
          delivery_details: {
            address: order.address,
            phone: order.phone_number,
          },
          delivery_price: order.delivery_price,
          total_price: order.total_price,
        },
        order_lines: products.map((product) => ({
          id: product.id,
          name: product.name,
          price: product.price,
          quantity: product.quantity,
          image: product.image,
        })),
      };
    } catch (error) {
      console.error('Error getting CPO:', error);
      throw new Error('Failed to get Customer Purchase Order');
    }
  }
}
