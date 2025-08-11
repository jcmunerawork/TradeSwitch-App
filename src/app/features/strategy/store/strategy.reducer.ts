import { createReducer, on } from '@ngrx/store';
import {
  setMaxDailyTradesConfig,
  setRiskRewardConfig,
} from './strategy.actions';
import { RuleType, StrategyState } from '../models/strategy.model';

export const initialStrategyState: StrategyState = {
  maxDailyTrades: {
    isActive: true,
    maxDailyTrades: 2,
    type: RuleType.MAX_DAILY_TRADES,
  },
  riskReward: {
    isActive: false,
    riskRewardRatio: '1:2',
    type: RuleType.RISK_REWARD_RATIO,
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
  }))
);
