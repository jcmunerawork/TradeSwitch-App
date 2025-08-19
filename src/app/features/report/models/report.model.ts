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
  updatedAt: string;
}

export interface StatConfig {
  netPnl: number;
  tradeWinPercent: number;
  profitFactor: number;
  avgWinLossTrades: number;
  totalTrades: number;
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
