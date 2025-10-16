import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

interface BalanceData {
  balance: number;
  timestamp: number;
  accountId: string;
}

@Injectable({
  providedIn: 'root'
})
export class BalanceCacheService {
  private balanceCache = new Map<string, BalanceData>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutos
  private balanceSubject = new BehaviorSubject<number>(0);

  /**
   * Obtener balance desde cache o localStorage
   */
  getBalance(accountId: string): number {
    // 1. Verificar cache en memoria
    const cachedBalance = this.balanceCache.get(accountId);
    if (cachedBalance && this.isCacheValid(cachedBalance.timestamp)) {
      return cachedBalance.balance;
    }

    // 2. Verificar localStorage
    const localStorageKey = `balance_${accountId}`;
    const storedBalance = localStorage.getItem(localStorageKey);
    if (storedBalance) {
      try {
        const balanceData: BalanceData = JSON.parse(storedBalance);
        if (this.isCacheValid(balanceData.timestamp)) {
          // Actualizar cache en memoria
          this.balanceCache.set(accountId, balanceData);
          return balanceData.balance;
        }
      } catch (error) {
        console.warn('Error parsing stored balance:', error);
      }
    }

    return 0; // Valor por defecto
  }

  /**
   * Guardar balance en cache y localStorage
   */
  setBalance(accountId: string, balance: number): void {
    const balanceData: BalanceData = {
      balance,
      timestamp: Date.now(),
      accountId
    };

    // Guardar en cache en memoria
    this.balanceCache.set(accountId, balanceData);

    // Guardar en localStorage
    const localStorageKey = `balance_${accountId}`;
    localStorage.setItem(localStorageKey, JSON.stringify(balanceData));

    // Emitir cambio
    this.balanceSubject.next(balance);
  }

  /**
   * Verificar si el cache es válido
   */
  private isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < this.CACHE_DURATION;
  }

  /**
   * Limpiar cache expirado
   */
  clearExpiredCache(): void {
    const now = Date.now();
    this.balanceCache.forEach((value, key) => {
      if (!this.isCacheValid(value.timestamp)) {
        this.balanceCache.delete(key);
        localStorage.removeItem(`balance_${key}`);
      }
    });
  }

  /**
   * Limpiar todo el cache
   */
  clearAllCache(): void {
    this.balanceCache.clear();
    // Limpiar localStorage
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('balance_')) {
        localStorage.removeItem(key);
      }
    });
  }

  /**
   * Observable para cambios de balance
   */
  getBalanceObservable(): Observable<number> {
    return this.balanceSubject.asObservable();
  }

  /**
   * Verificar si necesita actualizar el balance
   */
  needsUpdate(accountId: string): boolean {
    const cachedBalance = this.balanceCache.get(accountId);
    if (!cachedBalance) return true;
    
    return !this.isCacheValid(cachedBalance.timestamp);
  }
}
