import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { UploadsService } from 'src/uploads/providers/uploads.service';
import { CreateProductDto } from '../dtos/create-product.dto';
import { Pool, PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { ComponentItemsDto } from '../dtos/component-items.dto';

@Injectable()
export class ProductsService {
  constructor(
    @Inject('PG_CONNECTION')
    private readonly db: Pool,
    private readonly uploadsService: UploadsService,
  ) {}

  public async create(
    createProductDto: CreateProductDto,
    file?: Express.Multer.File,
  ) {
    const { category_id, name, price, detail, components } = createProductDto;

    const existingProduct = await this.findOneByName(name);
    if (existingProduct) {
      throw new HttpException('Product already exists', HttpStatus.BAD_REQUEST);
    }

    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      const productId = uuidv4();
      await this.insertProduct(client, {
        id: productId,
        category_id,
        name,
        price,
        detail,
      });

      if (components && components.length > 0) {
        await this.insertBOMProducts(client, productId, components);
      }

      await client.query('COMMIT');

      if (file) {
        await this.updateImg(productId, file);
      }

      return this.findOneById(productId);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating product:', error);
      throw new HttpException(
        'Failed to create product',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      client.release();
    }
  }

  private async insertProduct(
    client: PoolClient,
    data: {
      id: string;
      category_id: string;
      name: string;
      price: number;
      detail: string;
    },
  ): Promise<any> {
    const query = `
      INSERT INTO products (id, category_id, name, price, detail)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const result = await client.query(query, [
      data.id,
      data.category_id,
      data.name,
      data.price,
      data.detail,
    ]);

    return result.rows[0];
  }

  private async insertBOMProducts(
    client: PoolClient,
    productId: string,
    components: ComponentItemsDto[],
  ): Promise<void> {
    const values = components
      .map(
        (_, index) =>
          `($${index * 5 + 1}, $${index * 5 + 2}, $${index * 5 + 3}, $${index * 5 + 4}, $${index * 5 + 5})`,
      )
      .join(', ');

    const params = components.flatMap((comp) => [
      uuidv4(),
      productId,
      comp.id,
      comp.primary_color,
      comp.pattern_color,
    ]);

    const query = `
      INSERT INTO bom_products (id, product_id, component_id, primary_color, pattern_color)
      VALUES ${values}
    `;

    await client.query(query, params);
  }

  private async findOneByName(name: string) {
    const query = `
      SELECT id, category_id, name, price, sale, detail, img
      FROM products
      WHERE name = $1
    `;

    const { rows } = await this.db.query(query, [name]);
    return rows.length > 0 ? rows[0] : null;
  }

  private async findOneById(id: string) {
    const query = `
      SELECT id, category_id, name, price, sale, detail, img
      FROM products
      WHERE id = $1
    `;

    const { rows } = await this.db.query(query, [id]);
    return rows.length > 0 ? rows[0] : null;
  }

  private async updateImg(id: string, file: Express.Multer.File) {
    const filename = await this.uploadsService.uploadFile(file, id);

    const query = `
      UPDATE products
      SET img = $1
      WHERE id = $2
      RETURNING *
    `;

    const { rows } = await this.db.query(query, [filename, id]);
    return rows.length > 0 ? rows[0] : null;
  }

  public async getAll() {
    const query = `
      SELECT id, category_id, name, price, img
      FROM products
    `;

    const { rows } = await this.db.query(query);

    return rows;
  }

  public async deleteById(id: string) {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      const existingProduct = await this.findOneById(id);
      if (!existingProduct) {
        throw new HttpException('Product not found', HttpStatus.NOT_FOUND);
      }

      await client.query('DELETE FROM bom_products WHERE product_id = $1', [
        id,
      ]);

      if (existingProduct.img) {
        await this.uploadsService.deleteFile(existingProduct.img);
      }

      const deleteQuery = 'DELETE FROM products WHERE id = $1 RETURNING *';
      const { rows } = await client.query(deleteQuery, [id]);

      await client.query('COMMIT');

      if (rows.length === 0) {
        throw new HttpException(
          'Failed to delete product',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return {
        message: 'Product deleted successfully',
        deletedProduct: rows[0],
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error deleting product:', error);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Failed to delete product',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      client.release();
    }
  }
}
