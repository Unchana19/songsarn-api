export interface DashboardData {
  summary: DashboardSummary;
  dailyRevenue: DailyRevenue[];
  stockStatus: StockStatus[];
  topSellers: TopSeller[];
  recentTransactions: Transaction[];
  unsoldProducts: UnsoldProduct[];
  purchaseOrders: PurchaseOrder[];
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

export interface TopSeller {
  product_id: string;
  product_name: string;
  category: string;
  quantity: number;
  price: number;
  total: number;
  image_url?: string;
}

export interface Transaction {
  transaction_id: string;
  po_id: string;
  method: string;
  amount: number;
  type: 'cpo' | 'mpo';
  date_time: Date;
}

export interface UnsoldProduct {
  product_id: string;
  name: string;
  category: string;
  price: number;
  image_url?: string;
  days_without_sale: number;
  days_without_sale_text: string;
}

export interface PurchaseOrder {
  order_id: string;
  product_quantity: number;
  total_amount: number;
  delivery_date: string | Date;
  status: string;
  payment_method: string;
}
