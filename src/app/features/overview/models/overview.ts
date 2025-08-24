import { Timestamp } from 'firebase/firestore';

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
  id: any;
  best_trade: number;
  birthday: Date;
  email: string;
  firstName: string;
  lastName: string;
  netPnl: number;
  number_trades: number;
  phoneNumber: string;
  profit: number;
  status: UserStatus;
  strategy_followed: number;
  subscription_date: Timestamp;
  tokenId: String;
  total_spend: number;
  isAdmin: boolean;
}
