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
import { PublicCryptoService } from '../services/public-crypto.service';
import type { EncryptedEnvelope } from '../models/encryption.model';
import {
  encryptRequestBody,
  decryptResponseBody,
  isEncryptedEnvelope,
  generateTempAesKey,
  encryptKeyWithRsa,
} from '../utils/encryption';

/**
 * Paths that must NEVER go through any encryption:
 */
const FULL_EXCLUDED_PATH_PATTERNS = [
  'crypto/session-key',
  'payments/webhook',
  'crypto/public-key', // El endpoint de la llave pública va en claro
];

/**
 * Paths that use Hybrid RSA+AES Encryption (pre-login):
 */
const PUBLIC_AUTH_PATHS = [
  'auth/login',
  'auth/signup',
  'auth/register', // Añadido por si acaso
  'auth/forgot-password',
];

/** Header to mark retry and avoid retrying again. */
const CRYPTO_RETRY_HEADER = 'X-Crypto-Retry';
/** Header for the temporary AES key (encrypted with RSA). */
const TEMP_KEY_HEADER = 'X-Temp-Key';

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
  private publicCrypto = inject(PublicCryptoService);

  intercept(
    req: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    const url = req.url;
    const baseUrl = this.config.apiUrl.replace(/\/$/, '');
    const reqPath = getRequestPath(url);
    const apiPath = getApiPath(baseUrl);
    
    const looksLikeOurApi =
      url.startsWith(baseUrl) ||
      reqPath === apiPath ||
      reqPath.startsWith(apiPath + '/') ||
      reqPath.startsWith('/v1/') ||
      url.includes('/api/v1/') ||
      (url.includes('localhost:3000') && url.includes('/api/')) ||
      /^\/api\/v1\//.test(reqPath) ||
      /^\/v1\//.test(reqPath);

    const isFullExcluded = FULL_EXCLUDED_PATH_PATTERNS.some((p) => url.includes(p));
    if (!looksLikeOurApi || isFullExcluded) {
      return next.handle(req);
    }

    const isPublicAuth = PUBLIC_AUTH_PATHS.some((p) => url.includes(p));
    
    if (isPublicAuth) {
      // console.log('🔐 Crypto: Detectada ruta Auth Pública:', url);
      return this.handlePublicAuthEncryption(req, next);
    }

    return this.handleSessionEncryption(req, next);
  }

  /**
   * Flow for Unauthenticated Auth Routes (Login/Register):
   * 1. Get Server RSA Public Key.
   * 2. Generate temporary AES Key.
   * 3. Encrypt AES Key with RSA Public Key -> Header X-Temp-Key.
   * 4. Encrypt Body with AES Key.
   * 5. Decrypt response with the same temporary AES Key.
   */
  private handlePublicAuthEncryption(
    req: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    return from(this.publicCrypto.getPublicKey()).pipe(
      switchMap((rsaPublicKey) => {
        if (!rsaPublicKey) {
          console.warn('⚠️ Crypto: No se pudo obtener la clave pública RSA. El request irá en claro.');
          return next.handle(req);
        }
        return from(generateTempAesKey()).pipe(
          switchMap(({ key, base64 }) => {
            return from(encryptKeyWithRsa(base64, rsaPublicKey)).pipe(
              switchMap((encryptedAesKey) => {
                // console.log('🔐 Crypto: Cifrando request Auth con clave temporal...');
                return this.buildRequestWithKey(req, 'temp', key, false).pipe(
                  map((newReq) => newReq.clone({ setHeaders: { [TEMP_KEY_HEADER]: encryptedAesKey } })),
                  switchMap((newReq) => next.handle(newReq)),
                  switchMap((event) => this.decryptResponseIfNeeded(event, key))
                );
              }),
              catchError(err => {
                console.error('❌ Crypto: Error en el cifrado RSA/AES de Auth:', err);
                return next.handle(req);
              })
            );
          })
        );
      })
    );
  }

  /**
   * Flow for Authenticated API requests:
   * 1. Obtain session key (Firebase token needed).
   * 2. Header X-Session-Key-Id.
   * 3. Encrypt body.
   * 4. Decrypt response.
   */
  private handleSessionEncryption(
    req: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
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
   * justo después del login.
   */
  private getTokenForRequest(req: HttpRequest<unknown>): Promise<string> {
    const authHeader = req.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      if (token) return Promise.resolve(token);
    }
    return this.getFreshFirebaseIdToken();
  }

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
   * Builds the request with encryption:
   * - GET (sin body): añade keyId para que la respuesta venga cifrada.
   * - POST / etc (con body): cifra body as EncryptedEnvelope.
   * @param overrideKey Clave opcional para usar en lugar de la de sesión (usado en public auth).
   */
  private buildRequestWithKey(
    req: HttpRequest<unknown>,
    keyId: string,
    overrideKey?: string | CryptoKey,
    isRetry?: boolean
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

    const keyToUse = overrideKey || this.cryptoSession.getStoredKey()?.key;
    if (hasBodyToEncrypt) {
      if (!keyToUse) {
        return throwError(() => new Error('Crypto: encryption key missing; cannot encrypt request body'));
      }
      return from(encryptRequestBody(body, keyToUse, keyId)).pipe(
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

  private getEncryptedEnvelopeFromBody(body: unknown): [EncryptedEnvelope, boolean] | null {
    const bodyIsEnvelope = isEncryptedEnvelope(body);
    const data = body && typeof body === 'object' && 'data' in body ? (body as Record<string, unknown>)['data'] : undefined;
    const dataIsEnvelope = !!data && isEncryptedEnvelope(data);
    if (bodyIsEnvelope) return [body as EncryptedEnvelope, false];
    if (dataIsEnvelope) return [data as EncryptedEnvelope, true];
    return null;
  }

  /**
   * @param overrideKey Clave opcional para descifrar (usado en public auth).
   */
  private decryptResponseIfNeeded(
    event: HttpEvent<unknown>,
    overrideKey?: string | CryptoKey
  ): Observable<HttpEvent<unknown>> {
    const isHttpResponse = event instanceof HttpResponse;

    if (!isHttpResponse) {
      return of(event);
    }
    const res = event as HttpResponse<unknown>;
    let body = res.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body) as unknown;
      } catch {
        // No es JSON
      }
    }

    const envelopeResult = this.getEncryptedEnvelopeFromBody(body);
    if (!envelopeResult) {
      return of(event);
    }
    const [envelope, envelopeWasInData] = envelopeResult;

    const keyToDecrypt = overrideKey || this.cryptoSession.getStoredKey()?.key;
    if (!keyToDecrypt) {
      return of(event);
    }

    return from(decryptResponseBody(envelope, keyToDecrypt)).pipe(
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
