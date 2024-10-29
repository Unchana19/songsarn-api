import { Inject, Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { CreateCPODto } from '../dtos/create-cpo.dto';
import { v4 as uuidv4 } from 'uuid';
import { OrderLineItemDto } from '../dtos/order-line-item.dto';
import { HistoryService } from 'src/history/providers/history.service';
import { CheckAndCreateMaterialRequisitionsProvider } from './check-create-material-requisition.provider';

@Injectable()
export class CustomerPurchaseOrdersService {
  constructor(
    @Inject('PG_CONNECTION')
    private readonly db: Pool,

    private readonly historyService: HistoryService,
    private readonly checkAndCreateMaterialRequisitionsProvider: CheckAndCreateMaterialRequisitionsProvider,
  ) {}

  public async create(createCpoDto: CreateCPODto) {
    const {
      user_id,
      delivery_price,
      address,
      total_price,
      phone_number,
      payment_method,
      order_lines,
    } = createCpoDto;

    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      const cpoId = uuidv4();
      const cpo = await this.insertCPO(client, {
        id: cpoId,
        user_id,
        delivery_price,
        address,
        total_price,
        phone_number,
        payment_method,
        est_delivery_date: this.getEstimatedDeliveryDateRange(),
      });

      await this.deleteOldOrderLines(client, user_id);

      const items = await this.insertOrderLines(client, cpoId, order_lines);

      await this.historyService.create({
        cpo_id: cpoId,
        status: 'NEW',
      });

      await client.query('COMMIT');

      return { ...cpo, items };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating CPO:', error);
      throw new Error('Failed to create Customer Purchase Order');
    } finally {
      client.release();
    }
  }

  private async insertCPO(
    client: PoolClient,
    data: {
      id: string;
      user_id: string;
      delivery_price: number;
      address: string;
      total_price: number;
      phone_number: string;
      payment_method: string;
      est_delivery_date: string;
    },
  ) {
    const query = `
      INSERT INTO customer_purchase_orders (
        id,
        user_id,
        status,
        delivery_price,
        address,
        total_price,
        phone_number,
        payment_method,
        est_delivery_date
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      data.id,
      data.user_id,
      'NEW',
      data.delivery_price,
      data.address,
      data.total_price,
      data.phone_number,
      data.payment_method,
      data.est_delivery_date,
    ];

    const result = await client.query(query, values);
    return result.rows[0];
  }

  private getEstimatedDeliveryDateRange(): string {
    const start = new Date();
    const end = new Date();

    start.setDate(start.getDate() + 6);
    end.setDate(end.getDate() + 8);

    const monthAbbr = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    const formatDate = (date: Date) => {
      const day = String(date.getDate()).padStart(2, '0');
      const month = monthAbbr[date.getMonth()];
      const year = date.getFullYear();

      return `${day} ${month} ${year}`;
    };

    return `${formatDate(start)} - ${formatDate(end)}`;
  }

  private async deleteOldOrderLines(client: PoolClient, userId: string) {
    const query = `
      DELETE FROM order_lines
      WHERE order_id IN (
        SELECT user_id FROM customer_purchase_orders
        WHERE user_id = $1
      )
    `;

    await client.query(query, [userId]);
  }

  private async insertOrderLines(
    client: PoolClient,
    cpoId: string,
    orderLines: OrderLineItemDto[],
  ) {
    const values = orderLines
      .map(
        (_, index) =>
          `($1, $${index * 3 + 2}, $${index * 3 + 3}, $${index * 3 + 4})`,
      )
      .join(', ');

    const params = [
      cpoId,
      ...orderLines.flatMap((item) => [
        uuidv4(),
        item.product_id,
        item.quantity,
      ]),
    ];

    const query = `
      INSERT INTO order_lines (order_id, id, product_id, quantity)
      VALUES ${values}
      RETURNING *
    `;

    const result = await client.query(query, params);
    return result.rows;
  }

  public async getAllCPOByUserId(id: string) {
    const query = `
      SELECT 
        cpo.id,
        cpo.paid_date_time,
        cpo.status,
        cpo.total_price,
        COALESCE(SUM(ol.quantity), 0) as quantity
      FROM customer_purchase_orders cpo
      LEFT JOIN order_lines ol ON cpo.id = ol.order_id
      LEFT JOIN history h ON cpo.id = h.cpo_id AND h.status = 'NEW'
      WHERE cpo.user_id = $1
      GROUP BY 
        cpo.id,
        cpo.paid_date_time,
        cpo.status,
        cpo.total_price,
        h.date_time
      ORDER BY h.date_time DESC
    `;

    const { rows } = await this.db.query(query, [id]);

    return rows;
  }

  public async managerGetAllCPO() {
    const query = `
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
        WHERE cpo.status = 'PAID'
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
        WHERE cpo.status = 'PAID' AND bp.pattern_color IS NOT NULL
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
        WHERE cpo.status = 'PAID' AND m.color IS NULL
        GROUP BY cpo.id, bc.material_id
      ),
      all_materials AS (
        SELECT * FROM color_usage WHERE material_id IS NOT NULL
        UNION ALL
        SELECT * FROM material_usage
      ),
      material_check AS (
        SELECT 
          am.cpo_id,
          am.material_id,
          m.name as material_name,
          am.quantity_needed,
          m.quantity as available_quantity
        FROM all_materials am
        JOIN materials m ON m.id = am.material_id
      )
      SELECT 
        cpo.id,
        cpo.status,
        cpo.total_price,
        cpo.est_delivery_date,
        cpo.paid_date_time,
        u.name as user_name,
        h.date_time as last_updated,
        CASE 
          WHEN cpo.status = 'PAID' THEN
            CASE 
              WHEN EXISTS (
                SELECT 1 
                FROM material_check mc
                WHERE mc.cpo_id = cpo.id 
                AND mc.quantity_needed > mc.available_quantity
              ) THEN 'insufficient_materials'
              WHEN NOT EXISTS (
                SELECT 1 
                FROM all_materials am
                WHERE am.cpo_id = cpo.id
              ) THEN 'no_materials_found'
              ELSE 'sufficient_materials'
            END
          ELSE NULL
        END as material_status,
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'material_name', mc.material_name,
              'needed', mc.quantity_needed,
              'available', mc.available_quantity,
              'is_sufficient', mc.quantity_needed <= mc.available_quantity
            )
          )
          FROM material_check mc
          WHERE mc.cpo_id = cpo.id
        ) as material_details
      FROM customer_purchase_orders cpo
      JOIN users u ON cpo.user_id = u.id
      LEFT JOIN (
        SELECT cpo_id, MAX(date_time) as max_date_time
        FROM history
        GROUP BY cpo_id
      ) latest_history ON cpo.id = latest_history.cpo_id
      LEFT JOIN history h ON h.cpo_id = latest_history.cpo_id 
        AND h.date_time = latest_history.max_date_time
      ORDER BY h.date_time DESC
    `;

    try {
      const { rows } = await this.db.query(query);

      return rows.map((row) => ({
        id: row.id,
        paid_date_time: row.paid_date_time,
        user_name: row.user_name,
        status: row.status,
        total_price: row.total_price,
        est_delivery_date: row.est_delivery_date,
        last_updated: row.last_updated,
        material_status: row.material_status,
        material_details: row.material_details,
      }));
    } catch (error) {
      console.error('Error getting all CPOs:', error);
      throw new Error('Failed to get Customer Purchase Orders');
    }
  }

  public async getCPOById(id: string) {
    const query = `
      SELECT 
        cpo.id,
        cpo.status,
        cpo.paid_date_time,
        cpo.est_delivery_date,
        cpo.delivery_price,
        cpo.address,
        cpo.phone_number,
        cpo.total_price,
        cpo.payment_method,
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', ol.id,
            'product_id', p.id,
            'name', p.name,
            'price', p.price,
            'quantity', ol.quantity,
            'image', p.img
          )
        ) as products
      FROM customer_purchase_orders cpo
      LEFT JOIN order_lines ol ON cpo.id = ol.order_id
      LEFT JOIN products p ON ol.product_id = p.id
      WHERE cpo.id = $1
      GROUP BY 
        cpo.id,
        cpo.status,
        cpo.paid_date_time,
        cpo.est_delivery_date,
        cpo.delivery_price,
        cpo.address,
        cpo.phone_number,
        cpo.total_price,
        cpo.payment_method
    `;

    try {
      const { rows } = await this.db.query(query, [id]);

      if (rows.length === 0) {
        throw new Error('Order not found');
      }

      const order = rows[0];
      let products = order.products;

      if (products.length === 1 && products[0] === null) {
        products = [];
      }

      return {
        cpo: {
          id: order.id,
          payment_status: order.paid_date_time ? 'Completed' : 'Not paid',
          order_status: order.status,
          delivery_date: order.est_delivery_date,
          payment_method: order.payment_method,
          delivery_details: {
            address: order.address,
            phone: order.phone_number,
          },
          delivery_price: order.delivery_price,
          total_price: order.total_price,
        },
        order_lines: products.map((product) => ({
          id: product.id,
          name: product.name,
          price: product.price,
          quantity: product.quantity,
          image: product.image,
        })),
      };
    } catch (error) {
      console.error('Error getting CPO:', error);
      throw new Error('Failed to get Customer Purchase Order');
    }
  }

  public async managerGetCPOById(id: string) {
    const query = `
      WITH delivering_date AS (
        SELECT date_time
        FROM history
        WHERE cpo_id = $1 AND status = 'ON DELIVERY'
        ORDER BY date_time DESC
        LIMIT 1
      ),
      latest_updated AS (
        SELECT cpo_id, MAX(date_time) as max_date_time
        FROM history
        WHERE cpo_id = $1
        GROUP BY cpo_id
      ),
      component_materials AS (
        SELECT 
          c.id as component_id,
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'name', m.name,
              'quantity', bc.quantity,
              'unit', m.unit
            )
          ) as materials
        FROM components c
        JOIN bom_components bc ON c.id = bc.component_id
        JOIN materials m ON bc.material_id = m.id
        GROUP BY c.id
      ),
      product_components AS (
        SELECT 
          p.id as product_id,
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', c.id,
              'name', c.name,
              'img', c.img,
              'primary_color', JSON_BUILD_OBJECT(
                'name', m1.name,
                'color', m1.color
              ),
              'pattern_color', JSON_BUILD_OBJECT(
                'name', m2.name,
                'color', m2.color
              ),
              'materials', cm.materials
            )
          ) as components
        FROM products p
        JOIN bom_products bp ON p.id = bp.product_id
        LEFT JOIN components c ON bp.component_id = c.id
        LEFT JOIN materials m1 ON bp.primary_color = m1.id
        LEFT JOIN materials m2 ON bp.pattern_color = m2.id
        LEFT JOIN component_materials cm ON c.id = cm.component_id
        GROUP BY p.id
      ),
      order_products AS (
        SELECT 
          ol.id,
          ol.quantity,
          JSON_BUILD_OBJECT(
            'id', p.id,
            'name', p.name,
            'img', p.img,
            'price', p.price,
            'components', COALESCE(pc.components, '[]')
          ) as product
        FROM order_lines ol
        LEFT JOIN products p ON ol.product_id = p.id
        LEFT JOIN product_components pc ON p.id = pc.product_id
        WHERE ol.order_id = $1
      )
      SELECT 
        cpo.id,
        cpo.status,
        cpo.paid_date_time,
        cpo.payment_method,
        cpo.est_delivery_date,
        cpo.delivery_price,
        cpo.total_price,
        COALESCE(dd.date_time, lu.max_date_time) as last_updated,
        cpo.address,
        cpo.phone_number,
        u.name as user_name,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', op.id,
              'quantity', op.quantity,
              'product', op.product
            )
          ) FILTER (WHERE op.id IS NOT NULL),
          '[]'
        ) as order_lines
      FROM customer_purchase_orders cpo
      JOIN users u ON cpo.user_id = u.id
      LEFT JOIN delivering_date dd ON TRUE
      JOIN latest_updated lu ON cpo.id = lu.cpo_id
      LEFT JOIN order_products op ON TRUE
      WHERE cpo.id = $1
      GROUP BY 
        cpo.id,
        cpo.status,
        cpo.paid_date_time,
        cpo.payment_method,
        cpo.est_delivery_date,
        dd.date_time,
        lu.max_date_time,
        cpo.address,
        cpo.phone_number,
        u.name
    `;

    try {
      const { rows } = await this.db.query(query, [id]);

      if (rows.length === 0) {
        throw new Error('Order not found');
      }

      const order = rows[0];
      return {
        id: order.id,
        status: order.status,
        user_name: order.user_name,
        last_updated: order.last_updated,
        paid_date_time: order.paid_date_time,
        payment_method: order.payment_method,
        est_delivery_date: order.est_delivery_date,
        delivery_price: order.delivery_price,
        total_price: order.total_price,
        delivery_details: {
          address: order.address,
          phone: order.phone_number,
        },
        order_lines: order.order_lines.map((line) => ({
          id: line.product.id,
          name: line.product.name,
          img: line.product.img,
          price: line.product.price,
          quantity: line.quantity,
          components: line.product.components,
        })),
      };
    } catch (error) {
      console.error('Error getting CPO:', error);
      throw new Error('Failed to get Customer Purchase Order');
    }
  }

  public async checkAndCreateMaterialRequisitions(
    cpo_id: string,
    client: PoolClient,
  ) {
    return this.checkAndCreateMaterialRequisitionsProvider.checkAndCreateMaterialRequisitions(
      cpo_id,
      client,
    );
  }

  private async getAllMaterialUsage(cpoId: string, client: PoolClient) {
    try {
      const materialsQuery = `
      WITH color_usage AS (
        SELECT 
          cpo.id as cpo_id,
          bp.primary_color as material_id,
          m.name as material_name,
          m.unit,
          SUM(c.color_primary_use * ol.quantity) as quantity_needed
        FROM customer_purchase_orders cpo
        JOIN order_lines ol ON cpo.id = ol.order_id
        JOIN products p ON ol.product_id = p.id
        JOIN bom_products bp ON p.id = bp.product_id
        JOIN components c ON bp.component_id = c.id
        JOIN materials m ON bp.primary_color = m.id
        WHERE cpo.id = $1
        GROUP BY cpo.id, bp.primary_color, m.name, m.unit
        
        UNION ALL
        
        SELECT 
          cpo.id as cpo_id,
          bp.pattern_color as material_id,
          m.name as material_name,
          m.unit,
          SUM(c.color_pattern_use * ol.quantity) as quantity_needed
        FROM customer_purchase_orders cpo
        JOIN order_lines ol ON cpo.id = ol.order_id
        JOIN products p ON ol.product_id = p.id
        JOIN bom_products bp ON p.id = bp.product_id
        JOIN components c ON bp.component_id = c.id
        JOIN materials m ON bp.pattern_color = m.id
        WHERE cpo.id = $1 AND bp.pattern_color IS NOT NULL
        GROUP BY cpo.id, bp.pattern_color, m.name, m.unit
      ),
      material_usage AS (
        SELECT 
          cpo.id as cpo_id,
          bc.material_id,
          m.name as material_name,
          m.unit,
          SUM(bc.quantity * ol.quantity) as quantity_needed
        FROM customer_purchase_orders cpo
        JOIN order_lines ol ON cpo.id = ol.order_id
        JOIN products p ON ol.product_id = p.id
        JOIN bom_products bp ON p.id = bp.product_id
        JOIN components c ON bp.component_id = c.id
        JOIN bom_components bc ON c.id = bc.component_id
        JOIN materials m ON bc.material_id = m.id
        WHERE cpo.id = $1 AND m.color IS NULL
        GROUP BY cpo.id, bc.material_id, m.name, m.unit
      )
      SELECT 
        material_id,
        material_name,
        unit,
        quantity_needed
      FROM (
        SELECT * FROM color_usage WHERE material_id IS NOT NULL
        UNION ALL
        SELECT * FROM material_usage
      ) all_materials`;

      const { rows: materials } = await client.query(materialsQuery, [cpoId]);

      console.log('Material usage results:', materials);

      return materials;
    } catch (error) {
      console.error('Error getting material usage:', error);
      throw error;
    }
  }

  public async deductMaterialQuantities(cpoId: string, client: PoolClient) {
    try {
      const materials = await this.getAllMaterialUsage(cpoId, client);

      console.log('Materials to deduct:', materials); // Log เพื่อตรวจสอบ

      if (materials.length === 0) {
        return {
          success: true,
          message: 'No materials to deduct',
          materials: [],
        };
      }

      const updatedMaterials = [];
      for (const material of materials) {
        console.log('Processing material:', material); // Log เพื่อตรวจสอบแต่ละ material

        if (!material.material_id) {
          console.log('Missing material_id for:', material);
          continue;
        }

        const updateQuery = `
          UPDATE materials
          SET quantity = GREATEST(0, quantity - $1)
          WHERE id = $2
          RETURNING id, name, quantity as remaining_quantity;
        `;

        const { rows } = await client.query(updateQuery, [
          material.quantity_needed,
          material.material_id,
        ]);

        console.log('Update result:', rows); // Log ผลลัพธ์การ update

        if (rows.length > 0) {
          updatedMaterials.push({
            name: material.material_name,
            used_quantity: material.quantity_needed,
            remaining_quantity: rows[0].remaining_quantity,
            unit: material.unit,
          });
        }
      }

      return {
        success: true,
        message: 'Material quantities deducted successfully',
        materials: updatedMaterials,
      };
    } catch (error) {
      console.error('Error deducting material quantities:', error);
      throw error;
    }
  }

  public async processCPOById(id: string) {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      const checkQuery = `
        SELECT id, status 
        FROM customer_purchase_orders 
        WHERE id = $1 AND status = 'PAID'
      `;

      const {
        rows: [existingCPO],
      } = await client.query(checkQuery, [id]);

      if (!existingCPO) {
        throw new Error('Order not found or not in PAID status');
      }

      const deductionResult = await this.deductMaterialQuantities(id, client);

      const updateQuery = `
        UPDATE customer_purchase_orders 
        SET status = 'PROCESSING'
        WHERE id = $1
        RETURNING id, status
      `;

      await client.query(updateQuery, [id]);

      await this.historyService.create({
        cpo_id: id,
        status: 'PROCESSING',
      });

      await client.query('COMMIT');

      return {
        success: true,
        message: 'CPO processed successfully',
        cpo_id: id,
        new_status: 'PROCESSING',
        material_updates: deductionResult.materials,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error processing CPO:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  public async finishedProcessCPOById(id: string) {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      const updateQuery = `
        UPDATE customer_purchase_orders 
        SET status = 'FINISHED PROCESS'
        WHERE id = $1
        RETURNING id, status
      `;

      const {
        rows: [updatedCpo],
      } = await client.query(updateQuery, [id]);

      if (!updatedCpo) {
        throw new Error('Order not found');
      }

      await this.historyService.create({
        cpo_id: id,
        status: 'FINISHED PROCESS',
      });

      await client.query('COMMIT');

      return {
        success: true,
        message: 'CPO finished process successfully',
        cpo_id: id,
        new_status: 'FINISHED PROCESS',
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error finished process CPO:', error);
      throw new Error('Failed to process Customer Purchase Order');
    } finally {
      client.release();
    }
  }

  public async deliveryCPOById(id: string) {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      const updateQuery = `
        UPDATE customer_purchase_orders 
        SET status = 'ON DELIVERY'
        WHERE id = $1
        RETURNING id, status
      `;

      const {
        rows: [updatedCpo],
      } = await client.query(updateQuery, [id]);

      if (!updatedCpo) {
        throw new Error('Order not found');
      }

      await this.historyService.create({
        cpo_id: id,
        status: 'ON DELIVERY',
      });

      await client.query('COMMIT');

      return {
        success: true,
        message: 'CPO delivering successfully',
        cpo_id: id,
        new_status: 'ON DELIVERY',
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error delivering CPO:', error);
      throw new Error('Failed to process Customer Purchase Order');
    } finally {
      client.release();
    }
  }

  public async deliveryCompletedCPOById(id: string) {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      const updateQuery = `
        UPDATE customer_purchase_orders 
        SET status = 'COMPLETED'
        WHERE id = $1
        RETURNING id, status
      `;

      const {
        rows: [updatedCpo],
      } = await client.query(updateQuery, [id]);

      if (!updatedCpo) {
        throw new Error('Order not found');
      }

      await this.historyService.create({
        cpo_id: id,
        status: 'COMPLETED',
      });

      await client.query('COMMIT');

      return {
        success: true,
        message: 'CPO completed successfully',
        cpo_id: id,
        new_status: 'COMPLETED',
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error completed CPO:', error);
      throw new Error('Failed to process Customer Purchase Order');
    } finally {
      client.release();
    }
  }

  public async checkAndCancelExpiredCPOs() {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // ค้นหา CPO ที่มีสถานะ NEW และเกิน 2 วัน
      const findExpiredQuery = `
        WITH latest_history AS (
          SELECT 
            cpo_id,
            MAX(date_time) as last_update
          FROM history
          WHERE status = 'NEW'
          GROUP BY cpo_id
        )
        SELECT 
          cpo.id
        FROM customer_purchase_orders cpo
        JOIN latest_history lh ON cpo.id = lh.cpo_id
        WHERE 
          cpo.status = 'NEW'
          AND lh.last_update < NOW() - INTERVAL '2 days'
      `;

      const { rows: expiredCPOs } = await client.query(findExpiredQuery);

      // ถ้าไม่มี CPO ที่ต้องยกเลิก
      if (expiredCPOs.length === 0) {
        await client.query('COMMIT');
        return {
          success: true,
          message: 'No expired CPOs found',
          cancelledCount: 0,
        };
      }

      // อัปเดตสถานะเป็น CANCELLED สำหรับ CPO ที่หมดอายุ
      const updateQuery = `
        UPDATE customer_purchase_orders 
        SET status = 'CANCELLED'
        WHERE id = ANY($1)
        RETURNING id
      `;

      const expiredCPOIds = expiredCPOs.map((cpo) => cpo.id);
      await client.query(updateQuery, [expiredCPOIds]);

      // บันทึกประวัติการยกเลิกสำหรับแต่ละ CPO
      for (const cpoId of expiredCPOIds) {
        await this.historyService.create({
          cpo_id: cpoId,
          status: 'CANCELLED',
        });
      }

      await client.query('COMMIT');

      return {
        success: true,
        message: `Successfully cancelled ${expiredCPOIds.length} expired CPOs`,
        cancelledCount: expiredCPOIds.length,
        cancelledCPOIds: expiredCPOIds,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error cancelling expired CPOs:', error);
      throw new Error('Failed to cancel expired Customer Purchase Orders');
    } finally {
      client.release();
    }
  }
}
