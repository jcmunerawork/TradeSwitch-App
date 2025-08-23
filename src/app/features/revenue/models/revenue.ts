export interface RevenueSummary {
  grossRevenue: number;
  returns: number;
  coupons: number;
  netRevenue: number;
  totalRevenue: number;
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
