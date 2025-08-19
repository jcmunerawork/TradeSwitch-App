import { createReducer, on } from '@ngrx/store';

import { ReportState } from '../models/report.model';
import {
  getUserKey,
  setAvgWnL,
  setGroupedTrades,
  setNetPnL,
  setProfitFactor,
  setTotalTrades,
  setTradeWin,
  setUserKey,
} from './report.actions';

export const initialReportState: ReportState = {
  groupedTrades: [],
  netPnL: 0,
  tradeWin: 0,
  profitFactor: 0,
  AvgWnL: 0,
  totalTrades: 0,
  userKey: '',
};

export const reportReducer = createReducer(
  initialReportState,
  on(setUserKey, (state, { userKey }) => ({
    ...state,
    userKey,
  })),
  on(setGroupedTrades, (state, { groupedTrades }) => ({
    ...state,
    groupedTrades,
  })),
  on(setNetPnL, (state, { netPnL }) => ({
    ...state,
    netPnL,
  })),
  on(setTradeWin, (state, { tradeWin }) => ({
    ...state,
    tradeWin,
  })),
  on(setProfitFactor, (state, { profitFactor }) => ({
    ...state,
    profitFactor,
  })),
  on(setAvgWnL, (state, { avgWnL }) => ({
    ...state,
    AvgWnL: avgWnL,
  })),
  on(setTotalTrades, (state, { totalTrades }) => ({
    ...state,
    totalTrades,
  }))
);
