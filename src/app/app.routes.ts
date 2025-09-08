import { Routes } from '@angular/router';
import { authGuard } from './guards/auth-guard-guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'report',
  },
  {
    path: 'strategy',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/strategy/strategy.component').then((m) => m.Strategy),
  },

  {
    path: 'report',
    canActivate: [authGuard],
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
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/overview/overview.component').then((m) => m.Overview),
  },
  {
    path: 'users',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/users-details/users-details.component').then(
        (m) => m.UsersDetails
      ),
  },
  {
    path: 'revenue',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/revenue/revenue.component').then(
        (m) => m.RevenueComponent
      ),
  },
  {
    path: 'account',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/account/account.component').then(
        (m) => m.AccountComponent
      ),
  },
  {
    path: 'trading-accounts',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/trading-accounts/trading-accounts.component').then(
        (m) => m.TradingAccountsComponent
      ),
  },
  {
    path: 'add-account',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/add-account/add-account.component').then(
        (m) => m.AddAccountComponent
      ),
  },
];
