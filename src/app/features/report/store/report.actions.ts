import { createAction, props } from '@ngrx/store';
import { GroupedTrade, GroupedTradeFinal } from '../models/report.model';

/**
 * Action to trigger fetching report history trades.
 *
 * @action getReportHistory
 */
export const getReportHistory = createAction(
  '[Report] get report history trades',
  props<{ userId: string }>()
);

/**
 * Action to get user authentication key.
 *
 * @action getUserKey
 */
export const getUserKey = createAction(
  '[Report] Get User Key',
  props<{ email: string; password: string; server: string }>()
);

/**
 * Action to set user authentication key in store.
 *
 * @action setUserKey
 */
export const setUserKey = createAction(
  '[Report] Set User Key',
  props<{ userKey: string }>()
);

/**
 * Action to set grouped trades in store.
 *
 * @action setGroupedTrades
 */
export const setGroupedTrades = createAction(
  '[Report] Set Grouped Trades',
  props<{ groupedTrades: GroupedTradeFinal[] }>()
);

/**
 * Action to set net PnL value in store.
 *
 * @action setNetPnL
 */
export const setNetPnL = createAction(
  '[Report] Set Net PnL',
  props<{ netPnL: number }>()
);

/**
 * Action to set trade win percentage in store.
 *
 * @action setTradeWin
 */
export const setTradeWin = createAction(
  '[Report] Set Trade Win',
  props<{ tradeWin: number }>()
);

/**
 * Action to set profit factor value in store.
 *
 * @action setProfitFactor
 */
export const setProfitFactor = createAction(
  '[Report] Set Profit Factor',
  props<{ profitFactor: number }>()
);

/**
 * Action to set average win/loss ratio in store.
 *
 * @action setAvgWnL
 */
export const setAvgWnL = createAction(
  '[Report] Set Avg Win/Loss',
  props<{ avgWnL: number }>()
);

/**
 * Action to set total trades count in store.
 *
 * @action setTotalTrades
 */
export const setTotalTrades = createAction(
  '[Report] Set Total Trades',
  props<{ totalTrades: number }>()
);
