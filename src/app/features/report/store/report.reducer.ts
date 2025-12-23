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

/**
 * Initial state for the report feature.
 *
 * @constant initialReportState
 */
export const initialReportState: ReportState = {
  groupedTrades: [],
  netPnL: 0,
  tradeWin: 0,
  profitFactor: 0,
  AvgWnL: 0,
  totalTrades: 0,
  userKey: '',
};

/**
 * Reducer for managing report state.
 *
 * Handles all report-related actions and updates the state accordingly.
 * Actions handled:
 * - setUserKey: Updates user authentication key
 * - setGroupedTrades: Updates grouped trades array
 * - setNetPnL: Updates net PnL value
 * - setTradeWin: Updates trade win percentage
 * - setProfitFactor: Updates profit factor
 * - setAvgWnL: Updates average win/loss ratio
 * - setTotalTrades: Updates total trades count
 *
 * @reducer reportReducer
 */
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
