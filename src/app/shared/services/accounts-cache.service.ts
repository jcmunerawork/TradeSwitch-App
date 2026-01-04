import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AccountData } from '../../features/auth/models/userModel';
import * as CryptoJS from 'crypto-js';

/**
 * Service for caching account data in memory and localStorage with encryption.
 *
 * This service provides a centralized cache for storing account data
 * to avoid redundant backend queries. Sensitive data (passwords, emails)
 * is encrypted before storing in localStorage.
 *
 * Features:
 * - In-memory caching of accounts
 * - localStorage persistence with encryption for sensitive data
 * - Cache size tracking
 * - Cache clearing functionality
 * - Automatic cache synchronization
 *
 * Used in:
 * - AccountsOperationsService: Caching accounts during operations
 * - All CRUD operations: Refreshing cache after changes
 *
 * @injectable
 * @providedIn root
 */
@Injectable({
  providedIn: 'root'
})
export class AccountsCacheService {
  private readonly STORAGE_KEY = 'tradeswitch_accounts_cache';
  private readonly STORAGE_TIMESTAMP_KEY = 'tradeswitch_accounts_cache_timestamp';
  private readonly ENCRYPTION_KEY = 'tradeswitch_accounts_encryption_key_v1'; // En producción, usar una clave más segura
  private accountsCache: Map<string, AccountData[]> = new Map();
  private isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (this.isBrowser) {
      // Cargar cache desde localStorage al inicializar
      this.loadFromLocalStorage();
    }
  }

  /**
   * Almacenar cuentas en el cache (memoria y localStorage)
   */
  setAccounts(userId: string, accounts: AccountData[]): void {
    this.accountsCache.set(userId, accounts);
    if (this.isBrowser) {
      this.saveToLocalStorage();
    }
  }

  /**
   * Obtener cuentas del cache (primero memoria, luego localStorage)
   */
  getAccounts(userId: string): AccountData[] | null {
    // Primero intentar desde memoria
    const cached = this.accountsCache.get(userId);
    if (cached) {
      return cached;
    }

    // Si no está en memoria, intentar desde localStorage
    if (this.isBrowser) {
      this.loadFromLocalStorage();
      return this.accountsCache.get(userId) || null;
    }

    return null;
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
    if (this.isBrowser) {
      this.saveToLocalStorage();
    }
  }

  /**
   * Limpiar todo el cache (memoria y localStorage)
   */
  clearCache(): void {
    this.accountsCache.clear();
    if (this.isBrowser) {
      try {
        localStorage.removeItem(this.STORAGE_KEY);
        localStorage.removeItem(this.STORAGE_TIMESTAMP_KEY);
      } catch (error) {
        console.warn('Error clearing localStorage cache:', error);
      }
    }
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

  /**
   * Cifrar datos sensibles de una cuenta
   */
  private encryptAccount(account: AccountData): AccountData {
    const encrypted = { ...account };
    
    // Cifrar información sensible
    if (encrypted.brokerPassword) {
      encrypted.brokerPassword = CryptoJS.AES.encrypt(
        encrypted.brokerPassword,
        this.ENCRYPTION_KEY
      ).toString();
    }
    
    if (encrypted.emailTradingAccount) {
      encrypted.emailTradingAccount = CryptoJS.AES.encrypt(
        encrypted.emailTradingAccount,
        this.ENCRYPTION_KEY
      ).toString();
    }
    
    return encrypted;
  }

  /**
   * Descifrar datos sensibles de una cuenta
   */
  private decryptAccount(account: AccountData): AccountData {
    const decrypted = { ...account };
    
    // Descifrar información sensible
    if (decrypted.brokerPassword) {
      try {
        const bytes = CryptoJS.AES.decrypt(decrypted.brokerPassword, this.ENCRYPTION_KEY);
        decrypted.brokerPassword = bytes.toString(CryptoJS.enc.Utf8);
      } catch (error) {
        console.warn('Error decrypting brokerPassword, might be already decrypted:', error);
        // Si falla, asumir que ya está descifrado
      }
    }
    
    if (decrypted.emailTradingAccount) {
      try {
        const bytes = CryptoJS.AES.decrypt(decrypted.emailTradingAccount, this.ENCRYPTION_KEY);
        decrypted.emailTradingAccount = bytes.toString(CryptoJS.enc.Utf8);
      } catch (error) {
        console.warn('Error decrypting emailTradingAccount, might be already decrypted:', error);
        // Si falla, asumir que ya está descifrado
      }
    }
    
    return decrypted;
  }

  /**
   * Guardar cache en localStorage con cifrado
   */
  private saveToLocalStorage(): void {
    if (!this.isBrowser) return;

    try {
      const cacheObject: { [userId: string]: AccountData[] } = {};
      
      // Cifrar todas las cuentas antes de guardar
      this.accountsCache.forEach((accounts, userId) => {
        cacheObject[userId] = accounts.map(account => this.encryptAccount(account));
      });

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cacheObject));
      localStorage.setItem(this.STORAGE_TIMESTAMP_KEY, Date.now().toString());
    } catch (error) {
      console.warn('Error saving accounts to localStorage:', error);
      // Si hay error (por ejemplo, quota exceeded), limpiar cache antiguo
      try {
        localStorage.removeItem(this.STORAGE_KEY);
        localStorage.removeItem(this.STORAGE_TIMESTAMP_KEY);
      } catch (clearError) {
        console.error('Error clearing localStorage:', clearError);
      }
    }
  }

  /**
   * Cargar cache desde localStorage y descifrar
   */
  private loadFromLocalStorage(): void {
    if (!this.isBrowser) return;

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const cacheObject = JSON.parse(stored) as { [userId: string]: AccountData[] };
        
        // Descifrar todas las cuentas al cargar
        this.accountsCache = new Map(
          Object.entries(cacheObject).map(([userId, accounts]) => [
            userId,
            accounts.map(account => this.decryptAccount(account))
          ])
        );
      }
    } catch (error) {
      console.warn('Error loading accounts from localStorage:', error);
      this.accountsCache.clear();
    }
  }

  /**
   * Obtener timestamp del último guardado del cache
   */
  getCacheTimestamp(): number | null {
    if (!this.isBrowser) return null;

    try {
      const timestamp = localStorage.getItem(this.STORAGE_TIMESTAMP_KEY);
      return timestamp ? parseInt(timestamp, 10) : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Limpiar datos legacy de localStorage que ya no se usan
   * Elimina: balance_{accountId}, tradeSwitch_currentAccount, tradeSwitch_accountsData
   */
  cleanupLegacyLocalStorage(): void {
    if (!this.isBrowser) return;

    try {
      // Eliminar balance_{accountId} (todos los que empiecen con "Balance_" o "balance_")
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('Balance_') || key.startsWith('balance_'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));

      // Eliminar tradeSwitch_currentAccount y tradeSwitch_accountsData si existen
      localStorage.removeItem('tradeSwitch_currentAccount');
      localStorage.removeItem('tradeSwitch_accountsData');
      
      if (keysToRemove.length > 0) {
        console.log(`🧹 Limpiados ${keysToRemove.length} elementos legacy de localStorage`);
      }
    } catch (error) {
      console.warn('Error limpiando localStorage legacy:', error);
    }
  }
}

