import { createAction, props } from '@ngrx/store';
import {
  AssetsAllowedConfig,
  DaysAllowedConfig,
  HoursAllowedConfig,
  MaxDailyTradesConfig,
  RiskPerTradeConfig,
  RiskRewardConfig,
  StrategyState,
} from '../models/strategy.model';

/**
 * Action to set the maximum daily trades configuration.
 *
 * @action setMaxDailyTradesConfig
 */
export const setMaxDailyTradesConfig = createAction(
  '[Strategy] Set Max Daily Trades Config',
  props<{ config: MaxDailyTradesConfig }>()
);

/**
 * Action to set the risk/reward ratio configuration.
 *
 * @action setRiskRewardConfig
 */
export const setRiskRewardConfig = createAction(
  '[Strategy] Set Risk Reward Ratio Config',
  props<{ config: RiskRewardConfig }>()
);

/**
 * Action to set the risk per trade configuration.
 *
 * @action setRiskPerTradeConfig
 */
export const setRiskPerTradeConfig = createAction(
  '[Strategy] Set Risk Per Trade Config',
  props<{ config: RiskPerTradeConfig }>()
);

/**
 * Action to set the days allowed configuration.
 *
 * @action setDaysAllowedConfig
 */
export const setDaysAllowedConfig = createAction(
  '[Strategy] Set Days Allowed Config',
  props<{ config: DaysAllowedConfig }>()
);

/**
 * Action to set the trading hours configuration.
 *
 * @action setHoursAllowedConfig
 */
export const setHoursAllowedConfig = createAction(
  '[Strategy] Set Hours Allowed Config',
  props<{ config: HoursAllowedConfig }>()
);

/**
 * Action to set the assets allowed configuration.
 *
 * @action setAssetsAllowedConfig
 */
export const setAssetsAllowedConfig = createAction(
  '[Strategy] Set Assets Allowed Config',
  props<{ config: AssetsAllowedConfig }>()
);

/**
 * Action to reset the entire strategy configuration.
 *
 * @action resetConfig
 */
export const resetConfig = createAction(
  '[Strategy] Reset Config',
  props<{ config: StrategyState }>()
);
