import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import {
  DailyRevenue,
  DashboardData,
  DashboardSummary,
  DateRange,
  PurchaseOrder,
  StockStatus,
  TopSeller,
  Transaction,
  UnsoldProduct,
} from '../interfaces/dashboard-data.interface';

@Injectable()
export class DashboardService {
  constructor(
    @Inject('PG_CONNECTION')
    private readonly db: Pool,
  ) {}

  public async getDashboardDataByTimeframe(
    timeframe: 'day' | 'week' | 'month' | 'year',
    date: Date,
  ): Promise<DashboardData> {
    const dateRange = this.getDateRange(timeframe, date);

    const [
      summary,
      dailyRevenue,
      forecastRevenue,
      stockStatus,
      topSellers,
      recentTransactions,
      unsoldProducts,
      purchaseOrders,
    ] = await Promise.all([
      this.getSummary(dateRange),
      this.getDailyRevenue(dateRange.startDate, dateRange.endDate, timeframe),
      this.getForecastRevenue(
        dateRange.startDate,
        dateRange.endDate,
        timeframe,
      ),
      this.getStockStatus(),
      this.getTopSellers(dateRange.startDate, dateRange.endDate),
      this.getRecentTransactions(dateRange.startDate, dateRange.endDate),
      this.getUnsoldProducts(),
      this.getRecentPurchaseOrders(),
    ]);

    const forecastMap = new Map();
    for (const forecast of forecastRevenue) {
      forecastMap.set(forecast.label, forecast);
    }

    const combinedForecastRevenue = dailyRevenue.map((daily) => {
      const forecast = forecastMap.get(daily.label) || {};
      return {
        label: daily.label,
        revenue: Number(daily.revenue || 0) + Number(forecast.forecast || 0),
      };
    });

    return {
      summary,
      dailyRevenue,
      forecastRevenue: combinedForecastRevenue,
      stockStatus,
      topSellers,
      recentTransactions,
      unsoldProducts,
      purchaseOrders,
    };
  }

  private async getSummary(dateRange: DateRange): Promise<DashboardSummary> {
    const query = `
      WITH revenue_data AS (
        SELECT 
          COALESCE(SUM(CASE 
            WHEN create_date_time >= $1 AND create_date_time < $2 AND type = 'cpo'
            THEN amount 
            ELSE 0 
          END), 0) as current_revenue,
          COALESCE(SUM(CASE 
            WHEN create_date_time >= $3 AND create_date_time < $4 AND type = 'cpo'
            THEN amount 
            ELSE 0 
          END), 0) as previous_revenue
        FROM transactions
        WHERE create_date_time IS NOT NULL
      ),
      expense_data AS (
        SELECT 
          COALESCE(SUM(CASE 
            WHEN create_date_time >= $1 AND create_date_time < $2 AND type = 'mpo'
            THEN amount 
            ELSE 0 
          END), 0) as current_expense,
          COALESCE(SUM(CASE 
            WHEN create_date_time >= $3 AND create_date_time < $4 AND type = 'mpo'
            THEN amount 
            ELSE 0 
          END), 0) as previous_expense
        FROM transactions
        WHERE create_date_time IS NOT NULL
      ),
      products_data AS (
        SELECT 
          COALESCE(SUM(CASE 
            WHEN cpo.paid_date_time >= $1 AND cpo.paid_date_time < $2
            THEN ol.quantity 
            ELSE 0 
          END), 0) as current_sold,
          COALESCE(SUM(CASE 
            WHEN cpo.paid_date_time >= $3 AND cpo.paid_date_time < $4
            THEN ol.quantity 
            ELSE 0 
          END), 0) as previous_sold
        FROM order_lines ol
        JOIN customer_purchase_orders cpo ON ol.order_id = cpo.id
        WHERE cpo.paid_date_time IS NOT NULL
      ),
      orders_data AS (
        SELECT 
          COUNT(CASE 
            WHEN h.date_time >= $1 AND h.date_time < $2
            THEN 1 
          END) as current_orders,
          COUNT(CASE 
            WHEN h.date_time >= $3 AND h.date_time < $4
            THEN 1 
          END) as previous_orders
        FROM customer_purchase_orders cpo
        JOIN history h ON h.cpo_id = cpo.id AND h.status = 'NEW'
      )
      SELECT 
        r.current_revenue,
        r.previous_revenue,
        e.current_expense,
        e.previous_expense,
        p.current_sold,
        p.previous_sold,
        o.current_orders,
        o.previous_orders
      FROM revenue_data r
      CROSS JOIN expense_data e
      CROSS JOIN products_data p
      CROSS JOIN orders_data o
    `;

    const {
      rows: [data],
    } = await this.db.query(query, [
      dateRange.startDate,
      dateRange.endDate,
      dateRange.previousStartDate,
      dateRange.previousEndDate,
    ]);

    const summary = {
      revenue: {
        current: Number(data.current_revenue),
        previous: Number(data.previous_revenue),
        percentageChange: this.calculatePercentageChange(
          Number(data.previous_revenue),
          Number(data.current_revenue),
        ),
      },
      expense: {
        current: Number(data.current_expense),
        previous: Number(data.previous_expense),
        percentageChange: this.calculatePercentageChange(
          Number(data.previous_expense),
          Number(data.current_expense),
        ),
      },
      productsSold: {
        current: Number(data.current_sold),
        previous: Number(data.previous_sold),
        percentageChange: this.calculatePercentageChange(
          Number(data.previous_sold),
          Number(data.current_sold),
        ),
      },
      orders: {
        current: Number(data.current_orders),
        previous: Number(data.previous_orders),
        percentageChange: this.calculatePercentageChange(
          Number(data.previous_orders),
          Number(data.current_orders),
        ),
      },
    };

    return summary;
  }

