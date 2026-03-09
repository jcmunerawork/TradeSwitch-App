import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Limpieza de credenciales en el primer arranque de la pestaña
// - Usa sessionStorage para marcar que esta pestaña ya inicializó la app.
// - En la primera carga, elimina tokens potencialmente obsoletos de localStorage
//   para evitar autologin inconsistente o roto.
const SESSION_INIT_FLAG = 'ts_session_initialized';

if (typeof window !== 'undefined') {
  try {
    const session = window.sessionStorage;
    const storage = window.localStorage;

    if (!session.getItem(SESSION_INIT_FLAG)) {
      session.setItem(SESSION_INIT_FLAG, 'true');

      // Eliminar tokens potencialmente obsoletos
      storage.removeItem('idToken');         // Token de Firebase usado por el interceptor
      storage.removeItem('ts_crypto_key');   // Clave de sesión de cifrado persistida
    }
  } catch {
    // Ignorar errores de acceso a storage (modo incógnito, restricciones, etc.)
  }
}

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
