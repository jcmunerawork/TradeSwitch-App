import { createAction, props } from '@ngrx/store';
import { User } from '../../overview/models/overview';

export const setUserData = createAction(
  '[Auth] Set user data',
  props<{ user: User | null }>()
);
