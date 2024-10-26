import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { CreateComponentDto } from '../dtos/create-component-dto';
import { v4 as uuidv4 } from 'uuid';
import { UploadsService } from 'src/uploads/providers/uploads.service';
import { MaterialItemDto } from '../dtos/material-item.dto';
import { UpdateComponentDto } from '../dtos/update-component.dto';

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
    const {
      category_id,
      name,
      price,
      color_primary_use,
      color_pattern_use,
      materials,
    } = createComponentDto;

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
      await this.insertComponent(
        client,
        id,
        category_id,
        name,
        price,
        color_primary_use,
        color_pattern_use,
      );

      if (materials && materials.length > 0) {
        await this.insertBomComponents(client, id, materials);
      }

      await client.query('COMMIT');

      if (file) {
        await this.updateImg(id, file);
      }
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
    color_primary_use: number,
    color_pattern_use: number,
  ): Promise<any> {
    const query =
      'INSERT INTO components (id, category_id, name, price, color_primary_use, color_pattern_use) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *';
    const result = await client.query(query, [
      id,
      category_id,
      name,
      price,
      color_primary_use,
      color_pattern_use,
    ]);
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
    const existingComponent = await this.findOneById(id);

    if (!existingComponent) {
      throw new HttpException('Component not found', HttpStatus.NOT_FOUND);
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
      SELECT id, category_id, name, price, color_primary_use, color_pattern_use, img
      FROM components
    `;

    const { rows } = await this.db.query(query);

    return rows;
  }

  public async getBOMById(id: string) {
    const query = `
    SELECT 
      m.id AS material_id, 
      m.name AS material_name, 
      bom.quantity AS material_quantity, 
      m.unit AS material_unit, 
      m.threshold AS material_threshold
    FROM bom_components AS bom
    JOIN components c ON bom.component_id = c.id
    JOIN materials m ON bom.material_id = m.id
    WHERE c.id = $1
  `;

    const { rows } = await this.db.query(query, [id]);

    const result = {
      id: id,
      materials: rows.map((row) => ({
        id: row.material_id,
        name: row.material_name,
        quantity: row.material_quantity,
        unit: row.material_unit,
        threshold: row.material_threshold,
      })),
    };

    return result;
  }

  public async updateById(
    updateComponentDto: UpdateComponentDto,
    file?: Express.Multer.File,
  ) {
    const {
      id,
      category_id,
      name,
      price,
      color_primary_use,
      color_pattern_use,
      materials,
    } = updateComponentDto;

    const existingComponent = await this.findOneById(id);
    if (!existingComponent) {
      throw new HttpException('Component not found', HttpStatus.NOT_FOUND);
    }

    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      const updateComponentQuery = `
        UPDATE components
        SET category_id = $1, name = $2, price = $3, color_primary_use = $4, color_pattern_use = $5
        WHERE id = $6
        RETURNING *
      `;
      await client.query(updateComponentQuery, [
        category_id,
        name,
        price,
        color_primary_use,
        color_pattern_use,
        id,
      ]);

      await client.query('DELETE FROM bom_components WHERE component_id = $1', [
        id,
      ]);

      if (materials && materials.length > 0) {
        await this.insertBomComponents(client, id, materials);
      }

      await client.query('COMMIT');

      if (file) {
        await this.updateImg(id, file);
      }

      const updatedComponent = await this.findOneById(id);
      const updatedBOM = await this.getBOMById(id);

      return { ...updatedComponent, bom: updatedBOM };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error updating component:', error);
      throw new HttpException(
        'Failed to update component',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      client.release();
      return this.findOneById(id);
    }
  }

  public async deleteById(id: string) {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      const existingComponent = await this.findOneById(id);
      if (!existingComponent) {
        throw new HttpException('Component not found', HttpStatus.NOT_FOUND);
      }

      await client.query('DELETE FROM bom_components WHERE component_id = $1', [
        id,
      ]);

      if (existingComponent.img) {
        await this.uploadsService.deleteFile(existingComponent.img);
      }

      const deleteQuery = 'DELETE FROM components WHERE id = $1 RETURNING *';
      const { rows } = await client.query(deleteQuery, [id]);

      await client.query('COMMIT');

      if (rows.length === 0) {
        throw new HttpException(
          'Failed to delete component',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return {
        message: 'Component deleted successfully',
        deletedComponent: rows[0],
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error deleting component:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to delete component',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      client.release();
    }
  }
}
