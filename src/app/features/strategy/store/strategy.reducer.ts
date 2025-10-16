import { createReducer, on } from '@ngrx/store';
import {
  resetConfig,
  setAssetsAllowedConfig,
  setDaysAllowedConfig,
  setHoursAllowedConfig,
  setMaxDailyTradesConfig,
  setRiskPerTradeConfig,
  setRiskRewardConfig,
} from './strategy.actions';
import { Days, RuleType, StrategyState } from '../models/strategy.model';

export const initialStrategyState: StrategyState = {
  maxDailyTrades: {
    isActive: false,
    maxDailyTrades: 0,
    type: RuleType.MAX_DAILY_TRADES,
  },
  riskReward: {
    isActive: false,
    riskRewardRatio: '1:2',
    type: RuleType.RISK_REWARD_RATIO,
  },
  riskPerTrade: {
    isActive: false,
    review_type: 'MAX',
    number_type: 'PERCENTAGE',
    percentage_type: 'NULL',
    risk_ammount: 0,
    balance: 0,
    actualBalance: 0,
    type: RuleType.MAX_RISK_PER_TRADE,
  },
  daysAllowed: {
    isActive: false,
    type: RuleType.DAYS_ALLOWED,
    tradingDays: [],
  },
  hoursAllowed: {
    isActive: false,
    tradingOpenTime: '',
    tradingCloseTime: '',
    timezone: '',
    type: RuleType.TRADING_HOURS,
  },
  assetsAllowed: {
    isActive: false,
    type: RuleType.ASSETS_ALLOWED,
    assetsAllowed: [],
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
  })),
  on(setDaysAllowedConfig, (state, { config }) => ({
    ...state,
    daysAllowed: config,
  })),
  on(setHoursAllowedConfig, (state, { config }) => ({
    ...state,
    hoursAllowed: config,
  })),
  on(setAssetsAllowedConfig, (state, { config }) => ({
    ...state,
    assetsAllowed: config,
  })),
  on(resetConfig, (state, { config }) => ({
    ...config,
  }))
);
