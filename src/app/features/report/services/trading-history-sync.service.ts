import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TradingHistoryDocument } from '../models/trading-history.model';
import { LoggerService } from '../../../core/services';
import { BackendApiService } from '../../../core/services/backend-api.service';
import { getAuth } from 'firebase/auth';

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
export class TradingHistorySyncService {
  private isBrowser: boolean;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private logger: LoggerService,
    private backendApi: BackendApiService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
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

