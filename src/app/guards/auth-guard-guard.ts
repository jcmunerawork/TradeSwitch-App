import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../features/auth/service/authService';
import { inject } from '@angular/core';
import { catchError, from, map, of, switchMap, take, tap } from 'rxjs';
import { Store } from '@ngrx/store';
import { getAuth } from 'firebase/auth';
import { setUserData } from '../features/auth/store/user.actions';
import { ReasonsService } from '../shared/services/reasons.service';

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