  private async getDailyRevenue(
    startDate: Date,
    endDate: Date,
    timeframe: 'day' | 'week' | 'month' | 'year',
  ): Promise<DailyRevenue[]> {
    let query = '';
    let params: Date[] = [];

    switch (timeframe) {
      case 'day':
        query = `
          WITH time_periods AS (
            SELECT period, period_start, period_end FROM (
              VALUES 
                ('Morning', '06:00:00', '11:59:59'),
                ('Afternoon', '12:00:00', '17:59:59'),
                ('Evening', '18:00:00', '23:59:59'),
                ('Night', '00:00:00', '05:59:59')
            ) as t(period, period_start, period_end)
          )
          SELECT 
            tp.period as label,
            COALESCE(SUM(t.amount), 0) as revenue
          FROM time_periods tp
          LEFT JOIN transactions t ON 
            t.create_date_time::date = $1::date AND
            t.type = 'cpo' AND
            to_char(t.create_date_time, 'HH24:MI:SS') >= tp.period_start AND
            to_char(t.create_date_time, 'HH24:MI:SS') <= tp.period_end
          GROUP BY tp.period
          ORDER BY 
            CASE tp.period
              WHEN 'Morning' THEN 1
              WHEN 'Afternoon' THEN 2
              WHEN 'Evening' THEN 3
              WHEN 'Night' THEN 4
            END
        `;
        params = [startDate];
        break;

      case 'week':
        query = `
          WITH RECURSIVE dates AS (
            SELECT $1::date as date
            UNION ALL
            SELECT date + 1
            FROM dates
            WHERE date < $2::date
          )
          SELECT 
            to_char(d.date, 'Dy') as label,
            COALESCE(SUM(t.amount), 0) as revenue
          FROM dates d
          LEFT JOIN transactions t ON 
            DATE(t.create_date_time) = d.date AND
            t.type = 'cpo'
          GROUP BY d.date
          ORDER BY d.date
        `;
        params = [startDate, endDate];
        break;

      case 'month':
        query = `
          WITH week_ranges AS (
            SELECT
              DATE_TRUNC('week', generate_series($1::date, $2::date, '1 week'::interval)) as week_start,
              DATE_TRUNC('week', generate_series($1::date, $2::date, '1 week'::interval)) + interval '6 days' as week_end
          )
          SELECT 
            'Week ' || TO_CHAR(week_start, 'W') as label,
            COALESCE(SUM(t.amount), 0) as revenue
          FROM week_ranges wr
          LEFT JOIN transactions t ON 
            DATE(t.create_date_time) >= wr.week_start AND
            DATE(t.create_date_time) <= wr.week_end AND
            t.type = 'cpo'
          GROUP BY week_start
          ORDER BY week_start
        `;
        params = [startDate, endDate];
        break;

      case 'year':
        query = `
          WITH months AS (
            SELECT generate_series(
              DATE_TRUNC('month', $1::date),
              DATE_TRUNC('month', $2::date),
              '1 month'::interval
            ) as month_start
          )
          SELECT 
            TO_CHAR(month_start, 'Mon') as label,
            COALESCE(SUM(t.amount), 0) as revenue
          FROM months m
          LEFT JOIN transactions t ON 
            DATE_TRUNC('month', t.create_date_time) = m.month_start AND
            t.type = 'cpo'
          GROUP BY month_start
          ORDER BY month_start
        `;
        params = [startDate, endDate];
        break;
    }

    const { rows } = await this.db.query(query, params);
    return rows;
  }

