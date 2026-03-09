import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../features/auth/service/authService';
import { inject } from '@angular/core';
import { catchError, from, map, of, switchMap, take, tap } from 'rxjs';
import { getAuth } from 'firebase/auth';

/**
 * Unauth guard that prevents authenticated users from accessing auth-only pages.
 *
 * This guard is used for routes like /login or /signup. If the user is already
 * authenticated, they are automatically redirected to their appropriate dashboard.
 */
export const unauthGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const authService = inject(AuthService);

  return authService.isAuthenticated().pipe(
    take(1),
    switchMap((isAuth) => {
      if (!isAuth) {
        // Not authenticated, allow access to login/signup
        return of(true);
      }
      
      const user = getAuth().currentUser;
      if (!user) {
        return of(true);
      }

      // User is authenticated, redirect them away
      return from(authService.getUserData(user.uid)).pipe(
        tap((userData) => {
          if (userData.status === 'banned') {
            // Cannot access dashboard if banned, but we let authGuard/redirectGuard handle it.
            return;
          }
          
          if (userData.isAdmin) {
            router.navigate(['/overview']);
          } else {
            router.navigate(['/strategy']);
          }
        }),
        map(() => false),
        catchError(() => {
          // If error getting user data, allow staying on login to potentially re-auth
          return of(true);
        })
      );
    })
  );
};
