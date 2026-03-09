import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AccountData } from '../../features/auth/models/userModel';

/**
 * Service for caching account data in-memory.
 *
 * This service provides a centralized in-memory cache for storing account data
 * to avoid redundant backend queries.
 *
 * Features:
 * - In-memory caching of accounts
 * - Cache size tracking
 * - Cache clearing functionality
 *
 * @injectable
 * @providedIn root
 */
@Injectable({
  providedIn: 'root'
})
export class AccountsCacheService {
  private accountsCache: Map<string, AccountData[]> = new Map();
  private isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  /**
   * Almacenar cuentas en el cache
   */
  setAccounts(userId: string, accounts: AccountData[]): void {
    this.accountsCache.set(userId, accounts);
  }

  /**
   * Obtener cuentas del cache
   */
  getAccounts(userId: string): AccountData[] | null {
    return this.accountsCache.get(userId) || null;
  }

  /**
   * Verificar si el cache está cargado para un usuario
   */
  isCacheLoaded(userId: string): boolean {
    return this.accountsCache.has(userId) && (this.accountsCache.get(userId)?.length ?? 0) > 0;
  }

  /**
   * Limpiar cache de un usuario específico
   */
  clearUserCache(userId: string): void {
    this.accountsCache.delete(userId);
  }

  /**
   * Limpiar todo el cache
   */
  clearCache(): void {
    this.accountsCache.clear();
  }

  /**
   * Obtener todas las cuentas del cache
   */
  getAllCachedAccounts(): Map<string, AccountData[]> {
    return this.accountsCache;
  }

  /**
   * Obtener el tamaño del cache
   */
  getCacheSize(): number {
    return this.accountsCache.size;
  }
}