  private async getForecastRevenue(
    startDate: Date,
    endDate: Date,
    timeframe: 'day' | 'week' | 'month' | 'year',
  ): Promise<DailyRevenue[]> {
    let query = '';
    let params: Date[] = [];

    switch (timeframe) {
      case 'day':
        query = `
          WITH time_periods AS (
            SELECT period, period_start, period_end FROM (
              VALUES 
                ('Morning', '06:00:00', '11:59:59'),
                ('Afternoon', '12:00:00', '17:59:59'),
                ('Evening', '18:00:00', '23:59:59'),
                ('Night', '00:00:00', '05:59:59')
            ) as t(period, period_start, period_end)
          )
          SELECT 
            tp.period as label,
            COALESCE(SUM(
              CASE WHEN cpo.paid_date_time IS NOT NULL THEN
                (cpo.total_price - ((cpo.total_price - cpo.delivery_price) * 0.2 + cpo.delivery_price))
              ELSE 0 END
            ), 0) as forecast,
            COALESCE(SUM(t.amount), 0) as true_revenue
          FROM time_periods tp
          LEFT JOIN customer_purchase_orders cpo ON
            to_char(cpo.paid_date_time + INTERVAL '8 days', 'HH24:MI:SS') >= tp.period_start AND
            to_char(cpo.paid_date_time + INTERVAL '8 days', 'HH24:MI:SS') <= tp.period_end
          GROUP BY tp.period
          ORDER BY 
            CASE tp.period
              WHEN 'Morning' THEN 1
              WHEN 'Afternoon' THEN 2
              WHEN 'Evening' THEN 3
              WHEN 'Night' THEN 4
            END
        `;
        params = [startDate];
        break;

      case 'week':
        query = `
          WITH RECURSIVE dates AS (
            SELECT $1::date as date
            UNION ALL
            SELECT date + 1
            FROM dates
            WHERE date < $2::date
          )
          SELECT 
            to_char(d.date, 'Dy') as label,
            COALESCE(SUM(
              CASE WHEN cpo.status != 'NEW' THEN
                0.8 * (cpo.total_price - cpo.delivery_price)
              ELSE 0 END
            ), 0) as forecast
          FROM dates d
          LEFT JOIN customer_purchase_orders cpo ON 
            (cpo.paid_date_time + INTERVAL '8 days')::date = d.date
            AND cpo.paid_date_time IS NOT NULL
          GROUP BY d.date
          ORDER BY d.date
        `;
        params = [startDate, endDate];
        break;

      case 'month':
        query = `
          WITH week_ranges AS (
            SELECT
              DATE_TRUNC('week', generate_series($1::date, $2::date, '1 week'::interval)) as week_start,
              DATE_TRUNC('week', generate_series($1::date, $2::date, '1 week'::interval)) + interval '6 days' as week_end
          )
          SELECT 
            'Week ' || TO_CHAR(week_start, 'W') as label,
            COALESCE(SUM(
              CASE WHEN cpo.status != 'NEW' THEN
                (cpo.total_price - ((cpo.total_price - cpo.delivery_price) * 0.2 + cpo.delivery_price))
              ELSE 0 END
            ), 0) as forecast
          FROM week_ranges wr
          LEFT JOIN customer_purchase_orders cpo ON 
            (cpo.paid_date_time + INTERVAL '8 days')::date >= wr.week_start AND
            (cpo.paid_date_time + INTERVAL '8 days')::date <= wr.week_end
          GROUP BY week_start
          ORDER BY week_start
        `;
        params = [startDate, endDate];
        break;

      case 'year':
        query = `
          WITH months AS (
            SELECT generate_series(
              DATE_TRUNC('month', $1::date),
              DATE_TRUNC('month', $2::date),
              '1 month'::interval
            ) as month_start
          )
          SELECT 
            TO_CHAR(month_start, 'Mon') as label,
            COALESCE(SUM(
              CASE WHEN cpo.status != 'NEW' THEN
                (cpo.total_price - ((cpo.total_price - cpo.delivery_price) * 0.2 + cpo.delivery_price))
              ELSE 0 END
            ), 0) as forecast
          FROM months m
          LEFT JOIN customer_purchase_orders cpo ON 
            DATE_TRUNC('month', cpo.paid_date_time + INTERVAL '8 days') = m.month_start
          GROUP BY month_start
          ORDER BY month_start
        `;
        params = [startDate, endDate];
        break;
    }

    const { rows } = await this.db.query(query, params);
    return rows;
  }

