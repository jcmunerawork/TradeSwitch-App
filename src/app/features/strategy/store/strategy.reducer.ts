import { createReducer, on } from '@ngrx/store';
import { setMaxDailyTradesConfig } from './strategy.actions';
import { StrategyState } from '../models/strategy.model';

export const initialStrategyState: StrategyState = {
  maxDailyTrades: { isActive: false, value: 1 },
};

export const strategyReducer = createReducer(
  initialStrategyState,
  on(setMaxDailyTradesConfig, (state, { config }) => ({
    ...state,
    maxDailyTrades: config,
  }))
);
