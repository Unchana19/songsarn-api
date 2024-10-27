import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { AddToCartDto } from '../dtos/add-to-cart.dto';

@Injectable()
export class CartsService {
  constructor(
    @Inject('PG_CONNECTION')
    private readonly db: Pool,
  ) {}

  public async addToCart(addToCartDto: AddToCartDto) {
    const { product_id, order_id } = addToCartDto;

    const existingOrder = await this.findOrder(addToCartDto);
    if (existingOrder) {
      const updatedOrder = await this.increaseQuantity(existingOrder.id);
      return updatedOrder;
    }

    const id = uuidv4();

    const order = await this.db.query(
      'INSERT INTO order_lines (id, product_id, order_id, quantity) VALUES ($1, $2, $3, $4) RETURNING *',
      [id, product_id, order_id, 1],
    );

    return order;
  }

  public async findOrder(addToCartDto: AddToCartDto) {
    const { product_id, order_id } = addToCartDto;

    const query = `
      SELECT id, product_id, order_id, quantity
      FROM order_lines
      WHERE product_id = $1 AND order_id = $2
    `;

    const { rows } = await this.db.query(query, [product_id, order_id]);

    return rows.length > 0 ? rows[0] : null;
  }

  public async getProductsInCartByOrderId(id: string) {
    const query = `
      SELECT 
        ol.id AS id,
        ol.quantity AS quantity,
        p.id AS product_id,
        p.name AS name,
        p.img AS img,
        p.price AS price
      FROM order_lines ol
      JOIN products p ON ol.product_id = p.id
      WHERE ol.order_id = $1
    `;

    const { rows } = await this.db.query(query, [id]);

    return rows.length > 0 ? rows : null;
  }

  public async increaseQuantity(id: string) {
    try {
      const query = `
      UPDATE order_lines 
      SET quantity = quantity + 1 
      WHERE id = $1 
      RETURNING *
    `;

      const { rows } = await this.db.query(query, [id]);

      if (rows.length === 0) {
        throw new Error('Order line not found');
      }

      return rows[0];
    } catch (error) {
      console.error('Error increasing quantity:', error);
      throw error;
    }
  }

  public async decreaseQuantity(id: string) {
    try {
      const checkQuery = `
      SELECT quantity 
      FROM order_lines 
      WHERE id = $1
    `;

      const { rows: checkRows } = await this.db.query(checkQuery, [id]);

      if (checkRows.length === 0) {
        throw new Error('Order line not found');
      }

      if (checkRows[0].quantity === 1) {
        const result = await this.deleteOrderById(id);
        return result;
      }

      const updateQuery = `
      UPDATE order_lines 
      SET quantity = quantity - 1 
      WHERE id = $1 
      RETURNING *
    `;

      const { rows } = await this.db.query(updateQuery, [id]);
      return rows[0];
    } catch (error) {
      console.error('Error decreasing quantity:', error);
      throw error;
    }
  }

  public async deleteOrderById(id: string) {
    try {
      const query = `
        DELETE FROM order_lines 
        WHERE id = $1 
        RETURNING *
      `;

      const { rows } = await this.db.query(query, [id]);
      return { ...rows[0], removed: true };
    } catch (error) {
      console.error('Error delete order:', error);
      throw error;
    }
  }
}
