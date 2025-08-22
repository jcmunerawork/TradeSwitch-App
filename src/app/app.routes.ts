import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'report',
  },
  {
    path: 'strategy',
    loadComponent: () =>
      import('./features/strategy/strategy.component').then((m) => m.Strategy),
  },

  {
    path: 'report',
    loadComponent: () =>
      import('./features/report/report.component').then(
        (m) => m.ReportComponent
      ),
  },
  {
    path: 'signup',
    loadComponent: () =>
      import('./features/auth/signup/signup').then((m) => m.SignupComponent),
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: 'overview',
    loadComponent: () =>
      import('./features/overview/overview.component').then((m) => m.Overview),
  },
  {
    path: 'users',
    loadComponent: () =>
      import('./features/users-details/users-details.component').then(
        (m) => m.UsersDetails
      ),
  },
];
