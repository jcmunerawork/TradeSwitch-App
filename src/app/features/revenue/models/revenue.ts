/**
 * Enum representing the possible statuses of an order.
 *
 * @enum {string}
 */
export enum OrderStatus {
  Completed = 'Completed',
  Pending = 'Pending',
  Cancelled = 'Cancelled',
  Failed = 'Failed',
}

/**
 * Enum representing the possible statuses of a subscription.
 *
 * @enum {string}
 */
export enum SubscriptionStatus {
  Active = 'Active',
  Pending = 'Pending',
  Failed = 'Failed',
}

/**
 * Interface representing a summary of revenue data.
 *
 * Contains aggregated revenue metrics including gross revenue, returns, coupons,
 * net revenue, and total revenue.
 *
 * @interface RevenueSummary
 */
export interface RevenueSummary {
  grossRevenue: number;
  returns: number;
  coupons: number;
  netRevenue: number;
  totalRevenue: number;
}

/**
 * Interface representing a row in the revenue table.
 *
 * Contains daily revenue data including orders count, gross revenue, returns,
 * coupons, net sales, taxes, shipping, and total sales.
 *
 * @interface RevenueTableRow
 */
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

/**
 * Interface representing daily revenue data.
 *
 * Used for chart visualization showing revenue trends by day.
 *
 * @interface DailyRevenueData
 */
export interface DailyRevenueData {
  date: string;
  grossRevenue: number;
}

/**
 * Interface representing monthly revenue data.
 *
 * Used for chart visualization showing revenue trends by month.
 *
 * @interface MonthlyRevenueData
 */
export interface MonthlyRevenueData {
  year: number;
  month: number;
  grossRevenue: number;
}

/**
 * Interface representing yearly revenue data.
 *
 * Used for chart visualization showing revenue trends by year.
 *
 * @interface YearlyRevenueData
 */
export interface YearlyRevenueData {
  year: number;
  grossRevenue: number;
}

/**
 * Interface representing a row in the orders table.
 *
 * Contains order information including order ID, user, date, status, total,
 * affiliate referral, and origin.
 *
 * @interface OrderTableRow
 */
export interface OrderTableRow {
  orderId: string;
  user: string;
  date: string;
  status: OrderStatus;
  total: number;
  affiliateReferral: string | null;
  origin: string;
}

/**
 * Interface representing a row in the subscriptions table.
 *
 * Contains subscription information including status, subscription details,
 * items, total, dates, and order count.
 *
 * @interface SubscriptionTableRow
 */
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

/**
 * Interface representing filter criteria for revenue table.
 *
 * Used to filter revenue data by search term, order count, gross revenue, and total sales.
 *
 * @interface RevenueFilter
 */
export interface RevenueFilter {
  searchTerm?: string;
  minOrders?: number;
  maxOrders?: number;
  minGrossRevenue?: number;
  maxGrossRevenue?: number;
  minTotalSales?: number;
  maxTotalSales?: number;
}

/**
 * Interface representing filter criteria for orders table.
 *
 * Used to filter orders by search term, status, and total amount.
 *
 * @interface OrderFilter
 */
export interface OrderFilter {
  searchTerm?: string;
  status?: OrderStatus;
  minTotal?: number;
  maxTotal?: number;
}

/**
 * Interface representing filter criteria for subscriptions table.
 *
 * Used to filter subscriptions by search term, status, and total amount.
 *
 * @interface SubscriptionFilter
 */
export interface SubscriptionFilter {
  searchTerm?: string;
  status?: SubscriptionStatus;
  minTotal?: number;
  maxTotal?: number;
}
