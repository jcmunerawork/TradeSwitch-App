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
import { switchMap, map, catchError } from 'rxjs/operators';
import { getAuth } from 'firebase/auth';
import { ConfigService } from '../services/config.service';
import { CryptoSessionService } from '../services/crypto-session.service';
import type { EncryptedEnvelope } from '../models/encryption.model';
import {
  encryptRequestBody,
  decryptResponseBody,
  isEncryptedEnvelope,
} from '../utils/encryption';

/**
 * Paths that must NOT go through encryption flow:
 * - crypto/session-key: endpoint that returns the session key (needs Firebase token in Auth header only).
 * - payments/webhook: external webhook, no auth.
 * - auth/login, auth/signup: no Firebase token yet; user gets token only after these succeed.
 * - auth/forgot-password: unauthenticated.
 * For any other request we require: Firebase token (after login/register) → session key → then the actual request with X-Session-Key-Id and encrypted body.
 */
const EXCLUDED_PATH_PATTERNS = [
  'crypto/session-key',
  'payments/webhook',
  'auth/login',
  'auth/signup',
  'auth/forgot-password',
];

/** Header to mark retry and avoid retrying again. */
const CRYPTO_RETRY_HEADER = 'X-Crypto-Retry';

/** Backend message when the session key is invalid or expired. */
const SESSION_KEY_INVALID_MESSAGE = 'Invalid or expired session key';

/** Extrae el mensaje de error del body (backend puede devolver error.message o error.error.message). */
function getErrorMessage(errorBody: unknown): string {
  if (typeof errorBody === 'string') return errorBody;
  if (!errorBody || typeof errorBody !== 'object') return '';
  const o = errorBody as Record<string, unknown>;
  const nested = o['error'];
  if (nested && typeof nested === 'object' && typeof (nested as Record<string, unknown>)['message'] === 'string') {
    return (nested as Record<string, string>)['message'];
  }
  if (typeof o['message'] === 'string') return o['message'];
  return '';
}

/** Extrae el path de una URL (absoluta o relativa) para comparar con la API. */
function getRequestPath(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      return new URL(url).pathname;
    } catch {
      return url.split('?')[0] ?? url;
    }
  }
  return (url.split('?')[0] ?? url).replace(/^\/?/, '/');
}

/** Path base de la API (ej. /api) para detectar peticiones a nuestro backend. */
function getApiPath(apiUrl: string): string {
  const base = apiUrl.replace(/\/$/, '');
  if (base.startsWith('http://') || base.startsWith('https://')) {
    try {
      return new URL(base).pathname || '/';
    } catch {
      return base;
    }
  }
  return base.startsWith('/') ? base : `/${base}`;
}

@Injectable()
export class CryptoInterceptor implements HttpInterceptor {
  private config = inject(ConfigService);
  private cryptoSession = inject(CryptoSessionService);

  /**
   * Flow for ALL API requests (GET, POST, PATCH, PUT, DELETE) except excluded paths:
   * 1. Obtain session key: POST /api/v1/crypto/session-key with Authorization: Bearer <firebase-id-token>.
   *    keyId and key are stored (in CryptoSessionService).
   * 2. Every request (including GET) always sends:
   *    - X-Session-Key-Id: <keyId> (so the backend can encrypt the response).
   *    - Authorization: Bearer <firebase-id-token> (added by the caller).
   * 3. For POST/PUT/PATCH with body: the body is also encrypted as EncryptedEnvelope.
   * 4. If the response is an EncryptedEnvelope (keyId, iv, ciphertext, tag), it is decrypted with the stored key.
   * Without X-Session-Key-Id the backend returns plain JSON; with a valid keyId it returns encrypted data.
   */
  intercept(
    req: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    const url = req.url;
    const baseUrl = this.config.apiUrl.replace(/\/$/, '');
    const reqPath = getRequestPath(url);
    const apiPath = getApiPath(baseUrl);
    // Cualquier petición a nuestra API v1: por baseUrl, por path /api/ o /v1/, o por patrón fijo de backend
    const looksLikeOurApi =
      url.startsWith(baseUrl) ||
      reqPath === apiPath ||
      reqPath.startsWith(apiPath + '/') ||
      reqPath.startsWith('/v1/') ||
      url.includes('/api/v1/') ||
      (url.includes('localhost:3000') && url.includes('/api/')) ||
      /^\/api\/v1\//.test(reqPath) ||
      /^\/v1\//.test(reqPath);
    const isExcluded = EXCLUDED_PATH_PATTERNS.some((p) => url.includes(p));
    const urlMatchesApi = looksLikeOurApi && !isExcluded;

    if (!urlMatchesApi) {
      return next.handle(req);
    }

    const isRetry = req.headers.has(CRYPTO_RETRY_HEADER);
    return from(this.getTokenForRequest(req)).pipe(
      switchMap((token) => from(this.cryptoSession.getSessionKey(token))),
      switchMap(({ keyId, key }) => this.buildRequestWithKey(req, keyId, key, isRetry)),
      switchMap((newReq) => next.handle(newReq)),
      switchMap((event) => this.decryptResponseIfNeeded(event)),
      catchError((err) => this.handleCryptoError(err, req, next, isRetry))
    );
  }

