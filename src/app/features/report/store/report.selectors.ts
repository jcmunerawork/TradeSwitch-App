import { createFeatureSelector, createSelector } from '@ngrx/store';
import { ReportState } from '../models/report.model';

export const selectReport = createFeatureSelector<ReportState>('report');
export const selectGroupedTrades = createSelector(
  selectReport,
  (state: ReportState) => state.groupedTrades
);

export const selectUserKey = createSelector(
  selectReport,
  (state: ReportState) => state.userKey
);

export const selectNetPnL = createSelector(
  selectReport,
  (state: ReportState) => state.netPnL
);

export const selectTradeWin = createSelector(
  selectReport,
  (state: ReportState) => state.tradeWin
);

export const selectProfitFactor = createSelector(
  selectReport,
  (state: ReportState) => state.profitFactor
);

export const selectAvgWnL = createSelector(
  selectReport,
  (state: ReportState) => state.AvgWnL
);

export const selectTotalTrades = createSelector(
  selectReport,
  (state: ReportState) => state.totalTrades
);
