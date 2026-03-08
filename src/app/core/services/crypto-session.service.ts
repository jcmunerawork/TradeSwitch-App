import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from './config.service';
import type { SessionKeyResponse, SessionKeyApiResponse } from '../models/encryption.model';

const SESSION_KEY_STORAGE_KEY = 'ts_crypto_key';
/** Renovar la session key cada 50 min (backend TTL = 1 hora; así evitamos 400 por expirado). */
const REFRESH_INTERVAL_MS = 50 * 60 * 1000;
/** Tiempo antes de expiración para forzar renovación: 60 min - 50 min = 10 min. */
const RENEW_BEFORE_MS = 60 * 60 * 1000 - REFRESH_INTERVAL_MS;
/** Margen para considerar clave válida en memoria (mismo que renovación). */
const KEY_EXPIRY_BUFFER_MS = RENEW_BEFORE_MS;

@Injectable({ providedIn: 'root' })
export class CryptoSessionService {
  private http = inject(HttpClient);
  private config = inject(ConfigService);
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  private keyId: string | null = null;
  private key: string | null = null;
  private expiresAt: number | null = null;
  private refreshTimerId: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (this.isBrowser) {
      this.loadFromLocalStorage();
    }
  }

  private get sessionKeyUrl(): string {
    const base = this.config.apiUrl.replace(/\/$/, '');
    return `${base}/v1/crypto/session-key`;
  }

  /** Objeto completo guardado en localStorage (keyId, key, expiresIn, expiresAt). */
  private loadFromLocalStorage(): void {
    try {
      const raw = localStorage.getItem(SESSION_KEY_STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as {
        keyId: string;
        key: string;
        expiresAt: number;
        expiresIn?: number;
      };
      if (!data.keyId || !data.key || !data.expiresAt) return;
      if (data.expiresAt > Date.now() + KEY_EXPIRY_BUFFER_MS) {
        this.keyId = data.keyId;
        this.key = data.key;
        this.expiresAt = data.expiresAt;
        this.scheduleRefreshTimer(Math.max(0, Math.floor((data.expiresAt - Date.now()) / 1000)));
      } else {
        localStorage.removeItem(SESSION_KEY_STORAGE_KEY);
      }
    } catch {
      localStorage.removeItem(SESSION_KEY_STORAGE_KEY);
    }
  }

  /** Guarda el objeto completo de session key en localStorage. */
  private saveToLocalStorage(payload: {
    keyId: string;
    key: string;
    expiresIn: number;
    expiresAt: number;
  }): void {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(
        SESSION_KEY_STORAGE_KEY,
        JSON.stringify({
          keyId: payload.keyId,
          key: payload.key,
          expiresIn: payload.expiresIn,
          expiresAt: payload.expiresAt,
        })
      );
    } catch {
      // ignore storage failures
    }
  }

  private clearRefreshTimer(): void {
    if (this.refreshTimerId != null) {
      clearTimeout(this.refreshTimerId);
      this.refreshTimerId = null;
    }
  }

  /**
   * Programa la renovación: a los 50 min se limpia la clave para que la siguiente
   * petición pida una nueva (evita 400 por token expirado). Backend TTL = 1 h.
   */
  private scheduleRefreshTimer(expiresInSeconds: number): void {
    this.clearRefreshTimer();
    const renewInMs = Math.max(0, (expiresInSeconds * 1000) - RENEW_BEFORE_MS);
    if (renewInMs <= 0) return;
    this.refreshTimerId = setTimeout(() => {
      this.refreshTimerId = null;
      this.clearKey();
    }, renewInMs);
  }

  /**
   * Obtiene la clave de sesión: usa la cacheada si sigue válida (y con margen),
   * si no llama al backend con el token de Firebase indicado.
   * El front debe pasar siempre un Firebase idToken actual (p. ej. getIdToken(true))
   * para evitar 401 en el handshake.
   */
  async getSessionKey(firebaseIdToken: string): Promise<{ keyId: string; key: string }> {
    const now = Date.now();
    if (
      this.keyId &&
      this.key &&
      this.expiresAt &&
      this.expiresAt > now + KEY_EXPIRY_BUFFER_MS
    ) {
      return { keyId: this.keyId, key: this.key };
    }

    const res = await firstValueFrom(
      this.http.post<SessionKeyApiResponse | SessionKeyResponse>(this.sessionKeyUrl, {}, {
        headers: { Authorization: `Bearer ${firebaseIdToken}` },
      })
    );
    this.clearRefreshTimer();
    // Backend puede devolver { success, data: { keyId, key, expiresIn } } o plano
    const data: SessionKeyResponse =
      res && typeof (res as SessionKeyApiResponse).data === 'object'
        ? (res as SessionKeyApiResponse).data!
        : (res as SessionKeyResponse);
    if (!data?.keyId || !data?.key || typeof data.expiresIn !== 'number') {
      throw new Error('Invalid session key response: missing keyId, key or expiresIn');
    }
    this.keyId = data.keyId;
    this.key = data.key;
    this.expiresAt = now + data.expiresIn * 1000;
    this.saveToLocalStorage({
      keyId: data.keyId,
      key: data.key,
      expiresIn: data.expiresIn,
      expiresAt: this.expiresAt,
    });
    this.scheduleRefreshTimer(data.expiresIn);
    return { keyId: this.keyId, key: this.key };
  }

  /** Clave actual en memoria (para descifrar). Null si no hay o está expirada. */
  getStoredKey(): { keyId: string; key: string } | null {
    const now = Date.now();
    if (
      !this.keyId ||
      !this.key ||
      !this.expiresAt ||
      this.expiresAt <= now + KEY_EXPIRY_BUFFER_MS
    ) {
      return null;
    }
    return { keyId: this.keyId, key: this.key };
  }

  /** Limpia la clave (logout, 401, o al forzar renovación). */
  clearKey(): void {
    this.clearRefreshTimer();
    this.keyId = null;
    this.key = null;
    this.expiresAt = null;
    if (this.isBrowser) {
      try {
        localStorage.removeItem(SESSION_KEY_STORAGE_KEY);
      } catch {}
    }
  }
}
