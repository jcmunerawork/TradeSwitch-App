/**
 * Auth feature: NgRx selectors for the user slice.
 *
 * Selectors read from the 'user' feature state (UserState). Use selectUser
 * to get the full state; use the get* selectors for specific fields.
 */
import { createFeatureSelector, createSelector } from '@ngrx/store';
import { UserState } from './user.reducer';

/** Selects the entire user feature state (user slice). */
export const selectUser = createFeatureSelector<UserState>('user');

/** Selects the current user's id. */
export const getUserId = createSelector(selectUser, (state) => state.user?.id);

/** Selects the current user's email. */
export const getUserEmail = createSelector(
  selectUser,
  (state) => state.user?.email
);

/** Selects the current user's first name. */
export const getUserName = createSelector(
  selectUser,
  (state) => state.user?.firstName
);

/** Selects the current user's last name. */
export const getUserLastName = createSelector(
  selectUser,
  (state) => state.user?.lastName
);

/** Selects the current user's phone number. */
export const getUserPhoneNumber = createSelector(
  selectUser,
  (state) => state.user?.phoneNumber
);

/** Selects the current user's birthday. */
export const getUserBirthday = createSelector(
  selectUser,
  (state) => state.user?.birthday
);

/** Selects the current user's token id. */
export const getUserTokenId = createSelector(
  selectUser,
  (state) => state.user?.tokenId
);

/** Selects whether the current user is an admin. */
export const getIsAdmin = createSelector(
  selectUser,
  (state) => state.user?.isAdmin
);
