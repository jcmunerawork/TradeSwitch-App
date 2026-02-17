import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom, Observable } from 'rxjs';
import { ReportService } from '../service/report.service';
import { GroupedTradeFinal } from '../models/report.model';
import {
  TradingHistoryDocument,
  PositionData,
  TradingMetrics,
  SyncMetadata,
  InstrumentCacheEntry,
  StreamsPositionUpdate,
  SyncResult
} from '../models/trading-history.model';
import { LoggerService } from '../../../core/services';
import { AlertService } from '../../../core/services';
import { BackendApiService } from '../../../core/services/backend-api.service';
import { getAuth } from 'firebase/auth';

/**
 * Service for synchronizing trading history via backend API.
 * 
 * This service manages the complete lifecycle of trading history data:
 * - Loads trading history from backend (which reads from Firebase)
 * - Synchronizes historical data from TradeLocker API via backend
 * - Backend handles: fetching, caching, merging, calculating metrics, and saving to Firebase
 * - Updates from Streams API in real-time (future: should go through backend)
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
 * - StreamsService: Receives real-time position updates
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
    private reportService: ReportService,
    private logger: LoggerService,
    private alertService: AlertService,
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
        const data = response.data as TradingHistoryDocument;
        this.logger.debug('Trading history loaded from backend', 'TradingHistorySyncService', {
          accountId,
          positionsCount: Object.keys(data.positions || {}).length
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

  /**
   * Synchronize historical data from TradeLocker API to Firebase via backend.
   * 
   * DEPRECATED: This method has been removed as the /sync endpoint consumes too much resources
   * and the frontend doesn't benefit from it. Data is now loaded directly from Firebase.
   * 
   * @deprecated Use loadFromFirebase() instead
   */
  async syncHistoryFromAPI(
    userId: string,
    accountId: string,
    accNum: number
  ): Promise<SyncResult> {
    // Sync endpoint removed - return failure to indicate sync is not available
    this.logger.warn('syncHistoryFromAPI called but sync endpoint has been removed', 'TradingHistorySyncService', {
      accountId
    });
    
    return {
      success: false,
      error: 'Sync endpoint has been removed. Use loadFromFirebase() instead.'
    };
  }

  /**
   * Update trading history from Streams API.
   * 
   * Note: Streams updates should be handled by the backend in the future.
   * For now, this method loads data and processes updates locally, but
   * the actual persistence should go through the backend.
   */
  async updateFromStreams(
    userId: string,
    accountId: string,
    streamUpdate: StreamsPositionUpdate
  ): Promise<SyncResult> {
    if (!this.isBrowser) {
      return {
        success: false,
        error: 'Not available in SSR'
      };
    }

    try {
      // 1. Cargar datos actuales desde el backend
      const currentData = await this.loadFromFirebase(userId, accountId);
      
      if (!currentData) {
        // Si no hay datos, no podemos actualizar desde streams
        // Streams solo actualiza, no crea histórico completo
        this.logger.warn('No existing data to update from streams', 'TradingHistorySyncService', { accountId });
        return {
          success: false,
          error: 'No existing data to update'
        };
      }

      // 2. Actualizar/crear posiciones desde streams
      const updatedPositions = this.mergeStreamsUpdate(
        currentData.positions,
        streamUpdate
      );

      // 3. Recalcular métricas (solo cerrados)
      const metrics = this.calculateMetrics(updatedPositions);

      // NOTE: Sync endpoint removed - streams updates are handled by backend automatically
      // No need to manually trigger sync as it consumes too much resources

      return {
        success: true,
        positionsUpdated: 1,
        metricsUpdated: true
      };

    } catch (error) {
      this.logger.error('Error updating from streams', 'TradingHistorySyncService', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Fetch and cache instrument names.
   * Only fetches instruments that are not in cache.
   */
  private async fetchAndCacheInstruments(
    trades: GroupedTradeFinal[],
    accNum: number,
    userId: string,
    accountId: string
  ): Promise<{ [key: string]: InstrumentCacheEntry }> {
    // 1. Cargar cache de Firebase
    const existingData = await this.loadFromFirebase(userId, accountId);
    const cache = existingData?.instrumentCache || {};

    // 2. Identificar instrumentos únicos que faltan
    const uniqueInstruments = new Map<string, { tradableInstrumentId: string; routeId: string }>();
    const missingInstruments: string[] = [];

    trades.forEach(trade => {
      if (trade.tradableInstrumentId && trade.routeId) {
        const key = `${trade.tradableInstrumentId}-${trade.routeId}`;
        if (!cache[key]) {
          if (!uniqueInstruments.has(key)) {
            uniqueInstruments.set(key, {
              tradableInstrumentId: trade.tradableInstrumentId,
              routeId: trade.routeId
            });
            missingInstruments.push(key);
          }
        }
      }
    });

    // 3. Obtener detalles solo para los faltantes
    const newCacheEntries: { [key: string]: InstrumentCacheEntry } = {};

    for (const [key, instrument] of uniqueInstruments) {
      try {
        const details: any = await firstValueFrom(
          this.reportService.getInstrumentDetails(
            accountId,
            instrument.tradableInstrumentId,
            instrument.routeId,
            accNum
          )
        );

        newCacheEntries[key] = {
          name: details?.name || instrument.tradableInstrumentId,
          lotSize: details?.lotSize || 1,
          lastFetched: Date.now()
        };

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        this.logger.warn(`Error fetching instrument ${key}`, 'TradingHistorySyncService', error);
        // Usar valores por defecto
        newCacheEntries[key] = {
          name: instrument.tradableInstrumentId,
          lotSize: 1,
          lastFetched: Date.now()
        };
      }
    }

    // 4. Combinar cache existente con nuevos
    return {
      ...cache,
      ...newCacheEntries
    };
  }

  /**
   * Enrich trades with instrument names from cache.
   */
  private enrichTradesWithInstrumentNames(
    trades: GroupedTradeFinal[],
    instrumentMap: { [key: string]: InstrumentCacheEntry }
  ): GroupedTradeFinal[] {
    return trades.map(trade => {
      if (trade.tradableInstrumentId && trade.routeId) {
        const key = `${trade.tradableInstrumentId}-${trade.routeId}`;
        const instrumentInfo = instrumentMap[key];
        
        if (instrumentInfo) {
          return {
            ...trade,
            instrument: instrumentInfo.name
          };
        }
      }
      return trade;
    });
  }

  /**
   * Merge positions intelligently.
   * Preserves createdDate for existing open positions.
   */
  private mergePositions(
    existing: { [positionId: string]: PositionData },
    newTrades: GroupedTradeFinal[],
    source: 'history' | 'streams'
  ): { [positionId: string]: PositionData } {
    const merged: { [positionId: string]: PositionData } = { ...existing };

    newTrades.forEach(trade => {
      const existingPosition = merged[trade.positionId];
      const convertedPosition = this.convertToPositionData(trade, source);

      if (existingPosition && existingPosition.isOpen && !convertedPosition.isOpen) {
        // Posición que estaba abierta y ahora se cerró
        merged[trade.positionId] = {
          ...convertedPosition,
          createdDate: existingPosition.createdDate,
          openDate: existingPosition.openDate,
          closeDate: convertedPosition.closeDate || Date.now()
        };
      } else if (existingPosition && existingPosition.isOpen) {
        // Preservar createdDate de posición abierta existente
        merged[trade.positionId] = {
          ...convertedPosition,
          createdDate: existingPosition.createdDate,
          openDate: existingPosition.openDate
        };
      } else {
        // Nueva posición o actualización de cerrada
        merged[trade.positionId] = convertedPosition;
      }
    });

    return merged;
  }

  /**
   * Merge streams update into existing positions.
   */
  private mergeStreamsUpdate(
    existing: { [positionId: string]: PositionData },
    streamUpdate: StreamsPositionUpdate
  ): { [positionId: string]: PositionData } {
    const updated = { ...existing };
    const existingPosition = updated[streamUpdate.positionId];

    if (existingPosition) {
      // Actualizar posición existente
      updated[streamUpdate.positionId] = {
        ...existingPosition,
        pnl: streamUpdate.pnl !== undefined ? streamUpdate.pnl : existingPosition.pnl,
        isOpen: streamUpdate.isOpen !== undefined ? streamUpdate.isOpen : existingPosition.isOpen,
        lastModified: streamUpdate.lastModified || existingPosition.lastModified,
        syncedAt: Date.now(),
        source: 'streams',
        version: existingPosition.version + 1,
        closeDate: streamUpdate.isOpen === false ? Date.now() : existingPosition.closeDate
      };
    } else {
      // Nueva posición desde streams (raro, pero posible)
      // Nota: Streams normalmente no crea histórico completo, solo actualiza
      this.logger.warn('New position from streams (unexpected)', 'TradingHistorySyncService', {
        positionId: streamUpdate.positionId
      });
    }

    return updated;
  }

  /**
   * Convert GroupedTradeFinal to PositionData.
   */
  private convertToPositionData(
    trade: GroupedTradeFinal,
    source: 'history' | 'streams'
  ): PositionData {
    const openDate = trade.createdDate ? new Date(trade.createdDate).getTime() : undefined;
    const closeDate = !trade.isOpen && trade.lastModified ? new Date(trade.lastModified).getTime() : undefined;

    return {
      positionId: trade.positionId,
      id: trade.id,
      tradableInstrumentId: trade.tradableInstrumentId,
      routeId: trade.routeId,
      instrumentName: trade.instrument || trade.tradableInstrumentId,
      instrumentCode: trade.tradableInstrumentId,
      createdDate: trade.createdDate,
      lastModified: trade.lastModified,
      openDate,
      closeDate,
      qty: trade.qty,
      side: trade.side,
      type: trade.type,
      status: trade.status,
      filledQty: trade.filledQty,
      avgPrice: trade.avgPrice,
      price: trade.price,
      stopPrice: trade.stopPrice,
      validity: trade.validity,
      expireDate: trade.expireDate,
      stopLoss: trade.stopLoss,
      stopLossType: trade.stopLossType,
      takeProfit: trade.takeProfit,
      takeProfitType: trade.takeProfitType,
      strategyId: trade.strategyId,
      pnl: trade.pnl,
      isWon: trade.isWon,
      isOpen: trade.isOpen,
      syncedAt: Date.now(),
      source,
      version: 1
    };
  }

  /**
   * Calculate metrics from positions (only closed trades).
   */
  private calculateMetrics(positions: { [positionId: string]: PositionData }): TradingMetrics {
    // Filtrar solo trades cerrados
    const closedTrades = Object.values(positions).filter(
      p => !p.isOpen && p.pnl !== undefined && p.pnl !== null
    );

    if (closedTrades.length === 0) {
      return {
        totalPnL: 0,
        percentageTradeWin: 0,
        profitFactor: 0,
        totalTrades: 0,
        averageWinLossTrades: 0
      };
    }

    // Calcular métricas
    const totalPnL = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const wins = closedTrades.filter(t => (t.pnl || 0) > 0);
    const losses = closedTrades.filter(t => (t.pnl || 0) < 0);

    const percentageTradeWin = (wins.length / closedTrades.length) * 100;

    const grossProfit = wins.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const grossLoss = Math.abs(losses.reduce((sum, t) => sum + (t.pnl || 0), 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 999.99 : 0);

    const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
    const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;
    const averageWinLossTrades = avgLoss > 0 ? avgWin / avgLoss : (avgWin > 0 ? 999.99 : 0);

    return {
      totalPnL: Math.round(totalPnL * 100) / 100,
      percentageTradeWin: Math.round(percentageTradeWin * 10) / 10,
      profitFactor: Math.round(profitFactor * 100) / 100,
      totalTrades: closedTrades.length,
      averageWinLossTrades: Math.round(averageWinLossTrades * 100) / 100
    };
  }

  /**
   * Save trading history via backend (which saves to Firebase).
   * Note: This method is kept for backward compatibility but syncHistoryFromAPI
   * now handles saving through the backend endpoint.
   */
  private async saveToFirebase(
    userId: string,
    accountId: string,
    data: TradingHistoryDocument
  ): Promise<void> {
    // This method is no longer used directly since syncHistoryFromAPI
    // handles saving through the backend. Kept for backward compatibility.
    this.logger.debug('saveToFirebase called but saving is handled by backend sync endpoint', 'TradingHistorySyncService', { accountId });
  }

  /**
   * Update trading history via backend (which updates Firebase).
   * Note: This method is kept for backward compatibility but updates
   * should go through the backend sync endpoint.
   */
  private async updateInFirebase(
    userId: string,
    accountId: string,
    updates: Partial<TradingHistoryDocument>
  ): Promise<void> {
    // This method is no longer used directly since updates
    // should go through the backend sync endpoint. Kept for backward compatibility.
    this.logger.debug('updateInFirebase called but updates should go through backend sync endpoint', 'TradingHistorySyncService', { accountId });
  }

  /**
   * Create empty history result with initial values.
   * Note: Empty history creation is now handled by the backend sync endpoint.
   */
  private async createEmptyHistoryResult(
    userId: string,
    accountId: string
  ): Promise<SyncResult> {
    // Empty history is now created by the backend when sync is called with no data
    // Just return success result
    return {
      success: true,
      positionsAdded: 0,
      metricsUpdated: true
    };
  }

  /**
   * Convert PositionData back to GroupedTradeFinal for UI display.
   */
  convertToGroupedTradeFinal(position: PositionData): GroupedTradeFinal {
    return {
      id: position.id,
      tradableInstrumentId: position.tradableInstrumentId,
      routeId: position.routeId,
      qty: position.qty,
      side: position.side,
      type: position.type,
      status: position.status,
      filledQty: position.filledQty,
      avgPrice: position.avgPrice,
      price: position.price,
      stopPrice: position.stopPrice,
      validity: position.validity,
      expireDate: position.expireDate,
      createdDate: position.createdDate,
      lastModified: position.lastModified,
      isOpen: position.isOpen,
      positionId: position.positionId,
      stopLoss: position.stopLoss,
      stopLossType: position.stopLossType,
      takeProfit: position.takeProfit,
      takeProfitType: position.takeProfitType,
      strategyId: position.strategyId,
      instrument: position.instrumentName,
      pnl: position.pnl,
      isWon: position.isWon
    };
  }
}

