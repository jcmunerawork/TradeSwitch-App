export interface MaxDailyTradesConfig {
  isActive: boolean;
  value: number;
}

export interface StrategyState {
  maxDailyTrades: MaxDailyTradesConfig;
}
