import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { CreateCategoryDto } from '../dtos/create-category.dto';
import { v4 as uuidv4 } from 'uuid';
import { UploadsService } from 'src/uploads/providers/uploads.service';

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
    const { name, type } = createCategoryDto;

    const existingCategory = await this.db.query(
      'SELECT * FROM categories WHERE name = $1',
      [name],
    );

    if (existingCategory.rows.length > 0) {
      throw new HttpException(
        'Category already exists',
        HttpStatus.BAD_REQUEST,
      );
    }

    const id = uuidv4();

    await this.db.query(
      'INSERT INTO categories (id, name, type) VALUES ($1, $2, $3) RETURNING *',
      [id, name, type],
    );

    if (file) {
      await this.updateImg(id, file);
    }

    const category = await this.findOneById(id);

    return category;
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
}
