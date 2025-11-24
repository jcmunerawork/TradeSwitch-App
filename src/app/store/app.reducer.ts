import { ActionReducerMap } from '@ngrx/store';
import { AppState } from './app.state';
import { strategyReducer } from '../features/strategy/store/strategy.reducer';
import { reportReducer } from '../features/report/store/report.reducer';
import { userReducer } from '../features/auth/store/user.reducer';

/**
 * Root reducer that combines all feature module reducers.
 *
 * This reducer map combines all feature-specific reducers into a single
 * root reducer for the NgRx store. Each feature module manages its own
 * state slice, and this reducer orchestrates them together.
 *
 * Reducer Structure:
 * - strategy: Handles strategy rule configurations
 * - report: Handles report data and statistics
 * - user: Handles user authentication and profile data
 *
 * Usage:
 * This reducer map is used when configuring the NgRx store in the
 * application root module to provide a unified state management system.
 *
 * Relations:
 * - strategyReducer: From strategy module store
 * - reportReducer: From report module store
 * - userReducer: From auth module store
 * - AppState: Root state interface
 *
 * @constant
 * @type ActionReducerMap<AppState>
 */
export const appReducers: ActionReducerMap<AppState> = {
  strategy: strategyReducer,
  report: reportReducer,
  user: userReducer,
};
