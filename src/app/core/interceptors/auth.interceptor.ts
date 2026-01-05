import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, from } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { getAuth } from 'firebase/auth';

/**
 * HTTP Interceptor para manejar autenticación y errores 401
 * 
 * Este interceptor:
 * - Agrega automáticamente el token de autorización a las peticiones
 * - Maneja errores 401 (no autorizado) redirigiendo al login
 * - Limpia tokens y cookies cuando la sesión expira
 */
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<any> {
    // Si la petición ya tiene Authorization header, no agregarlo de nuevo
    if (req.headers.has('Authorization')) {
      return this.handleRequest(req, next);
    }

    // Obtener token de Firebase Auth o localStorage
    const auth = getAuth();
    const currentUser = auth.currentUser;
    
    if (currentUser) {
      // Obtener token de forma asíncrona
      return from(currentUser.getIdToken()).pipe(
        switchMap(idToken => {
          const authReq = req.clone({
            setHeaders: {
              Authorization: `Bearer ${idToken}`
            }
          });
          return this.handleRequest(authReq, next);
        }),
        catchError(() => {
          // Si falla obtener el token, intentar con localStorage
          return this.handleRequestWithStoredToken(req, next);
        })
      );
    } else {
      // Intentar con token almacenado
      return this.handleRequestWithStoredToken(req, next);
    }
  }

  private handleRequestWithStoredToken(req: HttpRequest<any>, next: HttpHandler): Observable<any> {
    if (!this.isBrowser) {
      return this.handleRequest(req, next);
    }

    const storedToken = localStorage.getItem('idToken');
    if (storedToken) {
      const authReq = req.clone({
        setHeaders: {
          Authorization: `Bearer ${storedToken}`
        }
      });
      return this.handleRequest(authReq, next);
    }

    return this.handleRequest(req, next);
  }

  private handleRequest(req: HttpRequest<any>, next: HttpHandler): Observable<any> {
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        // Manejar errores 401 (no autorizado)
        if (error.status === 401) {
          this.handleUnauthorized();
        }

        return throwError(() => error);
      })
    );
  }

  private handleUnauthorized(): void {
    if (!this.isBrowser) return;

    console.log('🔐 AuthInterceptor: Manejo de error 401 (Unauthorized), limpiando todo...');

    // Limpiar todo el almacenamiento
    try {
      // Limpiar localStorage completo
      localStorage.clear();
      
      // Limpiar sessionStorage completo
      sessionStorage.clear();
      
      // Limpiar todas las cookies
      const cookies = document.cookie.split(';');
      for (let cookie of cookies) {
        const eqPos = cookie.indexOf('=');
        const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
        if (name) {
          // Eliminar cookie para diferentes paths y domains
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/`;
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;domain=${window.location.hostname}`;
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;domain=.${window.location.hostname}`;
        }
      }
    } catch (e) {
      console.warn('⚠️ AuthInterceptor: Error limpiando almacenamiento:', e);
    }

    // Cerrar sesión en Firebase Auth
    const auth = getAuth();
    auth.signOut().catch(err => {
      console.error('❌ AuthInterceptor: Error cerrando sesión en Firebase:', err);
    });

    // Redirigir al login
    this.router.navigate(['/login']).catch(err => {
      console.error('❌ AuthInterceptor: Error redirigiendo al login:', err);
    });
  }
}

