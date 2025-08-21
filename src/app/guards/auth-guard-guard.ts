import { Inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../features/auth/service/authService';

export const authGuard: CanActivateFn = (route, state) => {
  const router = Inject(Router);


  const authService = Inject(AuthService);

  const isAuthenticated = authService.isAuthenticated();

  if (isAuthenticated) {
    return true;
  } else {
    router.navigate(['/login']);
    return false;
  }

  
};
