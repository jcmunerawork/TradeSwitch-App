import { UserState } from '../features/auth/store/user.reducer';
import { ReportState } from '../features/report/models/report.model';
import { StrategyState } from '../features/strategy/models/strategy.model';

/**
 * Root application state interface for NgRx store.
 *
 * This interface defines the complete application state structure,
 * combining all feature module states into a single root state.
 *
 * State Structure:
 * - strategy: Strategy module state (rules, configurations)
 * - report: Report module state (trades, statistics, user key)
 * - user: User authentication and profile state
 *
 * Usage:
 * This state is used by the root reducer to combine all feature reducers
 * and provide a single source of truth for the entire application.
 *
 * Relations:
 * - StrategyState: From strategy module
 * - ReportState: From report module
 * - UserState: From auth module
 * - app.reducer.ts: Combines all reducers
 *
 * @interface
 */
export interface AppState {
  strategy: StrategyState;
  report: ReportState;
  user: UserState;
}
