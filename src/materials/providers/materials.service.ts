import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { CreateMaterialDto } from '../dtos/create-material.dto';
import { v4 as uuidv4 } from 'uuid';
import { UpdateMaterialDto } from '../dtos/update-material.dto';

@Injectable()
export class MaterialsService {
  constructor(
    @Inject('PG_CONNECTION')
    private readonly db: Pool,
  ) {}

  public async create(createMaterialDto: CreateMaterialDto) {
    const { name, quantity, threshold, unit, color } = createMaterialDto;

    const existingMaterial = await this.findOneByName(name);

    if (existingMaterial) {
      throw new HttpException(
        'Material already exists',
        HttpStatus.BAD_REQUEST,
      );
    }

    const id = uuidv4();

    await this.db.query(
      'INSERT INTO materials (id, name, quantity, threshold, unit, color) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [id, name, quantity, threshold, unit, color],
    );

    const material = this.findOneById(id);

    return material;
  }

  public async findOneById(id: string) {
    const query = `
      SELECT id, name, quantity, threshold, unit, color
      FROM materials
      WHERE id = $1
    `;

    const { rows } = await this.db.query(query, [id]);

    return rows.length > 0 ? rows[0] : null;
  }

  public async findOneByName(name: string) {
    const query = `
      SELECT id, name, quantity, threshold, unit, color
      FROM materials
      WHERE name = $1
    `;

    const { rows } = await this.db.query(query, [name]);

    return rows.length > 0 ? rows[0] : null;
  }

  public async getAllMaterials() {
    const query = `
    SELECT id, name, quantity, threshold, unit, color
    FROM materials
  `;

    const { rows } = await this.db.query(query);

    return rows;
  }

  public async updateById(updateMaterialDto: UpdateMaterialDto) {
    const { id, name, quantity, threshold, unit, color } = updateMaterialDto;

    const existingMaterial = await this.findOneById(id);

    if (!existingMaterial) {
      throw new HttpException('Material not found', HttpStatus.NOT_FOUND);
    }

    const query = `
    UPDATE materials
    SET name = $1, quantity = $2, threshold = $3, unit = $4, color = $5
    WHERE id = $6
    RETURNING id, name, quantity, threshold, unit, color
  `;

    const { rows } = await this.db.query(query, [
      name,
      quantity,
      threshold,
      unit,
      color,
      id,
    ]);

    return rows[0];
  }

  public async deleteById(id: string) {
    const existingMaterial = await this.findOneById(id);

    if (!existingMaterial) {
      throw new HttpException('Material not found', HttpStatus.NOT_FOUND);
    }

    await this.db.query('DELETE FROM materials WHERE id = $1', [id]);

    return { message: 'Material deleted successfully' };
  }

  public async updateQuantityById(id: string, quantity: number) {
    const query = `
    UPDATE materials
    SET quantity = quantity + $1
    WHERE id = $2
    RETURNING id, name, quantity, threshold, unit, color
  `;

    const { rows } = await this.db.query(query, [quantity, id]);

    return rows[0];
  }

  public async getAllColors() {
    const query = `
      SELECT id, name, color
      FROM materials
      WHERE color IS NOT NULL
  `;

    const { rows } = await this.db.query(query);

    return rows;
  }
}
