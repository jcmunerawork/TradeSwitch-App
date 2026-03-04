/**
 * Tests para CryptoInterceptor: cifrado de body en peticiones y descifrado de respuestas.
 */

import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { HTTP_INTERCEPTORS, HttpClient } from '@angular/common/http';
import { ConfigService } from '../services/config.service';
import { CryptoSessionService } from '../services/crypto-session.service';
import { CryptoInterceptor } from './crypto.interceptor';
import {
  encryptRequestBody,
  decryptResponseBody,
  isEncryptedEnvelope,
} from '../utils/encryption';
import type { EncryptedEnvelope } from '../models/encryption.model';

const API_BASE = 'http://localhost:3000/api';

describe('CryptoInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let configSpy: jasmine.SpyObj<Pick<ConfigService, 'apiUrl'>>;
  let cryptoSessionSpy: jasmine.SpyObj<Pick<CryptoSessionService, 'getSessionKey' | 'getStoredKey'>>;

  beforeEach(() => {
    configSpy = jasmine.createSpyObj('ConfigService', [], {
      apiUrl: API_BASE,
    });

    cryptoSessionSpy = jasmine.createSpyObj('CryptoSessionService', [
      'getSessionKey',
      'getStoredKey',
    ]);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: ConfigService, useValue: configSpy },
        { provide: CryptoSessionService, useValue: cryptoSessionSpy },
        {
          provide: HTTP_INTERCEPTORS,
          useClass: CryptoInterceptor,
          multi: true,
        },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('peticiones fuera de la API base', () => {
    it('no debería cifrar ni tocar la petición a otra URL', (done) => {
      http.get('https://other.com/data').subscribe({
        next: () => done(),
        error: done.fail,
      });
      const req = httpMock.expectOne('https://other.com/data');
      expect(req.request.body).toBeNull();
      expect(cryptoSessionSpy.getSessionKey).not.toHaveBeenCalled();
      req.flush({ ok: true });
    });
  });

  describe('rutas excluidas del cifrado', () => {
    it('no debería cifrar POST a crypto/session-key', (done) => {
      const url = `${API_BASE}/v1/crypto/session-key`;
      http.post(url, {}).subscribe({
        next: (res) => {
          expect(res).toEqual({ keyId: 'x', key: 'y', expiresIn: 3600 });
          done();
        },
        error: done.fail,
      });
      const req = httpMock.expectOne(url);
      expect(req.request.body).toEqual({});
      expect(cryptoSessionSpy.getSessionKey).not.toHaveBeenCalled();
      req.flush({ keyId: 'x', key: 'y', expiresIn: 3600 });
    });

    it('no debería cifrar POST a payments/webhook', (done) => {
      const url = `${API_BASE}/v1/payments/webhook`;
      http.post(url, { event: 'payment' }).subscribe({
        next: () => done(),
        error: done.fail,
      });
      const req = httpMock.expectOne(url);
      expect(req.request.body).toEqual({ event: 'payment' });
      expect(cryptoSessionSpy.getSessionKey).not.toHaveBeenCalled();
      req.flush({ received: true });
    });
  });

  describe('peticiones con body (POST) a la API', () => {
    it('debería cifrar el body y descifrar la respuesta cuando viene cifrada', (done) => {
      const keyB64 = btoa(String.fromCharCode(...new Uint8Array(32).fill(1)));
      const keyId = 'test-key';
      cryptoSessionSpy.getSessionKey.and.returnValue(
        Promise.resolve({ keyId, key: keyB64 })
      );
      cryptoSessionSpy.getStoredKey.and.returnValue({ keyId, key: keyB64 });

      const plainBody = { email: 'u@test.com', name: 'User' };
      const url = `${API_BASE}/v1/users`;

      encryptRequestBody(plainBody, keyB64, keyId).then((encryptedResponse) => {
        http.post<unknown>(url, plainBody).subscribe({
          next: (data) => {
            expect(data).toEqual(plainBody);
            done();
          },
          error: (err) => done.fail(err),
        });
        setTimeout(() => {
          const req = httpMock.expectOne(url);
          expect(req.request.method).toBe('POST');
          const sentBody = req.request.body as EncryptedEnvelope;
          expect(sentBody.keyId).toBe(keyId);
          expect(sentBody.iv).toBeDefined();
          expect(sentBody.ciphertext).toBeDefined();
          expect(sentBody.tag).toBeDefined();
          expect(isEncryptedEnvelope(sentBody)).toBe(true);
          req.flush(encryptedResponse);
        }, 0);
      });
    });

    it('debería dejar la respuesta en claro si no es EncryptedEnvelope', (done) => {
      const keyB64 = btoa(String.fromCharCode(...new Uint8Array(32).fill(2)));
      cryptoSessionSpy.getSessionKey.and.returnValue(
        Promise.resolve({ keyId: 'k', key: keyB64 })
      );
      cryptoSessionSpy.getStoredKey.and.returnValue(null);

      const url = `${API_BASE}/v1/some-get-like`;
      http.post(url, { q: 1 }).subscribe({
        next: (data) => {
          expect(data).toEqual({ success: true, data: [] });
          done();
        },
        error: (err) => done.fail(err),
      });
      setTimeout(() => {
        const req = httpMock.expectOne(url);
        req.flush({ success: true, data: [] });
      }, 0);
    });
  });

  describe('peticiones GET (sin body)', () => {
    it('debería llamar getSessionKey, añadir X-Session-Key-Id y no cifrar body', (done) => {
      const keyId = 'get-key-id';
      cryptoSessionSpy.getSessionKey.and.returnValue(
        Promise.resolve({ keyId, key: btoa('x'.repeat(32)) })
      );
      cryptoSessionSpy.getStoredKey.and.returnValue({ keyId, key: btoa('x'.repeat(32)) });
      const url = `${API_BASE}/v1/accounts`;
      http.get(url).subscribe({
        next: () => done(),
        error: done.fail,
      });
      setTimeout(() => {
        const req = httpMock.expectOne(url);
        expect(req.request.body).toBeNull();
        expect(cryptoSessionSpy.getSessionKey).toHaveBeenCalled();
        expect(req.request.headers.get('X-Session-Key-Id')).toBe(keyId);
        req.flush([]);
      }, 0);
    });
  });

  describe('respuesta cifrada (EncryptedEnvelope)', () => {
    it('debería descifrar el body cuando getStoredKey devuelve clave', (done) => {
      const keyB64 = btoa(String.fromCharCode(...new Uint8Array(32).fill(3)));
      const keyId = 'k3';
      cryptoSessionSpy.getSessionKey.and.returnValue(
        Promise.resolve({ keyId, key: keyB64 })
      );
      cryptoSessionSpy.getStoredKey.and.returnValue({ keyId, key: keyB64 });

      const plainBody = { id: 1, name: 'Test' };
      const url = `${API_BASE}/v1/items`;

      encryptRequestBody(plainBody, keyB64, keyId).then((envelope) => {
        http.post<unknown>(url, plainBody).subscribe({
          next: (data) => {
            expect(data).toEqual(plainBody);
            done();
          },
          error: (err) => done.fail(err),
        });
        setTimeout(() => {
          const req = httpMock.expectOne(url);
          req.flush(envelope);
        }, 0);
      });
    });

    it('no debería descifrar si getStoredKey es null (dejar body como viene)', (done) => {
      cryptoSessionSpy.getSessionKey.and.returnValue(
        Promise.resolve({ keyId: 'k', key: btoa('x'.repeat(32)) })
      );
      cryptoSessionSpy.getStoredKey.and.returnValue(null);

      const envelope = { keyId: 'k', iv: 'a', ciphertext: 'b', tag: 'c' };
      const url = `${API_BASE}/v1/items`;

      http.post(url, { foo: 1 }).subscribe({
        next: (data) => {
          expect(data).toEqual(envelope);
          done();
        },
        error: (err) => done.fail(err),
      });
      setTimeout(() => {
        const req = httpMock.expectOne(url);
        req.flush(envelope);
      }, 0);
    });
  });

  describe('fallos', () => {
    it('debería propagar error si getSessionKey falla', (done) => {
      cryptoSessionSpy.getSessionKey.and.returnValue(
        Promise.reject(new Error('No session key'))
      );
      http.post(`${API_BASE}/v1/users`, { a: 1 }).subscribe({
        next: () => done.fail('expected error'),
        error: (err: Error) => {
          expect(err.message).toContain('No session key');
          done();
        },
      });
      // No se envía ninguna petición HTTP porque el interceptor falla antes
    });
  });
});
