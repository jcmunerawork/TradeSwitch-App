import { ActionReducerMap } from '@ngrx/store';
import { AppState } from './app.state';
import { strategyReducer } from '../features/strategy/store/strategy.reducer';
import { reportReducer } from '../features/report/store/report.reducer';
import { userReducer } from '../features/auth/store/user.reducer';

export const appReducers: ActionReducerMap<AppState> = {
  strategy: strategyReducer,
  report: reportReducer,
  user: userReducer,
};
