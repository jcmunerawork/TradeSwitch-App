import { createReducer, on } from '@ngrx/store';
import { setUserData } from './user.actions';
import { User } from '../../overview/models/overview';

export interface UserState {
  user: User | null;
}

export const initialState: UserState = {
  user: null,
};

export const userReducer = createReducer(
  initialState,
  on(setUserData, (state, { user }) => ({ ...state, user }))
);
