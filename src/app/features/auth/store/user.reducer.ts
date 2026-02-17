/**
 * Auth feature: NgRx reducer for the user slice.
 *
 * Handles setUserData to store the current user (or null on logout).
 * Registered under the 'user' feature key in the store.
 */
import { createReducer, on } from '@ngrx/store';
import { setUserData } from './user.actions';
import { User } from '../../overview/models/overview';

/** State shape for the user feature: single user or null. */
export interface UserState {
  user: User | null;
}

/** Initial state: no user. */
export const initialState: UserState = {
  user: null,
};

/** Reducer: updates state with the user from setUserData action. */
export const userReducer = createReducer(
  initialState,
  on(setUserData, (state, { user }) => ({ ...state, user }))
);
