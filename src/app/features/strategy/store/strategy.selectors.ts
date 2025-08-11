import { createFeatureSelector, createSelector } from '@ngrx/store';
import { StrategyState } from '../models/strategy.model';

export const selectStrategy = createFeatureSelector<StrategyState>('strategy');

export const selectMaxDailyTrades = createSelector(
  selectStrategy,
  (state) => state.maxDailyTrades
);

export const riskReward = createSelector(
  selectStrategy,
  (state) => state.riskReward
);

export const riskPerTrade = createSelector(
  selectStrategy,
  (state) => state.riskPerTrade
);
