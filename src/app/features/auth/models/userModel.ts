/**
 * Auth feature: user and account data models.
 *
 * UserCredentials for login/signup; AccountData for trading account documents
 * (used by add-account and auth/account flows).
 */
import { Timestamp } from 'firebase/firestore';

/** Email and password for login or signup. */
export interface UserCredentials {
  email: string;
  password: string;
}

/** Trading account document: broker, server, account ids, optional balance/metrics, createdAt. */
export interface AccountData {
  id: string;
  userId: string;
  emailTradingAccount: string;
  brokerPassword: string;
  broker: string;
  server: string;
  accountName: string;
  accountID: string;
  accountNumber: number;
  initialBalance?: number;
  balance?: number;
  netPnl?: number;
  profit?: number;
  bestTrade?: number;
  createdAt: Timestamp;
}
