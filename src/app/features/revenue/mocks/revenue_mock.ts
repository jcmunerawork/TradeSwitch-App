import {
  DailyRevenueData,
  MonthlyRevenueData,
  OrderStatus,
  OrderTableRow,
  RevenueSummary,
  RevenueTableRow,
  SubscriptionStatus,
  SubscriptionTableRow,
  YearlyRevenueData,
} from '../models/revenue';

/**
 * Mock data for revenue summary.
 *
 * Used for development and testing purposes. Contains aggregated revenue metrics.
 *
 * @constant mockRevenueSummary
 * @type {RevenueSummary}
 */
export const mockRevenueSummary: RevenueSummary = {
  grossRevenue: 45750,
  returns: 56,
  coupons: 1870,
  netRevenue: 24780,
  totalRevenue: 24780,
};

/**
 * Mock data for daily revenue.
 *
 * Contains daily revenue data for a month (August 2025).
 * Used for chart visualization in development.
 *
 * @constant dailyRevenueMock
 * @type {DailyRevenueData[]}
 */
export const dailyRevenueMock: DailyRevenueData[] = [
  { date: '2025-08-01', grossRevenue: 400 },
  { date: '2025-08-02', grossRevenue: 700 },
  { date: '2025-08-03', grossRevenue: 1100 },
  { date: '2025-08-04', grossRevenue: 1700 },
  { date: '2025-08-05', grossRevenue: 3000 },
  { date: '2025-08-06', grossRevenue: 2350 },
  { date: '2025-08-07', grossRevenue: 900 },
  { date: '2025-08-08', grossRevenue: 1200 },
  { date: '2025-08-09', grossRevenue: 1500 },
  { date: '2025-08-10', grossRevenue: 1800 },
  { date: '2025-08-11', grossRevenue: 400 },
  { date: '2025-08-12', grossRevenue: 700 },
  { date: '2025-08-13', grossRevenue: 1100 },
  { date: '2025-08-14', grossRevenue: 1700 },
  { date: '2025-08-15', grossRevenue: 3000 },
  { date: '2025-08-16', grossRevenue: 2350 },
  { date: '2025-08-17', grossRevenue: 900 },
  { date: '2025-08-18', grossRevenue: 1200 },
  { date: '2025-08-19', grossRevenue: 1500 },
  { date: '2025-08-20', grossRevenue: 1800 },
  { date: '2025-08-21', grossRevenue: 400 },
  { date: '2025-08-22', grossRevenue: 700 },
  { date: '2025-08-23', grossRevenue: 1100 },
  { date: '2025-08-24', grossRevenue: 1700 },
  { date: '2025-08-25', grossRevenue: 3000 },
  { date: '2025-08-26', grossRevenue: 2350 },
  { date: '2025-08-27', grossRevenue: 900 },
  { date: '2025-08-28', grossRevenue: 1200 },
  { date: '2025-08-29', grossRevenue: 1500 },
  { date: '2025-08-30', grossRevenue: 1800 },
  { date: '2025-08-31', grossRevenue: 1800 },
];

/**
 * Mock data for monthly revenue.
 *
 * Contains monthly revenue data for the year 2025.
 * Used for chart visualization in development.
 *
 * @constant monthlyRevenueMock
 * @type {MonthlyRevenueData[]}
 */
export const monthlyRevenueMock: MonthlyRevenueData[] = [
  { year: 2025, month: 1, grossRevenue: 21000 },
  { year: 2025, month: 2, grossRevenue: 19800 },
  { year: 2025, month: 3, grossRevenue: 23050 },
  { year: 2025, month: 4, grossRevenue: 25500 },
  { year: 2025, month: 5, grossRevenue: 24800 },
  { year: 2025, month: 6, grossRevenue: 26706.52 },
  { year: 2025, month: 7, grossRevenue: 28000 },
  { year: 2025, month: 8, grossRevenue: 29000 },
  { year: 2025, month: 9, grossRevenue: 30000 },
  { year: 2025, month: 10, grossRevenue: 31000 },
  { year: 2025, month: 11, grossRevenue: 32000 },
  { year: 2025, month: 12, grossRevenue: 33000 },
];

/**
 * Mock data for revenue table.
 *
 * Contains sample revenue table rows with daily revenue breakdown.
 * Used for table display in development.
 *
 * @constant revenueTableMock
 * @type {RevenueTableRow[]}
 */
