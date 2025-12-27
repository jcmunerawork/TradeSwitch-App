import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { getFirestore, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
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

/**
 * Service for synchronizing trading history between API, Streams, and Firebase.
 * 
 * This service manages the complete lifecycle of trading history data:
 * - Fetches historical data from getHistory API
 * - Caches instrument names to avoid repeated API calls
 * - Stores data in Firebase for persistence
 * - Updates from Streams API in real-time
 * - Calculates aggregated metrics
 * - Handles errors gracefully with fallback values
 * 
 * Features:
 * - Incremental synchronization (only new/updated positions)
 * - Instrument name caching
 * - Preserves createdDate for open positions
 * - Real-time updates from Streams
 * - Robust error handling
 * 
 * Data Structure:
 * - Stored in: `users/{userId}/trading_history/{accountId}`
 * - Contains: positions, metrics, sync metadata, instrument cache
 * 
 * Relations:
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
  private db: ReturnType<typeof getFirestore> | null = null;
  private readonly COLLECTION_NAME = 'trading_history';

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private reportService: ReportService,
    private logger: LoggerService,
    private alertService: AlertService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (this.isBrowser) {
      const { firebaseApp } = require('../../../firebase/firebase.init.ts');
      this.db = getFirestore(firebaseApp);
    }
  }

  /**
   * Load trading history from Firebase.
   * Returns null if not found or on error.
   */
  async loadFromFirebase(userId: string, accountId: string): Promise<TradingHistoryDocument | null> {
    if (!this.db || !this.isBrowser) {
      this.logger.warn('Firebase not available (SSR)', 'TradingHistorySyncService');
      return null;
    }

    try {
      const docRef = doc(this.db, 'users', userId, this.COLLECTION_NAME, accountId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as TradingHistoryDocument;
        this.logger.debug('Trading history loaded from Firebase', 'TradingHistorySyncService', {
          accountId,
          positionsCount: Object.keys(data.positions || {}).length
        });
        return data;
      } else {
        this.logger.debug('No trading history found in Firebase', 'TradingHistorySyncService', { accountId });
        return null;
      }
    } catch (error) {
      this.logger.error('Error loading trading history from Firebase', 'TradingHistorySyncService', error);
      return null;
    }
  }

  /**
   * Synchronize historical data from getHistory API.
   * 
   * Process:
   * 1. Fetches history from API (with error handling)
   * 2. Fetches and caches instrument names
   * 3. Enriches trades with instrument names
   * 4. Merges with existing Firebase data
   * 5. Calculates metrics
   * 6. Saves to Firebase
   * 
   * Returns SyncResult with success status and details.
   */
  async syncHistoryFromAPI(
    userId: string,
    accountId: string,
    accessToken: string,
    accNum: number
  ): Promise<SyncResult> {
    if (!this.db || !this.isBrowser) {
      return {
        success: false,
        error: 'Firebase not available (SSR)'
      };
    }

    try {
      // 1. Obtener histórico desde API (con manejo de errores)
      let historyTrades: GroupedTradeFinal[] = [];
      
      try {
        const historyObservable = this.reportService.getHistoryData(accountId, accessToken, accNum);
        historyTrades = await firstValueFrom(historyObservable);
        
        if (!Array.isArray(historyTrades)) {
          this.logger.warn('Invalid history data format from API', 'TradingHistorySyncService');
          historyTrades = [];
        }
      } catch (apiError: any) {
        // Error al obtener datos de la API
        const errorMessage = apiError?.message || 'Error desconocido';
        const isAccountNotFound = errorMessage.includes('not found') || 
                                  errorMessage.includes('404') ||
                                  errorMessage.includes('Account not found');
        
        if (isAccountNotFound) {
          this.logger.warn('Account not found in API', 'TradingHistorySyncService', { accountId });
          this.alertService.showWarning(
            'La cuenta de trading no se encontró en la API. Se mostrarán valores iniciales.',
            'Cuenta no encontrada'
          );
        } else {
          this.logger.error('Error fetching history from API', 'TradingHistorySyncService', apiError);
          this.alertService.showError(
            'No se pudo obtener el historial de trading. Se mostrarán valores iniciales.',
            'Error al obtener historial'
          );
        }
        
        // Retornar datos vacíos con valores iniciales
        return this.createEmptyHistoryResult(userId, accountId);
      }

      // 2. Si no hay trades, crear estructura vacía
      if (historyTrades.length === 0) {
        this.logger.info('No trades found in history', 'TradingHistorySyncService', { accountId });
        return this.createEmptyHistoryResult(userId, accountId);
      }

      // 3. Obtener nombres de instrumentos únicos
      const instrumentMap = await this.fetchAndCacheInstruments(
        historyTrades,
        accessToken,
        accNum,
        userId,
        accountId
      );

      // 4. Enriquecer trades con nombres de instrumentos
      const enrichedTrades = this.enrichTradesWithInstrumentNames(historyTrades, instrumentMap);

      // 5. Cargar datos existentes de Firebase
      const existingData = await this.loadFromFirebase(userId, accountId);

      // 6. Merge: solo añadir posiciones nuevas, preservar createdDate de abiertas
      const mergedPositions = this.mergePositions(
        existingData?.positions || {},
        enrichedTrades,
        'history'
      );

      // 7. Calcular métricas (solo trades cerrados)
      const metrics = this.calculateMetrics(mergedPositions);

      // 8. Guardar en Firebase
      await this.saveToFirebase(userId, accountId, {
        accountId,
        positions: mergedPositions,
        metrics,
        syncMetadata: {
          lastHistorySync: Date.now(),
          lastStreamSync: existingData?.syncMetadata?.lastStreamSync || 0,
          lastFullSync: Date.now(),
          totalPositions: Object.keys(mergedPositions).length,
          closedPositions: Object.values(mergedPositions).filter(p => !p.isOpen).length,
          openPositions: Object.values(mergedPositions).filter(p => p.isOpen).length,
        },
        instrumentCache: {
          ...existingData?.instrumentCache,
          ...instrumentMap
        }
      });

      const positionsAdded = Object.keys(mergedPositions).length - (existingData ? Object.keys(existingData.positions).length : 0);

      this.logger.info('History sync completed', 'TradingHistorySyncService', {
        accountId,
        positionsAdded,
        totalPositions: Object.keys(mergedPositions).length
      });

      return {
        success: true,
        positionsAdded: positionsAdded > 0 ? positionsAdded : 0,
        positionsUpdated: positionsAdded < 0 ? Math.abs(positionsAdded) : 0,
        metricsUpdated: true
      };

    } catch (error) {
      this.logger.error('Error in syncHistoryFromAPI', 'TradingHistorySyncService', error);
      this.alertService.showError(
        'Ocurrió un error al sincronizar el historial. Se mostrarán valores iniciales.',
        'Error de sincronización'
      );
      
      // Crear estructura vacía en caso de error
      await this.createEmptyHistoryResult(userId, accountId);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Update trading history from Streams API.
   * 
   * Process:
   * 1. Loads current data from Firebase
   * 2. Updates/creates positions from streams
   * 3. Preserves createdDate for open positions
   * 4. Recalculates metrics
   * 5. Saves to Firebase
   */
  async updateFromStreams(
    userId: string,
    accountId: string,
    streamUpdate: StreamsPositionUpdate
  ): Promise<SyncResult> {
    if (!this.db || !this.isBrowser) {
      return {
        success: false,
        error: 'Firebase not available (SSR)'
      };
    }

    try {
      // 1. Cargar datos actuales de Firebase
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

      // 4. Guardar actualización incremental
      await this.updateInFirebase(userId, accountId, {
        positions: updatedPositions,
        metrics,
        syncMetadata: {
          ...currentData.syncMetadata,
          lastStreamSync: Date.now(),
          lastFullSync: Date.now(),
          totalPositions: Object.keys(updatedPositions).length,
          closedPositions: Object.values(updatedPositions).filter(p => !p.isOpen).length,
          openPositions: Object.values(updatedPositions).filter(p => p.isOpen).length,
        }
      });

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
    accessToken: string,
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
            accessToken,
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
   * Save trading history to Firebase.
   */
  private async saveToFirebase(
    userId: string,
    accountId: string,
    data: TradingHistoryDocument
  ): Promise<void> {
    if (!this.db || !this.isBrowser) {
      throw new Error('Firebase not available');
    }

    try {
      const docRef = doc(this.db, 'users', userId, this.COLLECTION_NAME, accountId);
      await setDoc(docRef, data);
      this.logger.debug('Trading history saved to Firebase', 'TradingHistorySyncService', { accountId });
    } catch (error) {
      this.logger.error('Error saving trading history to Firebase', 'TradingHistorySyncService', error);
      throw error;
    }
  }

  /**
   * Update trading history in Firebase (partial update).
   */
  private async updateInFirebase(
    userId: string,
    accountId: string,
    updates: Partial<TradingHistoryDocument>
  ): Promise<void> {
    if (!this.db || !this.isBrowser) {
      throw new Error('Firebase not available');
    }

    try {
      const docRef = doc(this.db, 'users', userId, this.COLLECTION_NAME, accountId);
      await updateDoc(docRef, updates as any);
      this.logger.debug('Trading history updated in Firebase', 'TradingHistorySyncService', { accountId });
    } catch (error) {
      this.logger.error('Error updating trading history in Firebase', 'TradingHistorySyncService', error);
      throw error;
    }
  }

  /**
   * Create empty history result with initial values.
   */
  private async createEmptyHistoryResult(
    userId: string,
    accountId: string
  ): Promise<SyncResult> {
    const emptyData: TradingHistoryDocument = {
      accountId,
      positions: {},
      metrics: {
        totalPnL: 0,
        percentageTradeWin: 0,
        profitFactor: 0,
        totalTrades: 0,
        averageWinLossTrades: 0
      },
      syncMetadata: {
        lastHistorySync: Date.now(),
        lastStreamSync: 0,
        lastFullSync: Date.now(),
        totalPositions: 0,
        closedPositions: 0,
        openPositions: 0
      },
      instrumentCache: {}
    };

    try {
      await this.saveToFirebase(userId, accountId, emptyData);
      return {
        success: true,
        positionsAdded: 0,
        metricsUpdated: true
      };
    } catch (error) {
      this.logger.error('Error creating empty history', 'TradingHistorySyncService', error);
      return {
        success: false,
        error: 'Failed to create empty history'
      };
    }
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

