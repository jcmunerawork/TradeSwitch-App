export enum UserStatus {
  PURCHASED = 'purchased',
  PENDING = 'pending',
  UNVERIFIED = 'unverified',
}

export interface overviewSubscriptionData {
  month: string;
  revenue: number;
  users: number;
}

export interface User {
  best_trade: number;
  birthday: string;
  firstName: string;
  id: string;
  lastName: string;
  email: string;
  netPnl: number;
  number_trades: number;
  phoneNumber: string;
  profit: number;
  status: UserStatus;
  strategy_followed: number;
  subscription_date: any;
  total_spend: number;
  tokenId: string;
}
