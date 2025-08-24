import { createFeatureSelector, createSelector } from '@ngrx/store';
import { UserState } from './user.reducer';
import e from 'express';

export const selectUser = createFeatureSelector<UserState>('user');

export const getUserId = createSelector(selectUser, (state) => state.user?.id);

export const getUserEmail = createSelector(
  selectUser,
  (state) => state.user?.email
);

export const getUserName = createSelector(
  selectUser,
  (state) => state.user?.firstName
);

export const getUserLastName = createSelector(
  selectUser,
  (state) => state.user?.lastName
);

export const getUserPhoneNumber = createSelector(
  selectUser,
  (state) => state.user?.phoneNumber
);

export const getUserBirthday = createSelector(
  selectUser,
  (state) => state.user?.birthday
);

export const getUserTokenId = createSelector(
  selectUser,
  (state) => state.user?.tokenId
);

export const getIsAdmin = createSelector(
  selectUser,
  (state) => state.user?.isAdmin
);
