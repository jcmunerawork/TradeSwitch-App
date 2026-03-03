/**
 * Tests para CryptoSessionService (handshake de clave de sesión y almacenamiento).
 */

import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { CryptoSessionService } from './crypto-session.service';
import { ConfigService } from './config.service';
import type { SessionKeyResponse } from '../models/encryption.model';

const SESSION_KEY_STORAGE_KEY = 'ts_crypto_key';
const API_BASE = 'http://localhost:3000/api';
const SESSION_KEY_URL = `${API_BASE}/v1/crypto/session-key`;

describe('CryptoSessionService', () => {
  let service: CryptoSessionService;
  let httpMock: HttpTestingController;
  let configSpy: jasmine.SpyObj<Pick<ConfigService, 'apiUrl'>>;

  beforeEach(() => {
    sessionStorage.removeItem(SESSION_KEY_STORAGE_KEY);
    configSpy = jasmine.createSpyObj('ConfigService', [], {
      apiUrl: API_BASE,
    });

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        CryptoSessionService,
        { provide: ConfigService, useValue: configSpy },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });

    service = TestBed.inject(CryptoSessionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('getSessionKey', () => {
    it('debería llamar al backend y devolver keyId y key', async () => {
      const response: SessionKeyResponse = {
        keyId: 'key-123',
        key: btoa(String.fromCharCode(...new Array(32).fill(0))),
        expiresIn: 3600,
      };

      const promise = service.getSessionKey();
      const req = httpMock.expectOne(SESSION_KEY_URL);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({});
      req.flush(response);

      const result = await promise;
      expect(result.keyId).toBe('key-123');
      expect(result.key).toBe(response.key);
    });

    it('debería cachear la clave y no repetir la petición mientras sea válida', async () => {
      const response: SessionKeyResponse = {
        keyId: 'cached',
        key: btoa('x'.repeat(32)),
        expiresIn: 3600,
      };

      const r1 = service.getSessionKey();
      httpMock.expectOne(SESSION_KEY_URL).flush(response);
      await r1;

      const r2 = service.getSessionKey();
      httpMock.expectNone(SESSION_KEY_URL);
      const result = await r2;
      expect(result.keyId).toBe('cached');
    });

    it('debería fallar cuando el backend devuelve error', async () => {
      const promise = service.getSessionKey();
      const req = httpMock.expectOne(SESSION_KEY_URL);
      req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

      await expectAsync(promise).toBeRejected();
    });
  });

  describe('getStoredKey', () => {
    it('debería devolver null si no hay clave', () => {
      expect(service.getStoredKey()).toBeNull();
    });

    it('debería devolver la clave después de getSessionKey', async () => {
      const response: SessionKeyResponse = {
        keyId: 'stored',
        key: btoa('k'.repeat(32)),
        expiresIn: 3600,
      };
      const promise = service.getSessionKey();
      httpMock.expectOne(SESSION_KEY_URL).flush(response);
      await promise;

      const stored = service.getStoredKey();
      expect(stored).not.toBeNull();
      expect(stored!.keyId).toBe('stored');
      expect(stored!.key).toBe(response.key);
    });
  });

  describe('clearKey', () => {
    it('debería limpiar la clave en memoria', async () => {
      const response: SessionKeyResponse = {
        keyId: 'to-clear',
        key: btoa('c'.repeat(32)),
        expiresIn: 3600,
      };
      const promise = service.getSessionKey();
      httpMock.expectOne(SESSION_KEY_URL).flush(response);
      await promise;
      expect(service.getStoredKey()).not.toBeNull();

      service.clearKey();
      expect(service.getStoredKey()).toBeNull();
    });

    it('debería forzar una nueva petición en el siguiente getSessionKey', async () => {
      const response: SessionKeyResponse = {
        keyId: 'first',
        key: btoa('1'.repeat(32)),
        expiresIn: 3600,
      };
      const p1 = service.getSessionKey();
      httpMock.expectOne(SESSION_KEY_URL).flush(response);
      await p1;
      service.clearKey();

      const response2: SessionKeyResponse = {
        keyId: 'second',
        key: btoa('2'.repeat(32)),
        expiresIn: 3600,
      };
      const p2 = service.getSessionKey();
      const req = httpMock.expectOne(SESSION_KEY_URL);
      req.flush(response2);
      const result = await p2;
      expect(result.keyId).toBe('second');
    });
  });
});
