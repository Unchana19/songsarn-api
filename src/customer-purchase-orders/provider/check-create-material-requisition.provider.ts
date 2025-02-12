import { Injectable, Inject } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CheckAndCreateMaterialRequisitionsProvider {
  constructor(
    @Inject('PG_CONNECTION')
    private readonly db: Pool,
  ) {}

  public async checkAndCreateMaterialRequisitions(
    cpoId: string,
    client: PoolClient,
  ) {
    try {
      const materialsQuery = `
        WITH color_usage AS (
          SELECT 
            cpo.id as cpo_id,
            bp.primary_color as material_id,
            SUM(c.color_primary_use * ol.quantity) as quantity_needed
          FROM customer_purchase_orders cpo
          JOIN order_lines ol ON cpo.id = ol.order_id
          JOIN products p ON ol.product_id = p.id
          JOIN bom_products bp ON p.id = bp.product_id
          JOIN components c ON bp.component_id = c.id
          WHERE cpo.id = $1 AND cpo.status = 'PAID'
          GROUP BY cpo.id, bp.primary_color
          
          UNION ALL
          
          SELECT 
            cpo.id as cpo_id,
            bp.pattern_color as material_id,
            SUM(c.color_pattern_use * ol.quantity) as quantity_needed
          FROM customer_purchase_orders cpo
          JOIN order_lines ol ON cpo.id = ol.order_id
          JOIN products p ON ol.product_id = p.id
          JOIN bom_products bp ON p.id = bp.product_id
          JOIN components c ON bp.component_id = c.id
          WHERE cpo.id = $1 AND cpo.status = 'PAID' AND bp.pattern_color IS NOT NULL
          GROUP BY cpo.id, bp.pattern_color
        ),
        material_usage AS (
          SELECT 
            cpo.id as cpo_id,
            bc.material_id,
            SUM(bc.quantity * ol.quantity) as quantity_needed
          FROM customer_purchase_orders cpo
          JOIN order_lines ol ON cpo.id = ol.order_id
          JOIN products p ON ol.product_id = p.id
          JOIN bom_products bp ON p.id = bp.product_id
          JOIN components c ON bp.component_id = c.id
          JOIN bom_components bc ON c.id = bc.component_id
          JOIN materials m ON bc.material_id = m.id
          WHERE cpo.id = $1 AND cpo.status = 'PAID' AND m.color IS NULL
          GROUP BY cpo.id, bc.material_id
        ),
        all_materials AS (
          SELECT * FROM color_usage WHERE material_id IS NOT NULL
          UNION ALL
          SELECT * FROM material_usage
        )
        SELECT 
          am.material_id,
          m.name as material_name,
          am.quantity_needed,
          m.quantity as available_quantity,
          GREATEST(am.quantity_needed - m.quantity, 0) as shortage_quantity
        FROM all_materials am
        JOIN materials m ON m.id = am.material_id
        WHERE am.quantity_needed > m.quantity
      `;

      const { rows: shortages } = await client.query(materialsQuery, [cpoId]);

      if (shortages.length > 0) {
        const checkExistingQuery = `
          SELECT material_id, quantity
          FROM material_requisitions
          WHERE material_id = ANY($1)
        `;

        const { rows: existingRequisitions } = await client.query(
          checkExistingQuery,
          [shortages.map((s) => s.material_id)],
        );

        const existingMap = new Map(
          existingRequisitions.map((r) => [r.material_id, r.quantity]),
        );

        const toInsert = [];
        const toUpdate = [];

        for (const shortage of shortages) {
          const existingQuantity = existingMap.get(shortage.material_id);
          if (existingQuantity === undefined) {
            toInsert.push(shortage);
          } else {
            toUpdate.push({
              ...shortage,
              currentQuantity: existingQuantity,
            });
          }
        }

        // Insert new requisitions
        if (toInsert.length > 0) {
          const insertValues = toInsert
            .map(
              (_, index) =>
                `($${index * 3 + 1}, $${index * 3 + 2}, $${index * 3 + 3}, NOW())`,
            )
            .join(', ');

          const insertParams = toInsert.flatMap((shortage) => [
            uuidv4(),
            shortage.material_id,
            shortage.shortage_quantity,
          ]);

          const insertQuery = `
            INSERT INTO material_requisitions (id, material_id, quantity, create_date_time)
            VALUES ${insertValues}
          `;

          await client.query(insertQuery, insertParams);
        }

        // Update existing requisitions
        for (const material of toUpdate) {
          const newQuantity =
            material.currentQuantity + material.shortage_quantity;
          const updateQuery = `
            UPDATE material_requisitions 
            SET quantity = $1, 
                create_date_time = NOW()
            WHERE material_id = $2
          `;

          await client.query(updateQuery, [newQuantity, material.material_id]);
        }

        return {
          success: true,
          message: 'Material requisitions created/updated successfully',
          shortages: shortages.map((shortage) => ({
            material_name: shortage.material_name,
            needed: shortage.quantity_needed,
            available: shortage.available_quantity,
            shortage: shortage.shortage_quantity,
          })),
        };
      }

      return {
        success: true,
        message: 'No material shortages found',
        shortages: [],
      };
    } catch (error) {
      console.error('Error checking materials:', error);
      throw error;
    }
  }
}
