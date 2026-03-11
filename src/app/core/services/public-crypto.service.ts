import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ConfigService } from './config.service';

@Injectable({ providedIn: 'root' })
export class PublicCryptoService {
  private http = inject(HttpClient);
  private config = inject(ConfigService);

  private publicKey: string | null = null;
  private loadingPromise: Promise<string | null> | null = null;

  /**
   * Obtiene la clave pública RSA del servidor.
   * La cachea para evitar múltiples llamadas.
   */
  async getPublicKey(): Promise<string | null> {
    if (this.publicKey) return this.publicKey;
    if (this.loadingPromise) return this.loadingPromise;

    const base = this.config.apiUrl.replace(/\/$/, '');
    const url = `${base}/v1/crypto/public-key`;

    this.loadingPromise = firstValueFrom(
      this.http.get<any>(url).pipe(
        map(res => {
          // Soporta { data: { publicKey } }, { publicKey }, y snake_case
          const data = res?.data || res;
          return data?.publicKey || data?.public_key;
        }),
        catchError(err => {// 
          return of(null);
        })
      )
    );

    const key = await this.loadingPromise;
    this.publicKey = key;
    this.loadingPromise = null;
    return key;
  }
}
