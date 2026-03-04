import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from './config.service';
import type { SessionKeyResponse } from '../models/encryption.model';

const SESSION_KEY_STORAGE_KEY = 'ts_crypto_key';
const KEY_EXPIRY_BUFFER_MS = 60 * 1000; // renovar 1 min antes de expirar

@Injectable({ providedIn: 'root' })
export class CryptoSessionService {
  private http = inject(HttpClient);
  private config = inject(ConfigService);
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  private keyId: string | null = null;
  private key: string | null = null;
  private expiresAt: number | null = null;

  constructor() {
    if (this.isBrowser) {
      this.loadFromSessionStorage();
    }
  }

  private get sessionKeyUrl(): string {
    const base = this.config.apiUrl.replace(/\/$/, '');
    return `${base}/v1/crypto/session-key`;
  }

  private loadFromSessionStorage(): void {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY_STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as { keyId: string; key: string; expiresAt: number };
      if (data.expiresAt > Date.now() + KEY_EXPIRY_BUFFER_MS) {
        this.keyId = data.keyId;
        this.key = data.key;
        this.expiresAt = data.expiresAt;
      } else {
        sessionStorage.removeItem(SESSION_KEY_STORAGE_KEY);
      }
    } catch {
      sessionStorage.removeItem(SESSION_KEY_STORAGE_KEY);
    }
  }

  private saveToSessionStorage(): void {
    if (!this.isBrowser || !this.keyId || !this.key || !this.expiresAt) return;
    try {
      sessionStorage.setItem(
        SESSION_KEY_STORAGE_KEY,
        JSON.stringify({
          keyId: this.keyId,
          key: this.key,
          expiresAt: this.expiresAt,
        })
      );
    } catch {
      // ignore storage failures
    }
  }

  /**
   * Gets the session key: uses the cached one if still valid, otherwise calls the backend.
   * The auth token is added by AuthInterceptor when making the POST.
   */
  async getSessionKey(): Promise<{ keyId: string; key: string }> {
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
      this.http.post<SessionKeyResponse>(this.sessionKeyUrl, {})
    );
    this.keyId = res.keyId;
    this.key = res.key;
    this.expiresAt = now + res.expiresIn * 1000;
    this.saveToSessionStorage();
    return { keyId: this.keyId, key: this.key };
  }

  /** Current key in memory (for decrypting responses). Null if none or expired. */
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

  /** Clears the key (e.g. on logout or 401). */
  clearKey(): void {
    this.keyId = null;
    this.key = null;
    this.expiresAt = null;
    if (this.isBrowser) {
      try {
        sessionStorage.removeItem(SESSION_KEY_STORAGE_KEY);
      } catch {}
    }
  }
}
