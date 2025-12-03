export enum OrderStatus {
  Completed = 'Completed',
  Pending = 'Pending',
  Cancelled = 'Cancelled',
  Failed = 'Failed',
}

export enum SubscriptionStatus {
  Active = 'Active',
  Pending = 'Pending',
  Failed = 'Failed',
}

// API Response Interfaces
export interface OrderApiItem {
  date: number; // timestamp
  value: number;
  concepto: string;
  status: string;
  paid: boolean;
  method: string;
}

export interface SubscriptionApiItem {
  status: string;
  canceladaAFinalDePeriodo: boolean;
  valor: number;
  item: string;
  user: string | null;
  startDate: number; // timestamp
  actualPeriodStart: number; // timestamp
  actualPeriodEnd: number; // timestamp
}

export interface RefundApiItem {
  created: number; // timestamp
  amount: number;
  destination: string;
  status: string; // pending, requires_action, succeeded, failed, or canceled
}

export interface RevenueApiResponse {
  grossRevenue: number;
  refunds: number;
  netRevenue: number;
  activeSubscriptions: number;
  mrr: number;
  currency: string;
  orders: OrderApiItem[];
  refundsTable: RefundApiItem[];
  subscriptions: SubscriptionApiItem[];
}

export interface RevenueSummary {
  grossRevenue: number;
  returns: number;
  coupons: number;
  netRevenue: number;
  totalRevenue: number;
}

export interface RevenueTableRow {
  date: string;
  orders: number;
  grossRevenue: number;
  returns: number;
  coupons: number;
  netSales: number;
  taxes: number;
  shipping: number;
  totalSales: number;
}

export interface RefundTableRow {
  created: string; // formatted date
  amount: number;
  destination: string;
  status: string; // formatted status
}

export interface DailyRevenueData {
  date: string;
  grossRevenue: number;
}

export interface MonthlyRevenueData {
  year: number;
  month: number;
  grossRevenue: number;
}

export interface YearlyRevenueData {
  year: number;
  grossRevenue: number;
}

export interface OrderTableRow {
  date: string; // formatted date
  value: number; // amount
  concepto: string;
  paid: boolean;
  method: string;
  status: string;
}

export interface SubscriptionTableRow {
  status: string;
  canceladaAFinalDePeriodo: boolean;
  valor: number;
  item: string;
  user: string | null;
  startDate: string; // formatted date
  actualPeriodStart: string; // formatted date
  actualPeriodEnd: string; // formatted date
}

export interface RevenueFilter {
  searchTerm?: string;
  minOrders?: number;
  maxOrders?: number;
  minGrossRevenue?: number;
  maxGrossRevenue?: number;
  minTotalSales?: number;
  maxTotalSales?: number;
}

export interface OrderFilter {
  searchTerm?: string;
  status?: OrderStatus;
  minTotal?: number;
  maxTotal?: number;
}

export interface SubscriptionFilter {
  searchTerm?: string;
  status?: SubscriptionStatus;
  minTotal?: number;
  maxTotal?: number;
}