  private async getStockStatus(): Promise<StockStatus[]> {
    const query = `
      SELECT 
        id,
        name,
        quantity as remaining_quantity,
        unit,
        CASE 
          WHEN quantity = 0 THEN 'Out'
          WHEN quantity <= threshold THEN 'Low'
          ELSE 'In stock'
        END as status
      FROM materials
      ORDER BY 
        CASE 
          WHEN quantity = 0 THEN 1
          WHEN quantity <= threshold THEN 2
          ELSE 3
        END,
        name
      LIMIT 7
    `;

    const { rows } = await this.db.query(query);
    return rows;
  }

  private calculatePercentageChange(previous: number, current: number): number {
    if (previous === 0 && current === 0) {
      return 0;
    }
    if (previous === 0 && current > 0) {
      return 100;
    }

    return Number((((current - previous) / previous) * 100).toFixed(1));
  }

  private getDateRange(
    timeframe: 'day' | 'week' | 'month' | 'year',
    date: Date,
  ): DateRange {
    const startDate = new Date(date);
    const endDate = new Date(date);
    const previousStartDate = new Date(date);
    const previousEndDate = new Date(date);

    switch (timeframe) {
      case 'day':
        // Current day
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);

        // Previous day
        previousStartDate.setDate(startDate.getDate() - 1);
        previousStartDate.setHours(0, 0, 0, 0);
        previousEndDate.setDate(endDate.getDate() - 1);
        previousEndDate.setHours(23, 59, 59, 999);
        break;

      case 'week': {
        // Current week (Sunday to Saturday)
        const dayOfWeek = startDate.getDay();
        startDate.setDate(date.getDate() - dayOfWeek); // Go to Sunday
        startDate.setHours(0, 0, 0, 0);

        endDate.setDate(startDate.getDate() + 6); // Go to Saturday
        endDate.setHours(23, 59, 59, 999);

        // Previous week
        previousStartDate.setDate(startDate.getDate() - 7);
        previousStartDate.setHours(0, 0, 0, 0);
        previousEndDate.setDate(endDate.getDate() - 7);
        previousEndDate.setHours(23, 59, 59, 999);
        break;
      }

      case 'month':
        // Current month
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);

