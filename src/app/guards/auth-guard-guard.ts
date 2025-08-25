import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../features/auth/service/authService';
import { inject } from '@angular/core';
import { catchError, from, map, of, switchMap, take, tap } from 'rxjs';
import { Store } from '@ngrx/store';
import { getAuth } from 'firebase/auth';
import { setUserData } from '../features/auth/store/user.actions';

export const authGuard: CanActivateFn = (route, state) => {
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
