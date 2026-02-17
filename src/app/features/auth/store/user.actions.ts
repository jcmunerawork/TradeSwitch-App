/**
 * Auth feature: NgRx actions for the user slice.
 *
 * setUserData is dispatched after login/signup to store the current user,
 * or with null on logout to clear the user state.
 */
import { createAction, props } from '@ngrx/store';
import { User } from '../../overview/models/overview';

/** Dispatched to set or clear the current user in the store. Payload: user or null. */
export const setUserData = createAction(
  '[Auth] Set user data',
  props<{ user: User | null }>()
);
