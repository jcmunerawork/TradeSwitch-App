import { createFeatureSelector, createSelector } from '@ngrx/store';
import { StrategyState } from '../models/strategy.model';

/**
 * Feature selector for the strategy state.
 *
 * @selector selectStrategy
 */
export const selectStrategy = createFeatureSelector<StrategyState>('strategy');

/**
 * Selector for maximum daily trades configuration.
 *
 * @selector selectMaxDailyTrades
 */
export const selectMaxDailyTrades = createSelector(
  selectStrategy,
  (state) => state.maxDailyTrades
);

/**
 * Selector for risk/reward ratio configuration.
 *
 * @selector riskReward
 */
export const riskReward = createSelector(
  selectStrategy,
  (state) => state.riskReward
);

/**
 * Selector for risk per trade configuration.
 *
 * @selector riskPerTrade
 */
export const riskPerTrade = createSelector(
  selectStrategy,
  (state) => state.riskPerTrade
);

/**
 * Selector for days allowed configuration.
 *
 * @selector daysAllowed
 */
export const daysAllowed = createSelector(
  selectStrategy,
  (state) => state.daysAllowed
);

/**
 * Selector for trading hours configuration.
 *
 * @selector hoursAllowed
 */
export const hoursAllowed = createSelector(
  selectStrategy,
  (state) => state.hoursAllowed
);

/**
 * Selector for assets allowed configuration.
 *
 * @selector assetsAllowed
 */
export const assetsAllowed = createSelector(
  selectStrategy,
  (state) => state.assetsAllowed
);

/**
 * Selector for all strategy rules.
 *
 * @selector allRules
 */
export const allRules = createSelector(selectStrategy, (state) => state);
