export interface DashboardData {
  summary: DashboardSummary;
  dailyRevenue: DailyRevenue[];
  stockStatus: StockStatus[];
}

export interface DashboardSummary {
  revenue: {
    current: number;
    previous: number;
    percentageChange: number;
  };
  expense: {
    current: number;
    previous: number;
    percentageChange: number;
  };
  productsSold: {
    current: number;
    previous: number;
    percentageChange: number;
  };
  orders: {
    current: number;
    previous: number;
    percentageChange: number;
  };
}

export interface DailyRevenue {
  day: string;
  revenue: number;
}

export interface StockStatus {
  id: string;
  name: string;
  remaining_quantity: number;
  unit: string;
  status: 'Out' | 'Low' | 'Normal';
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
  previousStartDate: Date;
  previousEndDate: Date;
}