export const revenueTableMock: RevenueTableRow[] = [
  {
    date: 'June 23,2025',
    orders: 2,
    grossRevenue: 665.0,
    returns: 0.0,
    coupons: 52.0,
    netSales: 603.0,
    taxes: 0.0,
    shipping: 0.0,
    totalSales: 603.0,
  },
  {
    date: 'June 22,2025',
    orders: 2,
    grossRevenue: 377.5,
    returns: 0.0,
    coupons: 0.0,
    netSales: 377.5,
    taxes: 0.0,
    shipping: 0.0,
    totalSales: 377.5,
  },
  {
    date: 'June 21,2025',
    orders: 0,
    grossRevenue: 0.0,
    returns: 0.0,
    coupons: 0.0,
    netSales: 0.0,
    taxes: 0.0,
    shipping: 0.0,
    totalSales: 0.0,
  },
  {
    date: 'June 20,2025',
    orders: 3,
    grossRevenue: 189.0,
    returns: 0.0,
    coupons: 7.0,
    netSales: 182.0,
    taxes: 0.0,
    shipping: 0.0,
    totalSales: 182.0,
  },
  {
    date: 'June 19,2025',
    orders: 0,
    grossRevenue: 0.0,
    returns: 0.0,
    coupons: 0.0,
    netSales: 0.0,
    taxes: 0.0,
    shipping: 0.0,
    totalSales: 0.0,
  },
];

/**
 * Mock data for orders table.
 *
 * Contains sample order rows with order details.
 * Used for orders table display in development.
 *
 * @constant orderTableMock
 * @type {OrderTableRow[]}
 */
export const orderTableMock: OrderTableRow[] = [
  {
    orderId: '#3686',
    user: 'Andrés Valdes',
    date: '3 hours ago',
    status: OrderStatus.Completed,
    total: 127.0,
    affiliateReferral: '#532',
    origin: 'Referral:Tx3funding.com',
  },
  {
    orderId: '#3686',
    user: 'Marvin McKinney',
    date: '3 hours ago',
    status: OrderStatus.Pending,
    total: 127.0,
    affiliateReferral: null,
    origin: 'Referral:Tx3funding.com',
  },
  {
    orderId: '#3686',
    user: 'Guy Hawkins',
    date: '5 hours ago',
    status: OrderStatus.Completed,
    total: 127.0,
    affiliateReferral: '#532',
    origin: 'Referral:Tx3funding.com',
  },
  {
    orderId: '#3686',
    user: 'Ralph Edwards',
    date: '6 hours ago',
    status: OrderStatus.Cancelled,
    total: 127.0,
    affiliateReferral: '#532',
    origin: 'Referral:Tx3funding.com',
  },
  {
    orderId: '#3686',
    user: 'Jenny Wilson',
    date: '6 hours ago',
    status: OrderStatus.Failed,
    total: 127.0,
    affiliateReferral: '#532',
    origin: 'Referral:Tx3funding.com',
  },
];

/**
 * Mock data for subscriptions table.
 *
 * Contains sample subscription rows with subscription details.
 * Used for subscriptions table display in development.
 *
 * @constant subscriptionTableMock
 * @type {SubscriptionTableRow[]}
 */
export const subscriptionTableMock: SubscriptionTableRow[] = [
  {
    status: SubscriptionStatus.Active,
    subscription: '#3686 Andrés Valdes',
    items: 'Pro Model',
    total: '$157.00/month',
    startDate: '3 hours ago',
    trialEnd: '-',
    nextPayment: 'July 23, 2025',
    lastOrderDate: '-',
    endDate: '-',
    orders: 1,
  },
  {
    status: SubscriptionStatus.Pending,
    subscription: '#3686 Andrés Valdes',
    items: 'Pro Model',
    total: '$157.00/month',
    startDate: '3 hours ago',
    trialEnd: '-',
    nextPayment: 'July 23, 2025',
    lastOrderDate: '-',
    endDate: '-',
    orders: 1,
  },
  {
    status: SubscriptionStatus.Active,
    subscription: '#3686 Andrés Valdes',
    items: 'Pro Model',
    total: '$157.00/month',
    startDate: '3 hours ago',
    trialEnd: '-',
    nextPayment: 'July 23, 2025',
    lastOrderDate: '-',
    endDate: '-',
    orders: 1,
  },
  {
    status: SubscriptionStatus.Failed,
    subscription: '#3686 Andrés Valdes',
    items: 'Pro Model',
    total: '$157.00/month',
    startDate: '3 hours ago',
    trialEnd: '-',
    nextPayment: 'July 23, 2025',
    lastOrderDate: '-',
    endDate: '-',
    orders: 1,
  },
  {
    status: SubscriptionStatus.Active,
    subscription: '#3686 Andrés Valdes',
    items: 'Pro Model',
    total: '$157.00/month',
    startDate: '3 hours ago',
    trialEnd: '-',
    nextPayment: 'July 23, 2025',
    lastOrderDate: '-',
    endDate: '-',
    orders: 1,
  },
];
