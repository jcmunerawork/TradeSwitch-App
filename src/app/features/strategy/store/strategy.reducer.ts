import { createReducer, on } from '@ngrx/store';
import {
  setMaxDailyTradesConfig,
  setRiskPerTradeConfig,
  setRiskRewardConfig,
} from './strategy.actions';
import { RuleType, StrategyState } from '../models/strategy.model';

export const initialStrategyState: StrategyState = {
  maxDailyTrades: {
    isActive: false,
    maxDailyTrades: 1,
    type: RuleType.MAX_DAILY_TRADES,
  },
  riskReward: {
    isActive: false,
    riskRewardRatio: '1:2',
    type: RuleType.RISK_REWARD_RATIO,
  },
  riskPerTrade: {
    isActive: false,
    maxRiskPerTrade: 300,
    maxRiskPercentage: 3,
    type: RuleType.MAX_RISK_PER_TRADE,
  },
};

export const strategyReducer = createReducer(
  initialStrategyState,
  on(setMaxDailyTradesConfig, (state, { config }) => ({
    ...state,
    maxDailyTrades: config,
  })),
  on(setRiskRewardConfig, (state, { config }) => ({
    ...state,
    riskReward: config,
  })),
  on(setRiskPerTradeConfig, (state, { config }) => ({
    ...state,
    riskPerTrade: config,
  }))
);
