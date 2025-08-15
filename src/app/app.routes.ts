import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'strategy',
  },
  {
    path: 'strategy',
    loadComponent: () =>
      import('./features/strategy/strategy.component').then((m) => m.Strategy),
  },

  {
    path: 'add-account',
    loadComponent: () =>
      import('./features/reportForm/report-form.component').then(
        (m) => m.ReportFormComponent
      ),
  },
  {
    path: 'signup',
    loadComponent: () =>
      import('./features/auth/signup/signup').then((m) => m.SignupComponent),
  }
];
