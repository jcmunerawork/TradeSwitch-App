import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../features/auth/service/authService';
import { inject } from '@angular/core';
import { catchError, from, map, of, switchMap, take, tap } from 'rxjs';
import { Store } from '@ngrx/store';
import { getAuth } from 'firebase/auth';
import { setUserData } from '../features/auth/store/user.actions';
import { ReasonsService } from '../shared/services/reasons.service';

/**
 * Authentication guard that protects routes requiring user authentication.
 *
 * This guard checks if a user is authenticated and verifies their status.
 * It prevents banned users from accessing protected routes and redirects
 * unauthenticated users to the login page.
 *
 * Features:
 * - Verifies Firebase authentication state
 * - Checks user status (banned users are blocked)
 * - Fetches and dispatches user data to NgRx store
 * - Shows ban reason if user is banned
 * - Redirects to login if not authenticated
 *
 * Flow:
 * 1. Check if user is authenticated
 * 2. Get current Firebase user
 * 3. Fetch user data from Firestore
 * 4. Check if user is banned (show reason and redirect)
 * 5. Dispatch user data to store
 * 6. Allow access if all checks pass
 *
 * Relations:
 * - AuthService: Checks authentication and fetches user data
 * - ReasonsService: Gets ban reason for banned users
 * - Store (NgRx): Dispatches user data
 * - Router: Handles navigation redirects
 *
 * @guard
 * @function authGuard
 */
export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const authService = inject(AuthService);
  const store = inject(Store);
  const reasonsService = inject(ReasonsService);

  return authService.isAuthenticated().pipe(
    take(1),
    switchMap((isAuth) => {
      if (!isAuth) {
        router.navigate(['/login']);
        return of(false);
      }
      const user = getAuth().currentUser;
      if (!user) {
        router.navigate(['/login']);
        return of(false);
      }

      return from(authService.getUserData(user.uid)).pipe(
        switchMap((userData) => {
          if (userData.status === 'banned') {
            return from(reasonsService.getOpenLatestReason(user.uid)).pipe(
              tap((reason) => {
                const message = reason?.reason
                  ? `You are banned: ${reason.reason}`
                  : 'You are banned, call support';
                alert(message);
                router.navigate(['/login']);
              }),
              map(() => false)
            );
          }
          store.dispatch(setUserData({ user: userData }));
          return of(true);
        }),
        catchError(() => {
          router.navigate(['/login']);
          return of(false);
        })
      );
    })
  );
};
