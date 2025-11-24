/**
 * Enumeration of possible user statuses in the system.
 * 
 * Represents the different states a user account can have,
 * from creation to active use, cancellation, or administrative actions.
 * 
 * @enum UserStatus
 */
export enum UserStatus {
  ADMIN = 'admin',
  CREATED = 'created',
  PURCHASED = 'purchased',
  PENDING = 'pending',
  ACTIVE = 'active',
  PROCESSING = 'processing',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
  BANNED = 'banned',
}

/**
 * Interface representing subscription overview statistics.
 * 
 * Contains aggregated data about subscriptions for a specific month,
 * including revenue and user count.
 * 
 * Used in:
 * - OverviewComponent: Displays subscription statistics
 * - OverviewService: Fetches subscription data from Firebase
 * 
 * @interface overviewSubscriptionData
 */
export interface overviewSubscriptionData {
  month: string;
  revenue: number;
  users: number;
}

/**
 * Interface representing a user in the system.
 * 
 * Contains comprehensive user information including personal data,
 * trading statistics, account information, and subscription details.
 * 
 * Used throughout the overview module for displaying user data,
 * calculating statistics, and filtering users.
 * 
 * @interface User
 */
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
  subscription_date: number;
  lastUpdated: number;
  tokenId: string;
  total_spend: number;
  trading_accounts: number;
  strategies: number;
  isAdmin: boolean;
}
