import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../features/auth/service/authService';
import { inject } from '@angular/core';



export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);


  const authService = inject(AuthService);
  
  const isAuthenticated = authService.isAuthenticated();

  if (isAuthenticated) {
    return true;
  } else {
    console.log(`User is not authenticated`);
    router.navigate(['/login']);
    return false;
  }
};

