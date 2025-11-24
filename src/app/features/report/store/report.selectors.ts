import { createFeatureSelector, createSelector } from '@ngrx/store';
import { ReportState } from '../models/report.model';

/**
 * Feature selector for the report state.
 *
 * @selector selectReport
 */
export const selectReport = createFeatureSelector<ReportState>('report');

/**
 * Selector for grouped trades from report state.
 *
 * @selector selectGroupedTrades
 */
export const selectGroupedTrades = createSelector(
  selectReport,
  (state: ReportState) => state.groupedTrades
);

/**
 * Selector for user key from report state.
 *
 * @selector selectUserKey
 */
export const selectUserKey = createSelector(
  selectReport,
  (state: ReportState) => state.userKey
);

/**
 * Selector for net PnL from report state.
 *
 * @selector selectNetPnL
 */
export const selectNetPnL = createSelector(
  selectReport,
  (state: ReportState) => state.netPnL
);

/**
 * Selector for trade win percentage from report state.
 *
 * @selector selectTradeWin
 */
export const selectTradeWin = createSelector(
  selectReport,
  (state: ReportState) => state.tradeWin
);

/**
 * Selector for profit factor from report state.
 *
 * @selector selectProfitFactor
 */
export const selectProfitFactor = createSelector(
  selectReport,
  (state: ReportState) => state.profitFactor
);

/**
 * Selector for average win/loss ratio from report state.
 *
 * @selector selectAvgWnL
 */
export const selectAvgWnL = createSelector(
  selectReport,
  (state: ReportState) => state.AvgWnL
);

/**
 * Selector for total trades count from report state.
 *
 * @selector selectTotalTrades
 */
export const selectTotalTrades = createSelector(
  selectReport,
  (state: ReportState) => state.totalTrades
);
