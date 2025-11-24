import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../features/auth/service/authService';
import { inject } from '@angular/core';
import { catchError, from, map, of, switchMap, take, tap } from 'rxjs';
import { Store } from '@ngrx/store';
import { getAuth } from 'firebase/auth';
import { setUserData } from '../features/auth/store/user.actions';

/**
 * Redirect guard that handles post-authentication routing.
 *
 * This guard is used after successful authentication to redirect users
 * to the appropriate page based on their role. Admins are redirected to
 * the overview page, while regular users are redirected to the strategy page.
 *
 * Features:
 * - Verifies authentication state
 * - Checks user status (banned users are blocked)
 * - Role-based redirection (admin → overview, user → strategy)
 * - Dispatches user data to NgRx store
 * - Shows ban alert for banned users
 *
 * Redirect Logic:
 * - Admin users → /overview
 * - Regular users → /strategy
 * - Banned users → /login (with alert)
 * - Unauthenticated → /login
 *
 * Relations:
 * - AuthService: Checks authentication and fetches user data
 * - Store (NgRx): Dispatches user data
 * - Router: Handles navigation redirects
 *
 * @guard
 * @function redirectGuard
 */
export const redirectGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const authService = inject(AuthService);
  const store = inject(Store);

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
        tap((userData) => {
          if (userData.status === 'banned') {
            alert('You are banned, call support');
            router.navigate(['/login']);
            throw new Error('User banned');
          }
          store.dispatch(setUserData({ user: userData }));
          
          // Redirección inteligente según tipo de usuario
          if (userData.isAdmin) {
            router.navigate(['/overview']);
          } else {
            router.navigate(['/strategy']);
          }
        }),
        map(() => true),
        catchError(() => {
          router.navigate(['/login']);
          return of(false);
        })
      );
    })
  );
};
