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
];
