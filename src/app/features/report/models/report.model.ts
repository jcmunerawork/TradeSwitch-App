import { RuleType } from '../../strategy/models/strategy.model';

export interface historyTrade {
  id: string;
  userId: string;
  accountId: string;
  quantity: string;
  side: string;
  type_of_order: string;
  status: string;
  lots: string;
  price: { sell_price?: string; buy_price?: string };
  execution_price: string;
  updatedAt: string;
  isCloseAction: boolean;
  position_Id: string;
}

export interface GroupedTrade {
  position_Id: string;
  quantity?: number;
  pnl?: number;
  buy_price?: string;
  sell_price?: string;
  totalSpend?: number;
  updatedAt: string;
}

export interface StatConfig {
  netPnl: number;
  tradeWinPercent: number;
  profitFactor: number;
  avgWinLossTrades: number;
  totalTrades: number;
}

export interface displayConfigData {
  title: string;
  type: RuleType;
  isActive: boolean;
}

export interface CalendarDay {
  date: Date;
  trades: GroupedTrade[];
  pnlTotal: number;
  tradesCount: number;
  followedStrategy: boolean;
  tradeWinPercent: number;
}

export interface ReportState {
  groupedTrades: GroupedTrade[];
  netPnL: number;
  tradeWin: number;
  profitFactor: number;
  AvgWnL: number;
  totalTrades: number;
  userKey: string;
}

export interface MonthlyReport {
  best_trade: string;
  netPnl: number;
  number_trades: number;
  profit: number;
  strategy_followed: number;
  total_spend: number;
  month: number;
  year: number;
  id: string;
}

export interface PluginHistoryRecord {
  isActive: boolean;
  updatedOn: string;
  id: string;
  tokenNeeded?: boolean;
}
