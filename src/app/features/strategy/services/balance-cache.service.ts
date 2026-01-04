import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

interface BalanceData {
  balance: number;
  timestamp: number;
  accountId: string;
}

/**
 * Service for caching account balance data.
 *
 * This service provides caching for account balances with a 5-minute expiration.
 * It uses both in-memory cache and localStorage for persistence across page reloads.
 * Includes an Observable for real-time balance updates.
 *
 * Features:
 * - In-memory and localStorage caching
 * - 5-minute cache expiration
 * - Observable for balance changes
 * - Automatic cache cleanup
 *
 * Used in:
 * - StrategyComponent: Caching balances for risk calculations
 * - TradingAccountsComponent: Caching account balances
 *
 * @injectable
 * @providedIn root
 */
@Injectable({
  providedIn: 'root'
})
export class BalanceCacheService {
  private balanceCache = new Map<string, BalanceData>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutos
  private balanceSubject = new BehaviorSubject<number>(0);

  /**
   * Obtener balance desde cache en memoria
   * Los balances ya se guardan en Firebase/Backend, no es necesario localStorage
   */
  getBalance(accountId: string): number {
    // Verificar cache en memoria
    const cachedBalance = this.balanceCache.get(accountId);
    if (cachedBalance && this.isCacheValid(cachedBalance.timestamp)) {
      return cachedBalance.balance;
    }

    return 0; // Valor por defecto
  }

  /**
   * Guardar balance en cache en memoria
   * Los balances ya se guardan en Firebase/Backend, no es necesario localStorage
   */
  setBalance(accountId: string, balance: number): void {
    const balanceData: BalanceData = {
      balance,
      timestamp: Date.now(),
      accountId
    };

    // Guardar en cache en memoria
    this.balanceCache.set(accountId, balanceData);

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
      }
    });
  }

  /**
   * Limpiar todo el cache
   */
  clearAllCache(): void {
    this.balanceCache.clear();
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
