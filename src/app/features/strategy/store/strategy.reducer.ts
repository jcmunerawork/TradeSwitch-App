import { createReducer, on } from '@ngrx/store';
import {
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
  daysAllowed: {
    isActive: false,
    type: RuleType.DAYS_ALLOWED,
    tradingDays: [Days.MONDAY, Days.TUESDAY],
  },
  hoursAllowed: {
    isActive: false,
    tradingOpenTime: '09:30',
    tradingCloseTime: '17:00',
    timezone: 'Zulu',
    type: RuleType.TRADING_HOURS,
  },
  assetsAllowed: {
    isActive: false,
    type: RuleType.ASSETS_ALLOWED,
    assetsAllowed: ['XMRUSD', 'BTCUSD'],
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
  }))
);
