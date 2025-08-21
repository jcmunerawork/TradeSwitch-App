import { createAction, props } from '@ngrx/store';

export const setUserData = createAction(
  '[Auth] Set user data',
  props<{ user: User }>()
);