  /**
   * Usa el token del header Authorization de la petición si existe, para evitar condición de carrera
   * justo después del login (getFreshFirebaseIdToken puede no estar listo aún).
   * Si la petición no trae token, obtiene uno fresco de Firebase.
   */
  private getTokenForRequest(req: HttpRequest<unknown>): Promise<string> {
    const authHeader = req.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      if (token) return Promise.resolve(token);
    }
    return this.getFreshFirebaseIdToken();
  }

  /** Gets a fresh Firebase idToken (force refresh) for the session-key handshake. */
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
   * Builds the request with encryption según documentación:
   * - GET (sin body): solo añade X-Session-Key-Id para que la respuesta venga cifrada.
   * - POST / PUT / PATCH / DELETE (con body): body en claro → cifrar AES-256-GCM → enviar body = { keyId, iv, ciphertext, tag }.
   * Nunca se envía body en claro en peticiones con body a la API.
   */
  private buildRequestWithKey(
    req: HttpRequest<unknown>,
    keyId: string,
    key: string,
    isRetry: boolean
  ): Observable<HttpRequest<unknown>> {
    const method = req.method.toUpperCase();
    const body = req.body;
    const methodHasBody = method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
    const hasBodyToEncrypt = methodHasBody && body != null && typeof body === 'object' && !this.isEncryptedEnvelopeBody(body);

    const addHeader = (r: HttpRequest<unknown>, b: unknown) => {
      const setHeaders: Record<string, string> = { 'X-Session-Key-Id': keyId };
      if (isRetry) setHeaders[CRYPTO_RETRY_HEADER] = '1';
      return r.clone({ setHeaders, body: b });
    };

    if (hasBodyToEncrypt) {
      if (!keyId || !key) {
        return throwError(() => new Error('Crypto: session key or keyId missing; cannot encrypt request body'));
      }
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
    const message = getErrorMessage(error.error);
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

  /**
   * Detecta si el body es una respuesta cifrada del backend y desde dónde viene el envelope.
   * Según el back: el body puede ser directamente el envelope { keyId, iv, ciphertext, tag }
   * o (por compatibilidad) venir envuelto en { success, data: envelope }.
   * @returns [envelope, envelopeWasInData] - si el envelope estaba en body.data, el backend cifró solo el contenido de data.
   */
  private getEncryptedEnvelopeFromBody(body: unknown): [EncryptedEnvelope, boolean] | null {
    const bodyIsEnvelope = isEncryptedEnvelope(body);
    const data = body && typeof body === 'object' && 'data' in body ? (body as Record<string, unknown>)['data'] : undefined;
    const dataIsEnvelope = !!data && isEncryptedEnvelope(data);
    if (bodyIsEnvelope) return [body as EncryptedEnvelope, false];
    if (dataIsEnvelope) return [data as EncryptedEnvelope, true];
    return null;
  }

  /**
   * Si la respuesta tiene body cifrado (envelope con keyId, iv, ciphertext, tag),
   * descifra con la clave de sesión y reemplaza el body por el JSON en claro.
   * Si el envelope estaba en body.data (ej. { success: true, data: EncryptedEnvelope }),
   * el backend cifró solo el valor de "data"; hay que dejar body como { success, data: decrypted }
   * para que los consumidores sigan recibiendo response.data.user, response.data.plans, etc.
   */
  private decryptResponseIfNeeded(
    event: HttpEvent<unknown>
  ): Observable<HttpEvent<unknown>> {
    const isHttpResponse = event instanceof HttpResponse;

    if (!isHttpResponse) {
      return of(event);
    }
    const res = event as HttpResponse<unknown>;
    let body = res.body;
    // Si el body llega como string (p. ej. Content-Type no aplicó parse), intentar parsear para detectar envelope
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body) as unknown;
      } catch {
        // No es JSON; dejar body como está y no habrá envelope
      }
    }

    const envelopeResult = this.getEncryptedEnvelopeFromBody(body);
    if (!envelopeResult) {
      return of(event);
    }
    const [envelope, envelopeWasInData] = envelopeResult;

    const stored = this.cryptoSession.getStoredKey();
    if (!stored) {
      return of(event);
    }

    return from(decryptResponseBody(envelope, stored.key)).pipe(
      map((decrypted) => {
        const inner = decrypted && typeof decrypted === 'object' && 'data' in decrypted && (decrypted as Record<string, unknown>)['data'] != null
          ? (decrypted as Record<string, unknown>)['data']
          : decrypted;
        const finalBody = envelopeWasInData && body && typeof body === 'object'
          ? { ...(body as Record<string, unknown>), data: inner }
          : decrypted;
        return res.clone({ body: finalBody });
      }),
      catchError((err) => throwError(() => err))
    );
  }
}
