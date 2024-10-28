import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import {
  DailyRevenue,
  DashboardSummary,
  DateRange,
  StockStatus,
} from '../interfaces/dashboard-data.interface';

interface DashboardData {
  summary: DashboardSummary;
  dailyRevenue: DailyRevenue[];
  stockStatus: StockStatus[];
}

@Injectable()
export class DashboardService {
  constructor(
    @Inject('PG_CONNECTION')
    private readonly db: Pool,
  ) {}

  public async getDashboardData(dateRange: DateRange): Promise<DashboardData> {
    try {
      const [summary, dailyRevenue, stockStatus] = await Promise.all([
        this.getSummary(dateRange),
        this.getDailyRevenue(dateRange.startDate, dateRange.endDate),
        this.getStockStatus(),
      ]);

      return {
        summary,
        dailyRevenue,
        stockStatus,
      };
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      throw new Error('Failed to fetch dashboard data');
    }
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

    return {
      revenue: {
        current: data.current_revenue,
        previous: data.previous_revenue,
        percentageChange: this.calculatePercentageChange(
          data.previous_revenue,
          data.current_revenue,
        ),
      },
      expense: {
        current: data.current_expense,
        previous: data.previous_expense,
        percentageChange: this.calculatePercentageChange(
          data.previous_expense,
          data.current_expense,
        ),
      },
      productsSold: {
        current: data.current_sold,
        previous: data.previous_sold,
        percentageChange: this.calculatePercentageChange(
          data.previous_sold,
          data.current_sold,
        ),
      },
      orders: {
        current: data.current_orders,
        previous: data.previous_orders,
        percentageChange: this.calculatePercentageChange(
          data.previous_orders,
          data.current_orders,
        ),
      },
    };
  }

  private async getDailyRevenue(
    startDate: Date,
    endDate: Date,
  ): Promise<DailyRevenue[]> {
    const query = `
      WITH RECURSIVE dates AS (
        SELECT $1::date as date
        UNION ALL
        SELECT date + 1
        FROM dates
        WHERE date < $2::date
      )
      SELECT 
        to_char(d.date, 'Dy') as day,
        COALESCE(SUM(CASE WHEN t.type = 'cpo' THEN t.amount ELSE 0 END), 0) as revenue,
        COALESCE(SUM(CASE WHEN t.type = 'mpo' THEN t.amount ELSE 0 END), 0) as expense
      FROM dates d
      LEFT JOIN transactions t ON 
        DATE(t.create_date_time) = d.date
      WHERE t.create_date_time IS NOT NULL
      GROUP BY d.date
      ORDER BY d.date
    `;

    const { rows } = await this.db.query(query, [startDate, endDate]);
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
          ELSE 'Normal'
        END as status
      FROM materials
      ORDER BY 
        CASE 
          WHEN quantity = 0 THEN 1
          WHEN quantity <= threshold THEN 2
          ELSE 3
        END,
        name
    `;

    const { rows } = await this.db.query(query);
    return rows;
  }

  private calculatePercentageChange(previous: number, current: number): number {
    if (previous === 0) return 0;
    return Number((((current - previous) / previous) * 100).toFixed(1));
  }

  public async getDashboardDataByTimeframe(
    timeframe: 'day' | 'week' | 'month' | 'year',
    date: Date,
  ): Promise<DashboardData> {
    const dateRange = this.getDateRange(timeframe, date);

    const [summary, dailyRevenue, stockStatus] = await Promise.all([
      this.getSummary(dateRange),
      this.getDailyRevenue(dateRange.startDate, dateRange.endDate),
      this.getStockStatus(),
    ]);

    return {
      summary,
      dailyRevenue,
      stockStatus,
    };
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
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        previousStartDate.setDate(startDate.getDate() - 1);
        previousEndDate.setDate(endDate.getDate() - 1);
        break;

      case 'week':
        // Get the start of the week (Sunday)
        startDate.setDate(date.getDate() - date.getDay());
        startDate.setHours(0, 0, 0, 0);

        // End of week (Saturday)
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);

        // Previous week
        previousStartDate.setDate(startDate.getDate() - 7);
        previousEndDate.setDate(endDate.getDate() - 7);
        break;

      case 'month':
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);

        endDate.setMonth(date.getMonth() + 1);
        endDate.setDate(0);
        endDate.setHours(23, 59, 59, 999);

        previousStartDate.setMonth(startDate.getMonth() - 1);
        previousEndDate.setMonth(endDate.getMonth() - 1);
        previousEndDate.setDate(0);
        break;

      case 'year':
        startDate.setMonth(0, 1);
        startDate.setHours(0, 0, 0, 0);

        endDate.setMonth(11, 31);
        endDate.setHours(23, 59, 59, 999);

        previousStartDate.setFullYear(startDate.getFullYear() - 1);
        previousEndDate.setFullYear(endDate.getFullYear() - 1);
        break;
    }

    return { startDate, endDate, previousStartDate, previousEndDate };
  }
}
