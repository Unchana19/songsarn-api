import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { CreateRequisitionDto } from '../dtos/create-requisition.dto';
import { v4 as uuidv4 } from 'uuid';
import { UpdateRequisitionDto } from '../dtos/update-requisition.dto';

@Injectable()
export class RequisitionsService {
  constructor(
    @Inject('PG_CONNECTION')
    private readonly db: Pool,
  ) {}

  public async create(createRequisitionDto: CreateRequisitionDto) {
    const { materialId, quantity } = createRequisitionDto;

    const existingRequisition = await this.findOneByMaterialId(materialId);

    let material;

    if (existingRequisition) {
      material = this.updateByMaterialId(createRequisitionDto);
    } else {
      const id = uuidv4();

      await this.db.query(
        'INSERT INTO material_requisitions (id, material_id, quantity, create_date_time) VALUES ($1, $2, $3, $4) RETURNING *',
        [id, materialId, quantity, new Date()],
      );

      material = this.findOneById(id);
    }

    return material;
  }

  public async findOneById(id: string) {
    const query = `
      SELECT id, material_id, quantity, create_date_time
      FROM material_requisitions
      WHERE id = $1
    `;

    const { rows } = await this.db.query(query, [id]);

    return rows.length > 0 ? rows[0] : null;
  }

  public async findOneByMaterialId(materialId: string) {
    const query = `
      SELECT id, material_id, quantity, create_date_time
      FROM material_requisitions
      WHERE material_id = $1
    `;

    const { rows } = await this.db.query(query, [materialId]);

    return rows.length > 0 ? rows[0] : null;
  }

  public async updateByMaterialId(updateRequisitionDto: UpdateRequisitionDto) {
    const { materialId, quantity } = updateRequisitionDto;

    const requisition = await this.findOneByMaterialId(materialId);
    const newQuantity = requisition.quantity + quantity;

    const query = `
    UPDATE material_requisitions
    SET quantity = $1, create_date_time = $2
    WHERE material_id = $3
    RETURNING id, material_id, quantity, create_date_time
  `;

    const { rows } = await this.db.query(query, [
      newQuantity,
      new Date(),
      materialId,
    ]);

    return rows[0];
  }

  public async getAllRequisition() {
    const query = `
    SELECT mr.id, m.id AS material_id, m.name AS material_name, m.unit AS unit, mr.quantity, create_date_time
    FROM material_requisitions AS mr
    JOIN materials m ON mr.material_id = m.id
  `;

    const { rows } = await this.db.query(query);

    return rows;
  }

  public async deleteManyById(id: string[]) {
    const query = `
    DELETE FROM material_requisitions
    WHERE id = ANY($1::character varying[])
    RETURNING id, material_id, quantity, create_date_time
  `;

    const { rows } = await this.db.query(query, [id]);

    return rows;
  }
}
