import { Timestamp } from 'firebase/firestore';

export interface UserCredentials {
  email: string;
  password: string;
}

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
  balance?: number;
  createdAt: Timestamp;
}
