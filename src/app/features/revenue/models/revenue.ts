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
  orderId: string;
  user: string;
  date: string;
  status: OrderStatus;
  total: number;
  affiliateReferral: string | null;
  origin: string;
}

export interface SubscriptionTableRow {
  status: SubscriptionStatus;
  subscription: string;
  items: string;
  total: string;
  startDate: string;
  trialEnd: string;
  nextPayment: string;
  lastOrderDate: string;
  endDate: string;
  orders: number;
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
