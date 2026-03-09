import { Inject, Injectable, PLATFORM_ID, OnDestroy } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TradingHistoryDocument } from '../models/trading-history.model';
import { LoggerService } from '../../../core/services';
import { BackendApiService } from '../../../core/services/backend-api.service';
import { getAuth } from 'firebase/auth';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase/firebase.init';
import { AppContextService } from '../../../shared/context';
import { Subscription } from 'rxjs';

/**
 * Service for synchronizing trading history via backend API.
 * 
 * This service manages the complete lifecycle of trading history data:
 * - Loads trading history from backend (which reads from Firebase)
 * - Synchronizes historical data from TradeLocker API via backend
 * - Backend handles: fetching, caching, merging, calculating metrics, and saving to Firebase
 * - Solo API REST
 * - Handles errors gracefully with fallback values
 * 
 * Features:
 * - All Firebase operations go through backend API
 * - Backend handles incremental synchronization
 * - Backend handles instrument name caching
 * - Backend preserves createdDate for open positions
 * - Backend calculates aggregated metrics
 * - Robust error handling
 * 
 * Data Structure:
 * - Stored in: `users/{userId}/trading_history/{accountId}` (managed by backend)
 * - Contains: positions, metrics, sync metadata, instrument cache
 * 
 * Relations:
 * - BackendApiService: All Firebase operations
 * - ReportService: Fetches trading history and instrument details
 * - ReportComponent: Uses this service to load and display data
 * 
 * @service
 * @injectable
 * @providedIn root
 */
@Injectable({
  providedIn: 'root'
})
export class TradingHistorySyncService implements OnDestroy {
  private isBrowser: boolean;
  private syncIntervalRef: any;
  private authSub?: Subscription;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private logger: LoggerService,
    private backendApi: BackendApiService,
    private appContext: AppContextService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);

    if (this.isBrowser) {
      this.authSub = this.appContext.currentUser$.subscribe(user => {
        if (user && user.id) {
          this.startPeriodicSync(user.id);
        } else {
          this.stopPeriodicSync();
        }
      });
    }
  }

  ngOnDestroy(): void {
    this.stopPeriodicSync();
    if (this.authSub) {
      this.authSub.unsubscribe();
    }
  }

  private startPeriodicSync(userId: string): void {
    if (this.syncIntervalRef) return;

    const SYNC_INTERVAL_MS = 30000;
    console.log('🔄 [TradingHistorySync] Activando sincronización periódica (30s) para usuario:', userId);
    this.logger.debug('Starting periodic sync polling every 30s', 'TradingHistorySyncService', { userId });

    this.syncIntervalRef = setInterval(async () => {
      try {
        const historyRef = collection(db, 'users', userId, 'trading_history');
        const q = query(historyRef, orderBy('syncMetadata.sync_at', 'desc'), limit(1));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const latestDoc = querySnapshot.docs[0];
          const accountId = latestDoc.id;
          
          console.log('📡 [TradingHistorySync] Ejecutando sync periódico para cuenta:', accountId);
          this.logger.debug('Initiating background sync for latest account', 'TradingHistorySyncService', { accountId });
          const idToken = await this.getIdToken();
          const response = await this.backendApi.syncTradingHistory(accountId, idToken);
          
          if (response.success) {
            console.log('✅ [TradingHistorySync] Sync completado con éxito para:', accountId);
          } else {
            console.log('⚠️ [TradingHistorySync] Sync respondió con fallo:', response.error?.message || 'Error desconocido');
          }
        }
      } catch (err) {
        this.logger.error('Background periodic sync failed', 'TradingHistorySyncService', err);
      }
    }, SYNC_INTERVAL_MS);
  }

  private stopPeriodicSync(): void {
    if (this.syncIntervalRef) {
      clearInterval(this.syncIntervalRef);
      this.syncIntervalRef = null;
      console.log('⏹️ [TradingHistorySync] Sincronización periódica detenida');
      this.logger.debug('Stopped periodic sync polling', 'TradingHistorySyncService');
    }
  }

  /**
   * Get Firebase ID token for backend API calls
   */
  private async getIdToken(): Promise<string> {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('User not authenticated');
    }
    return await currentUser.getIdToken();
  }

  /**
   * Load trading history from backend (which reads from Firebase).
   * Returns null if not found or on error.
   */
  async loadFromFirebase(userId: string, accountId: string): Promise<TradingHistoryDocument | null> {
    if (!this.isBrowser) {
      this.logger.warn('Not available in SSR', 'TradingHistorySyncService');
      return null;
    }

    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.getTradingHistory(accountId, idToken);

      if (response.success && response.data) {
        const data = ((response.data as any)?.data ?? response.data) as TradingHistoryDocument;
        this.logger.debug('Trading history loaded from backend', 'TradingHistorySyncService', {
          accountId,
          positionsCount: Object.keys(data?.positions || {}).length
        });
        return data;
      } else {
        this.logger.debug('No trading history found', 'TradingHistorySyncService', { accountId });
        return null;
      }
    } catch (error) {
      this.logger.error('Error loading trading history from backend', 'TradingHistorySyncService', error);
      return null;
    }
  }

}

