import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Service for managing session cookies.
 *
 * This service handles storing and retrieving session tokens in cookies
 * to enable automatic login on application startup.
 *
 * Features:
 * - Store session token in cookies with expiration
 * - Retrieve session token from cookies
 * - Clear session token on logout
 * - Validate token expiration
 *
 * Cookie Configuration:
 * - Name: 'tradeswitch_session_token'
 * - Expiration: 1 hour
 * - HttpOnly: false (needed for client-side access)
 * - Secure: true (HTTPS only in production)
 * - SameSite: 'Strict'
 *
 * @injectable
 * @providedIn root
 */
@Injectable({
  providedIn: 'root'
})
export class SessionCookieService {
  private readonly COOKIE_NAME = 'tradeswitch_session_token';
  private readonly COOKIE_EXPIRATION_HOURS = 1;
  private isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  /**
   * Guardar token de sesión en cookie
   * @param token Token de Firebase Auth (idToken)
   */
  setSessionToken(token: string): void {
    if (!this.isBrowser) return;

    const expirationDate = new Date();
    expirationDate.setTime(expirationDate.getTime() + (this.COOKIE_EXPIRATION_HOURS * 60 * 60 * 1000));

    // Configurar cookie con opciones de seguridad
    const cookieOptions = [
      `${this.COOKIE_NAME}=${token}`,
      `expires=${expirationDate.toUTCString()}`,
      'path=/',
      'SameSite=Strict'
    ];

    // En producción, agregar Secure (solo HTTPS)
    if (window.location.protocol === 'https:') {
      cookieOptions.push('Secure');
    }

    document.cookie = cookieOptions.join('; ');
  }

  /**
   * Obtener token de sesión de la cookie
   * @returns Token de sesión o null si no existe o está expirado
   */
  getSessionToken(): string | null {
    if (!this.isBrowser) return null;

    const name = this.COOKIE_NAME + '=';
    const cookies = document.cookie.split(';');

    for (let i = 0; i < cookies.length; i++) {
      let cookie = cookies[i];
      while (cookie.charAt(0) === ' ') {
        cookie = cookie.substring(1);
      }
      if (cookie.indexOf(name) === 0) {
        const token = cookie.substring(name.length, cookie.length);
        // Verificar que el token no esté vacío
        return token || null;
      }
    }

    return null;
  }

  /**
   * Verificar si existe un token de sesión válido
   * @returns true si existe un token válido
   */
  hasValidSessionToken(): boolean {
    return this.getSessionToken() !== null;
  }

  /**
   * Eliminar token de sesión de la cookie
   */
  clearSessionToken(): void {
    if (!this.isBrowser) return;

    // Eliminar cookie estableciendo fecha de expiración en el pasado
    document.cookie = `${this.COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Strict`;
  }

  /**
   * Verificar si el token está expirado
   * Nota: La expiración se maneja automáticamente por el navegador,
   * pero podemos verificar manualmente si es necesario
   */
  isTokenExpired(): boolean {
    const token = this.getSessionToken();
    if (!token) return true;

    // La expiración se maneja automáticamente por el navegador
    // Si la cookie existe, no está expirada
    return false;
  }
}

