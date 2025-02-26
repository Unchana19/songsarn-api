import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
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
    const { product_id, order_id, quantity } = addToCartDto;

    let quantityValue = 1;

    if (quantity) {
      quantityValue = quantity;
    }

    const existingOrder = await this.findOrder(addToCartDto);
    if (existingOrder) {
      const updatedOrder = await this.increaseQuantity(existingOrder.id);
      return updatedOrder;
    }

    const id = uuidv4();

    const order = await this.db.query(
      'INSERT INTO order_lines (id, product_id, order_id, quantity) VALUES ($1, $2, $3, $4) RETURNING *',
      [id, product_id, order_id, quantityValue],
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
        ORDER BY ol.id
      `;

    const { rows } = await this.db.query(query, [id]);

    if (rows.length > 0) {
      return rows;
    } else {
      throw new HttpException('Order line not found', HttpStatus.NOT_FOUND);
    }
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
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // First, get the order line and associated product details
      const orderQuery = `
        SELECT ol.*, p.custom_by, p.id as product_id 
        FROM order_lines ol
        JOIN products p ON ol.product_id = p.id
        WHERE ol.id = $1
      `;

      const { rows: orderRows } = await client.query(orderQuery, [id]);

      if (orderRows.length === 0) {
        throw new HttpException('Order line not found', HttpStatus.NOT_FOUND);
      }

      const order = orderRows[0];

      // Delete the order line
      const deleteOrderQuery = `
        DELETE FROM order_lines
        WHERE id = $1
        RETURNING *
      `;

      const { rows: deletedOrderRows } = await client.query(deleteOrderQuery, [
        id,
      ]);

      // If this is a custom product, delete it and its components
      if (order.custom_by) {
        // Delete BOM products first
        await client.query('DELETE FROM bom_products WHERE product_id = $1', [
          order.product_id,
        ]);

        // Then delete the product
        await client.query('DELETE FROM products WHERE id = $1', [
          order.product_id,
        ]);
      }

      await client.query('COMMIT');

      return { ...deletedOrderRows[0], removed: true };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error deleting order:', error);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Failed to delete order',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      client.release();
    }
  }
}
