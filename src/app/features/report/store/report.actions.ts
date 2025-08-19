import { createAction, props } from '@ngrx/store';
import { GroupedTrade } from '../models/report.model';

export const getReportHistory = createAction(
  '[Report] get report history trades',
  props<{ userId: string }>()
);

export const getUserKey = createAction(
  '[Report] Get User Key',
  props<{ email: string; password: string; server: string }>()
);

export const setUserKey = createAction(
  '[Report] Set User Key',
  props<{ userKey: string }>()
);

export const setGroupedTrades = createAction(
  '[Report] Set Grouped Trades',
  props<{ groupedTrades: GroupedTrade[] }>()
);

export const setNetPnL = createAction(
  '[Report] Set Net PnL',
  props<{ netPnL: number }>()
);

export const setTradeWin = createAction(
  '[Report] Set Trade Win',
  props<{ tradeWin: number }>()
);

export const setProfitFactor = createAction(
  '[Report] Set Profit Factor',
  props<{ profitFactor: number }>()
);

export const setAvgWnL = createAction(
  '[Report] Set Avg Win/Loss',
  props<{ avgWnL: number }>()
);

export const setTotalTrades = createAction(
  '[Report] Set Total Trades',
  props<{ totalTrades: number }>()
);
