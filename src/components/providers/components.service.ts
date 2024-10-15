import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { CreateComponentDto } from '../dtos/create-component-dto';
import { v4 as uuidv4 } from 'uuid';
import { UploadsService } from 'src/uploads/providers/uploads.service';
import { MaterialItemDto } from '../dtos/material-item.dto';

@Injectable()
export class ComponentsService {
  constructor(
    @Inject('PG_CONNECTION')
    private readonly db: Pool,

    private readonly uploadsService: UploadsService,
  ) {}

  public async create(
    createComponentDto: CreateComponentDto,
    file?: Express.Multer.File,
  ) {
    const { category_id, name, price, materials } = createComponentDto;

    const existingComponent = await this.findOneByName(name);

    if (existingComponent) {
      throw new HttpException(
        'Component already exists',
        HttpStatus.BAD_REQUEST,
      );
    }

    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      const id = uuidv4();
      await this.insertComponent(client, id, category_id, name, price);

      if (materials && materials.length > 0) {
        await this.insertBomComponents(client, id, materials);
      }

      if (file) {
        await this.updateImg(id, file);
      }

      await client.query('COMMIT');

      return this.findOneById(id);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating component:', error);
      throw new HttpException(
        'Failed to create component',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      client.release();
    }
  }

  private async insertComponent(
    client: PoolClient,
    id: string,
    category_id: string,
    name: string,
    price: number,
  ): Promise<any> {
    const query =
      'INSERT INTO components (id, category_id, name, price) VALUES ($1, $2, $3, $4) RETURNING *';
    const result = await client.query(query, [id, category_id, name, price]);
    return result.rows[0];
  }

  private async insertBomComponents(
    client: PoolClient,
    componentId: string,
    materials: MaterialItemDto[],
  ): Promise<void> {
    const values = materials
      .map(
        (_, index) =>
          `($${index * 4 + 1}, $${index * 4 + 2}, $${index * 4 + 3}, $${index * 4 + 4})`,
      )
      .join(', ');
    const params = materials.flatMap((m) => [
      uuidv4(),
      componentId,
      m.material_id,
      m.quantity,
    ]);
    const query = `INSERT INTO bom_components (id, component_id, material_id, quantity) VALUES ${values}`;
    await client.query(query, params);
  }

  public async findOneById(id: string) {
    const query = `
      SELECT id, category_id, name, price, img
      FROM components
      WHERE id = $1
    `;

    const { rows } = await this.db.query(query, [id]);

    return rows.length > 0 ? rows[0] : null;
  }

  public async findOneByName(name: string) {
    const query = `
      SELECT id, category_id, name, price, img
      FROM components
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
    UPDATE components
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
      FROM components
    `;

    const { rows } = await this.db.query(query);

    return rows;
  }
}