        endDate.setMonth(startDate.getMonth() + 1, 0); // Last day of current month
        endDate.setHours(23, 59, 59, 999);

        // Previous month
        previousStartDate.setMonth(startDate.getMonth() - 1, 1); // First day of previous month
        previousStartDate.setHours(0, 0, 0, 0);
        previousEndDate.setMonth(startDate.getMonth(), 0); // Last day of previous month
        previousEndDate.setHours(23, 59, 59, 999);
        break;

      case 'year':
        // Current year
        startDate.setMonth(0, 1); // January 1st
        startDate.setHours(0, 0, 0, 0);

        endDate.setMonth(11, 31); // December 31st
        endDate.setHours(23, 59, 59, 999);

        // Previous year
        previousStartDate.setFullYear(startDate.getFullYear() - 1, 0, 1); // January 1st of previous year
        previousStartDate.setHours(0, 0, 0, 0);
        previousEndDate.setFullYear(endDate.getFullYear() - 1, 11, 31); // December 31st of previous year
        previousEndDate.setHours(23, 59, 59, 999);
        break;
    }

    return { startDate, endDate, previousStartDate, previousEndDate };
  }

  private async getTopSellers(
    startDate: Date,
    endDate: Date,
  ): Promise<TopSeller[]> {
    const query = `
      WITH top_products AS (
        SELECT 
          p.id as product_id,
          p.name as product_name,
          c.name as category,
          SUM(ol.quantity) as quantity,
          p.price,
          SUM(ol.quantity * p.price) as total,
          p.img
        FROM order_lines ol
        JOIN products p ON ol.product_id = p.id
        JOIN categories c ON p.category_id = c.id
        JOIN customer_purchase_orders cpo ON ol.order_id = cpo.id
        WHERE cpo.paid_date_time >= $1 
          AND cpo.paid_date_time < $2
          AND cpo.paid_date_time IS NOT NULL
        GROUP BY 
          p.id,
          p.name,
          c.name,
          p.price,
          p.img
        ORDER BY total DESC
        LIMIT 5
      )
      SELECT 
        product_id,
        product_name,
        category,
        quantity,
        price,
        total,
        img
      FROM top_products
    `;

    const { rows } = await this.db.query(query, [startDate, endDate]);

    return rows.map((row) => ({
      product_id: row.product_id,
      product_name: row.product_name,
      category: row.category,
      quantity: Number(row.quantity),
      price: Number(row.price),
      total: Number(row.total),
      image_url: row.img,
    }));
  }

  private async calculateTotalTopSellers(
    topSellers: TopSeller[],
  ): Promise<number> {
    return topSellers.reduce((sum, product) => sum + product.total, 0);
  }

  private async getRecentTransactions(
    startDate: Date,
    endDate: Date,
  ): Promise<Transaction[]> {
    const query = `
      SELECT 
        t.id as transaction_id,
        t.po_id,
        t.payment_method as method,
        t.amount,
        t.type,
        t.create_date_time as date_time
      FROM transactions t
      LEFT JOIN customer_purchase_orders cpo ON t.po_id = cpo.id
      LEFT JOIN material_purchase_orders mpo ON t.po_id = mpo.id
      WHERE t.create_date_time >= $1 
        AND t.create_date_time < $2
        AND t.create_date_time IS NOT NULL
      ORDER BY t.create_date_time DESC
      LIMIT 5
    `;

    const { rows } = await this.db.query(query, [startDate, endDate]);

    return rows.map((row) => ({
      transaction_id: row.transaction_id,
      po_id: row.po_id,
      method: row.method,
      amount: Number(row.amount),
      type: row.type,
      date_time: row.date_time,
    }));
  }

  private async getUnsoldProducts(): Promise<UnsoldProduct[]> {
    const query = `
    WITH last_sale AS (
      SELECT 
        p.id as product_id,
        MAX(cpo.paid_date_time) as last_sale_date
      FROM products p
      LEFT JOIN order_lines ol ON p.id = ol.product_id
      LEFT JOIN customer_purchase_orders cpo ON ol.order_id = cpo.id
        WHERE cpo.paid_date_time IS NOT NULL
      GROUP BY p.id
    )
    SELECT 
      p.id as product_id,
      p.name,
      c.name as category,
      p.price,
      p.img as image_url,
      CASE 
        WHEN ls.last_sale_date IS NULL THEN 
          'Never sold'
        ELSE
          EXTRACT(DAY FROM NOW() - ls.last_sale_date)::text || ' days'
      END as days_without_sale_text,
      CASE 
        WHEN ls.last_sale_date IS NULL THEN 
          999
        ELSE
          EXTRACT(DAY FROM NOW() - ls.last_sale_date)::integer
      END as days_without_sale
    FROM products p
    JOIN categories c ON p.category_id = c.id
    LEFT JOIN last_sale ls ON p.id = ls.product_id
    WHERE NOT EXISTS (
      SELECT 1 
      FROM order_lines ol
      JOIN customer_purchase_orders cpo ON ol.order_id = cpo.id
      WHERE ol.product_id = p.id
        AND cpo.paid_date_time >= NOW() - INTERVAL '30 days'
        AND cpo.paid_date_time IS NOT NULL
    )
        AND custom_by IS NULL
    ORDER BY days_without_sale DESC, p.price DESC
    LIMIT 5
  `;

    const { rows } = await this.db.query(query);

    return rows.map((row) => ({
      product_id: row.product_id,
      name: row.name,
      category: row.category,
      price: Number(row.price),
      image_url: row.image_url,
      days_without_sale: Number(row.days_without_sale),
      days_without_sale_text: row.days_without_sale_text,
    }));
  }

  private async getRecentPurchaseOrders(): Promise<PurchaseOrder[]> {
    const query = `
      WITH order_quantities AS (
        SELECT 
          order_id,
          SUM(quantity) as total_quantity
        FROM order_lines
        GROUP BY order_id
      ),
      latest_status AS (
        SELECT DISTINCT ON (cpo_id) 
          cpo_id,
          status,
          date_time
        FROM history
        ORDER BY cpo_id, date_time DESC
      ),
      delivery_dates AS (
        SELECT DISTINCT ON (cpo_id)
          cpo_id,
          date_time as delivery_date
        FROM history
        WHERE status = 'ON DELIVERY'
        ORDER BY cpo_id, date_time ASC
      )
      SELECT 
        cpo.id as order_id,
        oq.total_quantity as product_quantity,
        cpo.total_price as total_amount,
        CASE 
          WHEN ls.status IN ('ON DELIVERY', 'COMPLETED') THEN 
            to_char(dd.delivery_date, 'DD Mon YYYY')
          ELSE 
            cpo.est_delivery_date
        END as delivery_date,
        cpo.payment_method,
        ls.status
      FROM customer_purchase_orders cpo
      JOIN order_quantities oq ON cpo.id = oq.order_id
      JOIN latest_status ls ON cpo.id = ls.cpo_id
      LEFT JOIN delivery_dates dd ON cpo.id = dd.cpo_id
      WHERE cpo.status != 'CANCELLED'
      ORDER BY ls.date_time DESC
      LIMIT 5
    `;

    const { rows } = await this.db.query(query);

    return rows.map((row) => ({
      order_id: row.order_id,
      product_quantity: Number(row.product_quantity),
      total_amount: Number(row.total_amount),
      delivery_date: row.delivery_date,
      status: row.status,
      payment_method: row.payment_method,
    }));
  }
}
