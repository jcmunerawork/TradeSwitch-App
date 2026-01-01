import {
  ApplicationConfig,
  APP_INITIALIZER,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import {
  provideClientHydration,
  withEventReplay,
} from '@angular/platform-browser';
import { provideStore } from '@ngrx/store';
import { appReducers } from './store/app.reducer';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { AuthService } from './shared/services/auth.service';

/**
 * Función de inicialización para verificar token de sesión al iniciar la aplicación
 */
export function initializeApp(authService: AuthService) {
  return () => {
    // Verificar token de sesión y hacer login automático si es válido
    return authService.checkSessionTokenAndAutoLogin().catch((error) => {
      console.warn('Error during app initialization:', error);
      // No lanzar error para que la app pueda continuar
      return Promise.resolve();
    });
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideAnimations(),
    provideHttpClient(withFetch()),
    provideClientHydration(withEventReplay()),
    provideStore(appReducers),
    provideStoreDevtools({
      maxAge: 25,
      logOnly: false,
    }),
    provideCharts(withDefaultRegisterables()),
    {
      provide: APP_INITIALIZER,
      useFactory: initializeApp,
      deps: [AuthService],
      multi: true,
    },
  ],
};
