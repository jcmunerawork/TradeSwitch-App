import { Injectable, inject } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpResponse,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, from, of, throwError } from 'rxjs';
import { switchMap, map, catchError, tap } from 'rxjs/operators';
import { getAuth } from 'firebase/auth';
import { ConfigService } from '../services/config.service';
import { CryptoSessionService } from '../services/crypto-session.service';
import {
  encryptRequestBody,
  decryptResponseBody,
  isEncryptedEnvelope,
} from '../utils/encryption';

/** Paths that must not be encrypted (body is sent in clear). */
const EXCLUDED_PATH_PATTERNS = [
  'crypto/session-key',
  'payments/webhook',
];

/** Header to mark retry and avoid retrying again. */
const CRYPTO_RETRY_HEADER = 'X-Crypto-Retry';

/** Backend message when the session key is invalid or expired. */
const SESSION_KEY_INVALID_MESSAGE = 'Invalid or expired session key';

@Injectable()
export class CryptoInterceptor implements HttpInterceptor {
  private config = inject(ConfigService);
  private cryptoSession = inject(CryptoSessionService);

  /**
   * Aplica cifrado a todas las peticiones al API (excepto rutas excluidas).
   * - GET, POST, PUT, PATCH, DELETE, etc.: todas llevan X-Session-Key-Id para que el backend
   *   cifre la respuesta (y el cliente la desencripte si viene como EncryptedEnvelope).
   * - POST/PUT/PATCH con body: además se cifra el body como EncryptedEnvelope.
   */
  intercept(
    req: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    const baseUrl = this.config.apiUrl.replace(/\/$/, '');
    const url = req.url;

    if (!url.startsWith(baseUrl)) {
      return next.handle(req);
    }

    const isExcluded = EXCLUDED_PATH_PATTERNS.some((p) => url.includes(p));
    if (isExcluded) {
      return next.handle(req);
    }

    const isRetry = req.headers.has(CRYPTO_RETRY_HEADER);
    return from(this.getFreshFirebaseIdToken()).pipe(
      switchMap((token) => from(this.cryptoSession.getSessionKey(token))),
      switchMap(({ keyId, key }) => this.buildRequestWithKey(req, keyId, key, isRetry)),
      tap((newReq) => {
        if (newReq.url.includes('reports/history')) {
          this.logReportHistoryRequest(newReq);
        }
      }),
      switchMap((newReq) => next.handle(newReq)),
      switchMap((event) => this.decryptResponseIfNeeded(event)),
      catchError((err) => this.handleCryptoError(err, req, next, isRetry))
    );
  }

  /** Obtiene un Firebase idToken actualizado (force refresh) para el handshake de session-key. */
  private getFreshFirebaseIdToken(): Promise<string> {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) return Promise.resolve('');
      return user.getIdToken(true);
    } catch {
      return Promise.resolve('');
    }
  }

  /**
   * Log de depuración: imprime cómo se envía la petición a reports/history
   * para comprobar si va cifrada (body EncryptedEnvelope) y con X-Session-Key-Id.
   */
  private logReportHistoryRequest(req: HttpRequest<unknown>): void {
    const headers: Record<string, string> = {};
    req.headers.keys().forEach((key) => {
      const value = req.headers.get(key);
      if (value != null) headers[key] = value;
    });
    console.log('[CryptoInterceptor] 📤 Petición a reports/history enviada al back:', {
      method: req.method,
      url: req.url,
      headers,
      body: req.body,
      bodyEsCifrado: req.body != null && typeof req.body === 'object' && this.isEncryptedEnvelopeBody(req.body),
    });
  }

  /**
   * Builds the request: adds X-Session-Key-Id and, when applicable, encrypts the body.
   */
  private buildRequestWithKey(
    req: HttpRequest<unknown>,
    keyId: string,
    key: string,
    isRetry: boolean
  ): Observable<HttpRequest<unknown>> {
    const method = req.method.toUpperCase();
    const hasBody = method === 'POST' || method === 'PUT' || method === 'PATCH';
    const body = req.body;

    const addHeader = (r: HttpRequest<unknown>, b: unknown) => {
      let headers = r.headers.set('X-Session-Key-Id', keyId);
      if (isRetry) {
        headers = headers.set(CRYPTO_RETRY_HEADER, '1');
      }
      return r.clone({ headers, body: b });
    };

    if (hasBody && body != null && typeof body === 'object' && !this.isEncryptedEnvelopeBody(body)) {
      return from(encryptRequestBody(body, key, keyId)).pipe(
        map((envelope) => addHeader(req, envelope))
      );
    }

    return of(addHeader(req, body));
  }

  private handleCryptoError(
    error: unknown,
    req: HttpRequest<unknown>,
    next: HttpHandler,
    isRetry: boolean
  ): Observable<HttpEvent<unknown>> {
    if (isRetry || !(error instanceof HttpErrorResponse)) {
      return throwError(() => error);
    }
    if (error.status !== 400) {
      return throwError(() => error);
    }
    const message =
      typeof error.error === 'string'
        ? error.error
        : (error.error && typeof (error.error as { message?: string }).message === 'string')
          ? (error.error as { message: string }).message
          : '';
    if (!message.includes(SESSION_KEY_INVALID_MESSAGE)) {
      return throwError(() => error);
    }
    this.cryptoSession.clearKey();
    return from(this.getFreshFirebaseIdToken()).pipe(
      switchMap((token) => from(this.cryptoSession.getSessionKey(token))),
      switchMap(({ keyId }) => {
        const retryReq = req.clone({
          headers: req.headers.set(CRYPTO_RETRY_HEADER, '1').set('X-Session-Key-Id', keyId),
        });
        return next.handle(retryReq).pipe(
          switchMap((event) => this.decryptResponseIfNeeded(event))
        );
      }),
      catchError((retryErr) => throwError(() => retryErr))
    );
  }

  private isEncryptedEnvelopeBody(body: unknown): boolean {
    if (!body || typeof body !== 'object') return false;
    const o = body as Record<string, unknown>;
    return (
      typeof o['keyId'] === 'string' &&
      typeof o['iv'] === 'string' &&
      typeof o['ciphertext'] === 'string'
    );
  }

  private decryptResponseIfNeeded(
    event: HttpEvent<unknown>
  ): Observable<HttpEvent<unknown>> {
    if (!(event instanceof HttpResponse)) {
      return of(event);
    }
    const res = event as HttpResponse<unknown>;
    const body = res.body;
    const isReportsHistory = res.url?.includes('reports/history') ?? false;
    if (!isEncryptedEnvelope(body)) {
      if (isReportsHistory) {
        console.log('[CryptoInterceptor] 📥 Respuesta de reports/history (sin cifrar):', res.url, { bodyType: body != null ? typeof body : 'null' });
      }
      return of(event);
    }
    const stored = this.cryptoSession.getStoredKey();
    if (!stored) {
      return of(event);
    }
    return from(decryptResponseBody(body, stored.key)).pipe(
      map((decrypted) => {
        if (isReportsHistory) {
          console.log('[CryptoInterceptor] 📥 Respuesta de reports/history (cifrada → descifrada):', res.url, { decrypted });
        }
        return res.clone({ body: decrypted });
      })
    );
  }
}
