import { createReducer, on } from '@ngrx/store';
import { setUserData } from './user.actions';

export interface UserState {
    user: User | null; // Replace 'any' with your actual user type
}

export const initialState: UserState = {
    user: null
};

export const userReducer = createReducer(
    initialState,
    on(setUserData, (state, { user }) => ({ ...state, user }))
);  