import { createReducer, on } from '@ngrx/store';
import { setUserData } from './user.actions';

export interface UserState {
    user: User | null;  // Replace 'any' with your actual user type
}

export const initialState: UserState = {
    user: null  // Initialize user as null or an empty object
};

export const userReducer = createReducer(
    initialState,
    on(setUserData, (state, { user }) => ({ ...state, user }))
);  