import { createAction, props } from '@ngrx/store';
import {
  DaysAllowedConfig,
  MaxDailyTradesConfig,
  RiskPerTradeConfig,
  RiskRewardConfig,
} from '../models/strategy.model';

export const setMaxDailyTradesConfig = createAction(
  '[Strategy] Set Max Daily Trades Config',
  props<{ config: MaxDailyTradesConfig }>()
);

export const setRiskRewardConfig = createAction(
  '[Strategy] Set Risk Reward Ratio Config',
  props<{ config: RiskRewardConfig }>()
);

export const setRiskPerTradeConfig = createAction(
  '[Strategy] Set Risk Per Trade Config',
  props<{ config: RiskPerTradeConfig }>()
);

export const setDaysAllowedConfig = createAction(
  '[Strategy] Set Days Allowed Config',
  props<{ config: DaysAllowedConfig }>()
);
