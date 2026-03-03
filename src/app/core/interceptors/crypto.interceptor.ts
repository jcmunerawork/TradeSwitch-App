import { Injectable, inject } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpResponse,
} from '@angular/common/http';
import { Observable, from, of } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';
import { ConfigService } from '../services/config.service';
import { CryptoSessionService } from '../services/crypto-session.service';
import {
  encryptRequestBody,
  decryptResponseBody,
  isEncryptedEnvelope,
} from '../utils/encryption';

/** Rutas que no deben cifrarse (body se envía en claro). */
const EXCLUDED_PATH_PATTERNS = [
  'crypto/session-key',
  'payments/webhook',
];

@Injectable()
export class CryptoInterceptor implements HttpInterceptor {
  private config = inject(ConfigService);
  private cryptoSession = inject(CryptoSessionService);

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

    const method = req.method.toUpperCase();
    const hasBody = method === 'POST' || method === 'PUT' || method === 'PATCH';
    const body = req.body;

    if (hasBody && body != null && typeof body === 'object' && !this.isEncryptedEnvelopeBody(body)) {
      return from(this.cryptoSession.getSessionKey()).pipe(
        switchMap(({ keyId, key }) =>
          from(encryptRequestBody(body, key, keyId))
        ),
        switchMap((envelope) => {
          const encryptedReq = req.clone({ body: envelope });
          return next.handle(encryptedReq);
        }),
        switchMap((event) => this.decryptResponseIfNeeded(event))
      );
    }

    return next.handle(req).pipe(
      switchMap((event) => this.decryptResponseIfNeeded(event))
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
    if (!isEncryptedEnvelope(body)) {
      return of(event);
    }
    const stored = this.cryptoSession.getStoredKey();
    if (!stored) {
      return of(event);
    }
    return from(decryptResponseBody(body, stored.key)).pipe(
      map((decrypted) => res.clone({ body: decrypted }))
    );
  }
}
