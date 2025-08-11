import { createAction, props } from '@ngrx/store';
import {
  MaxDailyTradesConfig,
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
