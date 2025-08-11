import { ActionReducerMap } from '@ngrx/store';
import { AppState } from './app.state';
import { strategyReducer } from '../features/strategy/store/strategy.reducer';

export const appReducers: ActionReducerMap<AppState> = {
  strategy: strategyReducer,
};
