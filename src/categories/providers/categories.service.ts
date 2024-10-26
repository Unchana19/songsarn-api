import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { CreateCategoryDto } from '../dtos/create-category.dto';
import { v4 as uuidv4 } from 'uuid';
import { UploadsService } from 'src/uploads/providers/uploads.service';
import { UpdateCategoryDto } from '../dtos/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @Inject('PG_CONNECTION')
    private readonly db: Pool,

    private readonly uploadsService: UploadsService,
  ) {}

  public async create(
    createCategoryDto: CreateCategoryDto,
    file?: Express.Multer.File,
  ) {
    const { name, type, componentCategories } = createCategoryDto;

    const existingCategory = await this.findOneByName(name);

    if (existingCategory) {
      throw new HttpException(
        'Category already exists',
        HttpStatus.BAD_REQUEST,
      );
    }

    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      const id = uuidv4();

      await client.query(
        'INSERT INTO categories (id, name, type) VALUES ($1, $2, $3) RETURNING *',
        [id, name, type],
      );

      if (componentCategories && componentCategories.length > 0) {
        const values = componentCategories
          .map(
            (_, index) =>
              `($${index * 3 + 1}, $${index * 3 + 2}, $${index * 3 + 3})`,
          )
          .join(', ');

        const params = componentCategories.flatMap((categoryComponentId) => [
          uuidv4(),
          id,
          categoryComponentId.id,
        ]);

        const bomQuery = `
        INSERT INTO bom_categories (id, category_product_id, category_component_id) 
        VALUES ${values}
      `;

        await client.query(bomQuery, params);
      }

      await client.query('COMMIT');

      if (file) {
        await this.updateImg(id, file);
      }

      return this.findOneById(id);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating category:', error);
      throw new HttpException(
        'Failed to create category',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      client.release();
    }
  }

  public async findOneById(id: string) {
    const query = `
      SELECT id, name, type, img
      FROM categories
      WHERE id = $1
    `;

    const { rows } = await this.db.query(query, [id]);

    return rows.length > 0 ? rows[0] : null;
  }

  public async findOneByName(name: string) {
    const query = `
      SELECT id, name, type, img
      FROM categories
      WHERE name = $1
    `;

    const { rows } = await this.db.query(query, [name]);

    return rows.length > 0 ? rows[0] : null;
  }

  public async updateImg(id: string, file?: Express.Multer.File) {
    const existingCategory = await this.findOneById(id);

    if (!existingCategory) {
      throw new HttpException('Category not found', HttpStatus.NOT_FOUND);
    }

    const filename = await this.uploadsService.uploadFile(file, id);

    const query = `
    UPDATE categories
    SET img = $1
    WHERE id = $2
    RETURNING *
    `;

    const { rows } = await this.db.query(query, [filename, id]);

    return rows.length > 0 ? rows[0] : null;
  }

  public async getAll() {
    const query = `
      SELECT id, name, type, img
      FROM categories
    `;

    const { rows } = await this.db.query(query);

    return rows;
  }

  public async updateCategoryById(
    updateCategoryDto: UpdateCategoryDto,
    file?: Express.Multer.File,
  ) {
    const { id, name, type, componentCategories } = updateCategoryDto;

    const existingCategory = await this.findOneById(id);
    if (!existingCategory) {
      throw new HttpException('Category not found', HttpStatus.NOT_FOUND);
    }

    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      const updateQuery = `
      UPDATE categories
      SET name = $1, type = $2
      WHERE id = $3
      RETURNING *
    `;
      await client.query(updateQuery, [name, type, id]);

      await client.query(
        'DELETE FROM bom_categories WHERE category_product_id = $1',
        [id],
      );

      if (componentCategories && componentCategories.length > 0) {
        const values = componentCategories
          .map(
            (_, index) =>
              `($${index * 3 + 1}, $${index * 3 + 2}, $${index * 3 + 3})`,
          )
          .join(', ');

        const params = componentCategories.flatMap((componentCategoryId) => [
          uuidv4(),
          id,
          componentCategoryId.id,
        ]);

        const bomQuery = `
        INSERT INTO bom_categories (id, category_product_id, category_component_id) 
        VALUES ${values}
      `;

        await client.query(bomQuery, params);
      }

      await client.query('COMMIT');

      if (file) {
        await this.updateImg(id, file);
      }

      const category = await this.findOneById(id);
      const bomCategories = await this.getBOMCategoriesById(id);

      return {
        ...category,
        componentCategories: bomCategories,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error updating category:', error);
      throw new HttpException(
        'Failed to update category',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      client.release();
    }
  }

  public async getBOMCategoriesById(id: string) {
    const query = `
    SELECT 
      bom.category_component_id AS id,
      c.name AS name,
      c.type AS type,
      c.img AS img
    FROM bom_categories bom
    JOIN categories c ON bom.category_component_id = c.id
    WHERE bom.category_product_id = $1
  `;

    const { rows } = await this.db.query(query, [id]);
    return rows;
  }

  public async deleteCategoryById(id: string) {
    const existingCategory = await this.findOneById(id);

    if (!existingCategory) {
      throw new HttpException('Category not found', HttpStatus.NOT_FOUND);
    }

    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      await client.query(
        `DELETE FROM bom_categories 
         WHERE category_product_id = $1 
         OR category_component_id = $1`,
        [id],
      );

      if (existingCategory.img) {
        try {
          await this.uploadsService.deleteFile(existingCategory.img);
        } catch {
          await client.query('ROLLBACK');
          throw new HttpException(
            'Failed to delete image',
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      const { rows } = await client.query(
        `DELETE FROM categories
         WHERE id = $1
         RETURNING *`,
        [id],
      );

      if (rows.length === 0) {
        await client.query('ROLLBACK');
        throw new HttpException(
          'Failed to delete category',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      await client.query('COMMIT');
      return rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error deleting category:', error);
      throw new HttpException(
        'Failed to delete category',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      client.release();
    }
  }

  public async getAllComponentCategories() {
    const query = `
      SELECT id, name, type, img
      FROM categories
      WHERE type = $1
    `;

    const { rows } = await this.db.query(query, ['component']);

    return rows.length > 0 ? rows : null;
  }
}
