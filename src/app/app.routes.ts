import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/strategy/strategy.component').then((m) => m.Strategy),
  },
  {
    path: 'strategy',
    loadComponent: () =>
      import('./features/strategy/strategy.component').then((m) => m.Strategy),
  },
];
