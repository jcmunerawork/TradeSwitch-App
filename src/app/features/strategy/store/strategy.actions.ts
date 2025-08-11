import { createAction, props } from '@ngrx/store';
import { MaxDailyTradesConfig } from '../models/strategy.model';

export const setMaxDailyTradesConfig = createAction(
  '[Strategy] Set Max Daily Trades Config',
  props<{ config: MaxDailyTradesConfig }>()
);
