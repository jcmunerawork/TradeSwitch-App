import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, deleteDoc, updateDoc, orderBy, limit, addDoc } from 'firebase/firestore';
import { isPlatformBrowser } from '@angular/common';
import { Timestamp } from 'firebase/firestore';
import { MaxDailyTradesConfig, StrategyState, ConfigurationOverview } from '../../features/strategy/models/strategy.model';
import { BackendApiService } from '../../core/services/backend-api.service';
import { getAuth } from 'firebase/auth';
import { HttpErrorResponse } from '@angular/common/http';

/**
 * Service for strategy operations in Firebase.
 *
 * This service provides comprehensive CRUD operations for trading strategies,
 * managing both strategy metadata (configuration-overview) and strategy rules
 * (configurations). It handles the complete strategy lifecycle.
 *
 * Features:
 * - Configuration Overview Operations:
 *   - Create, read, update, delete strategy metadata
 *   - Get all strategies for a user
 *   - Get active strategies
 *   - Soft delete strategies (mark as deleted)
 * - Configuration Operations:
 *   - Create, read, update strategy rules
 *   - Get configuration by user ID
 *   - Update individual rule configurations
 * - Strategy Management:
 *   - Activate/deactivate strategies
 *   - Copy strategies
 *   - Generate unique strategy IDs
 *
 * Data Structure:
 * - `configuration-overview`: Strategy metadata (name, status, dates, etc.)
 * - `configurations`: Strategy rules (maxDailyTrades, riskReward, etc.)
 * - Strategies are linked by `configurationId` field
 *
 * Relations:
 * - Used by StrategyService for strategy operations
 * - Used by StrategyComponent for strategy management
 * - Used by EditStrategyComponent for rule updates
 *
 * @service
 * @injectable
 * @providedIn root
 */
@Injectable({
  providedIn: 'root'
})
export class StrategyOperationsService {
  private isBrowser: boolean;
  private db: ReturnType<typeof getFirestore> | null = null;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private backendApi: BackendApiService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (this.isBrowser) {
      const { firebaseApp } = require('../../firebase/firebase.init.ts');
      this.db = getFirestore(firebaseApp);
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
   * Retry helper with exponential backoff for handling rate limiting (429 errors)
   * @param fn Function to retry
   * @param maxRetries Maximum number of retries (default: 3)
   * @param initialDelay Initial delay in milliseconds (default: 1500)
   * @returns Result of the function
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    initialDelay: number = 1500
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        
        // Only retry on 429 (Too Many Requests) errors
        if (error?.status === 429 && attempt < maxRetries) {
          const delay = initialDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // For other errors or if max retries reached, throw immediately
        throw error;
      }
    }
    
    throw lastError;
  }

  // ===== CONFIGURATION-OVERVIEW (colección de metadatos) =====
  
  /**
   * Crear configuration-overview (solo metadatos)
   * Now uses backend API but maintains same interface
   */
  async createConfigurationOverview(userId: string, name: string): Promise<string> {
    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.createConfigurationOverview(userId, name, idToken);
      
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to create configuration overview');
      }

      // Invalidar caché de conteo después de crear estrategia
      this.invalidateStrategiesCountCache(userId);
      
      return response.data.overviewId;
    } catch (error) {
      console.error('Error creating configuration overview:', error);
      throw error;
    }
  }

  /**
   * Obtener configuration-overview por ID (solo metadatos)
   * Now uses backend API but maintains same interface
   * Handles 429 (Too Many Requests) errors with exponential backoff retry
   */
  async getConfigurationOverview(overviewId: string): Promise<ConfigurationOverview | null> {
    // Validar que el ID no esté vacío antes de hacer la petición
    if (!overviewId || overviewId.trim() === '') {
      console.error('getConfigurationOverview called with empty overviewId');
      return null;
    }

    try {
      return await this.retryWithBackoff(async () => {
        const idToken = await this.getIdToken();
        const response = await this.backendApi.getConfigurationOverview(overviewId, idToken);
        
        if (!response.success || !response.data) {
          return null;
        }
        
        return response.data.overview as ConfigurationOverview;
      });
    } catch (error: any) {
      // If it's a 429 error after all retries, log it specifically
      if (error?.status === 429) {
        console.error('❌ Rate limit exceeded (429) after retries for overview:', overviewId);
      } else {
        console.error('Error getting configuration overview:', error);
      }
      return null;
    }
  }

  /**
   * Actualizar configuration-overview
   * Now uses backend API but maintains same interface
   */
  async updateConfigurationOverview(overviewId: string, updates: Partial<ConfigurationOverview>): Promise<void> {
    try {
      const idToken = await this.getIdToken();
      // Solo enviar campos permitidos por el DTO del backend
      // El backend maneja updated_at automáticamente
      const updateData: any = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.configurationId !== undefined) updateData.configurationId = updates.configurationId;
      if (updates.dateActive !== undefined) updateData.dateActive = updates.dateActive;
      if (updates.dateInactive !== undefined) updateData.dateInactive = updates.dateInactive;
      
      const response = await this.backendApi.updateConfigurationOverview(overviewId, updateData, idToken);
      
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to update configuration overview');
      }
    } catch (error) {
      console.error('Error updating configuration overview:', error);
      throw error;
    }
  }

  /**
   * Eliminar configuration-overview
   * Now uses backend API but maintains same interface
   */
  async deleteConfigurationOverview(overviewId: string): Promise<void> {
    try {
      // Obtener userId de la estrategia antes de eliminarla para invalidar caché
      const strategy = await this.getConfigurationOverview(overviewId);
      const userId = strategy?.userId;

      const idToken = await this.getIdToken();
      const response = await this.backendApi.deleteConfigurationOverview(overviewId, idToken);
      
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to delete configuration overview');
      }

      // Invalidar caché de conteo después de eliminar estrategia
      if (userId) {
        this.invalidateStrategiesCountCache(userId);
      }
    } catch (error) {
      console.error('Error deleting configuration overview:', error);
      throw error;
    }
  }

  // ===== CONFIGURATIONS (colección de reglas) =====
  
  /**
   * Crear configuración (solo reglas + IDs)
   * Now uses backend API but maintains same interface
   */
  async createConfiguration(userId: string, configurationOverviewId: string, configuration: StrategyState): Promise<void> {
    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.createConfiguration(userId, configurationOverviewId, configuration, idToken);
      
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to create configuration');
      }
    } catch (error) {
      console.error('Error creating configuration:', error);
      throw error;
    }
  }

  /**
   * Obtener configuración por userId
   * Now uses backend API but maintains same interface
   */
  async getConfiguration(userId: string): Promise<StrategyState | null> {
    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.getConfiguration(userId, idToken);
      
      if (!response.success || !response.data) {
        return null;
      }
      
      return response.data.configuration as StrategyState;
    } catch (error) {
      console.error('Error getting configuration:', error);
      return null;
    }
  }

  /**
   * Actualizar configuración
   * Now uses backend API but maintains same interface
   */
  async updateConfiguration(userId: string, configuration: StrategyState): Promise<void> {
    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.updateConfiguration(userId, configuration, idToken);
      
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to update configuration');
      }
    } catch (error) {
      console.error('Error updating configuration:', error);
      throw error;
    }
  }

  /**
   * Crear solo configuration (sin userId ni configurationOverviewId)
   * Now uses backend API but maintains same interface
   */
  async createConfigurationOnly(configuration: StrategyState): Promise<string> {
    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.createConfigurationOnly(configuration, idToken);
      
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to create configuration');
      }
      
      // No invalidar caché aquí porque aún no se ha creado el overview
      // El caché se invalidará cuando se cree el overview completo
      
      return response.data.configurationId;
    } catch (error) {
      console.error('Error creating configuration:', error);
      throw error;
    }
  }

  /**
   * Crear configuration-overview con configurationId
   * Now uses backend API but maintains same interface
   */
  async createConfigurationOverviewWithConfigId(userId: string, name: string, configurationId: string, shouldBeActive: boolean = false): Promise<string> {
    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.createConfigurationOverview(
        userId,
        name,
        idToken,
        configurationId,
        shouldBeActive
      );
      
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to create configuration overview');
      }
      
      // Invalidar caché de conteo después de crear estrategia
      this.invalidateStrategiesCountCache(userId);
      
      return response.data.overviewId;
    } catch (error) {
      console.error('Error creating configuration overview:', error);
      throw error;
    }
  }

  /**
   * Actualizar configuration por ID
   * Now uses backend API but maintains same interface
   */
  async updateConfigurationById(configurationId: string, configuration: StrategyState): Promise<void> {
    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.updateConfigurationById(configurationId, configuration, idToken);
      
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to update configuration by ID');
      }
    } catch (error) {
      console.error('Error updating configuration by ID:', error);
      throw error;
    }
  }

  /**
   * Obtener configuración por ID
   * Now uses backend API but maintains same interface
   * 
   * IMPORTANTE: El backend debe tener el endpoint GET /api/v1/strategies/configuration/{configurationId}
   * Si este endpoint no existe, el backend necesita implementarlo.
   */
  async getConfigurationById(configurationId: string): Promise<StrategyState | null> {
    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.getConfigurationById(configurationId, idToken);
      
      if (!response.success || !response.data) {
        console.error('Backend response error:', response);
        return null;
      }
      
      return response.data.configuration as StrategyState;
    } catch (error: any) {
      console.error('Error getting configuration by ID:', error);
      if (error?.status === 404) {
        console.error(`❌ Endpoint no encontrado: GET /api/v1/strategies/configuration/${configurationId}`);
        console.error('El backend necesita implementar este endpoint para obtener la configuración por configurationId');
      }
      return null;
    }
  }

  /**
   * Obtener configuración por configurationOverviewId (método legacy para compatibilidad)
   * Now uses backend API: primero obtiene el overview para obtener el configurationId, luego obtiene la configuración
   */
  async getConfigurationByOverviewId(overviewId: string): Promise<StrategyState | null> {
    try {
      // 1. Primero obtener el overview para obtener el configurationId
      const overview = await this.getConfigurationOverview(overviewId);
      
      if (!overview || !overview.configurationId) {
        console.error('Overview not found or missing configurationId');
        return null;
      }
      
      // 2. Obtener la configuración usando el configurationId
      return await this.getConfigurationById(overview.configurationId);
    } catch (error) {
      console.error('Error getting configuration by overview ID:', error);
      return null;
    }
  }

  /**
   * Obtener todas las estrategias de un usuario
   * Now uses backend API but maintains same interface
   */
  async getUserStrategyViews(userId: string): Promise<ConfigurationOverview[]> {
    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.getUserStrategyViews(userId, idToken);
      
      if (!response.success || !response.data) {
        return [];
      }
      
      // Mapear las estrategias para asegurar que tengan el campo 'id'
      // El backend debería devolver el ID del documento, pero si no lo hace,
      // necesitamos agregarlo. Verificar si viene como 'id', 'overviewId', o '_id'
      const strategies = (response.data.strategies || []).map((strategy: any, index: number) => {
        // Intentar obtener el ID de diferentes campos posibles
        let strategyId = strategy.id || strategy._id || strategy.overviewId || strategy.overview_id;
        
        // Si el backend devuelve el ID con otro nombre, mapearlo aquí
        if (strategyId) {
          return { ...strategy, id: strategyId };
        }
        
        // Si no hay ID, retornar la estrategia tal cual (pero esto causará problemas)
        // En este caso, deberíamos loguear un error
        console.error(`❌ Strategy missing ID:`, strategy);
        return strategy;
      }).filter((strategy: any) => strategy.id); // Filtrar estrategias sin ID
      
      return strategies;
    } catch (error) {
      console.error('❌ Error getting user strategies:', error);
      return [];
    }
  }

  /**
   * Obtener configuración activa (método legacy para compatibilidad)
   * Now uses backend API but maintains same interface
   */
  async getActiveConfiguration(userId: string): Promise<ConfigurationOverview | null> {
    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.getActiveConfiguration(userId, idToken);
      
      if (!response.success || !response.data) {
        return null;
      }
      
      return response.data.overview as ConfigurationOverview;
    } catch (error) {
      console.error('Error getting active configuration:', error);
      return null;
    }
  }

  /**
   * Activar una estrategia
   * Now uses backend API but maintains same interface
   */
  async activateStrategyView(userId: string, strategyId: string): Promise<void> {
    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.activateStrategyView(userId, strategyId, idToken);
      
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to activate strategy');
      }
    } catch (error) {
      console.error('Error activating strategy:', error);
      throw error;
    }
  }

  /**
   * Actualizar fechas de activación/desactivación de estrategias
   * Now uses backend API but maintains same interface
   */
  async updateStrategyDates(userId: string, strategyId: string, dateActive?: Date, dateInactive?: Date): Promise<void> {
    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.updateStrategyDates(userId, strategyId, dateActive, dateInactive, idToken);
      
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to update strategy dates');
      }
    } catch (error) {
      console.error('Error updating strategy dates:', error);
      throw error;
    }
  }

  /**
   * Eliminar una estrategia
   * TODO: Migrar completamente a backend cuando exista endpoint DELETE /api/v1/strategies/configuration/:configurationId
   * Actualmente elimina el overview por backend pero el configuration aún se elimina directamente desde Firebase
   */
  async deleteStrategyView(strategyId: string): Promise<void> {
    if (!this.db) {
      return;
    }

    try {
      // 1. Obtener el configurationId del overview
      const strategy = await this.getConfigurationOverview(strategyId);
      if (!strategy) {
        throw new Error('Strategy not found');
      }

      // 2. Eliminar configuration-overview usando backend
      await this.deleteConfigurationOverview(strategyId);

      // 3. Eliminar configuration directamente desde Firebase
      // TODO: Migrar a endpoint del backend cuando esté disponible
      if (strategy.configurationId) {
        try {
          const configDocRef = doc(this.db, 'configurations', strategy.configurationId);
          await deleteDoc(configDocRef);
        } catch (error) {
          // Configuration not found for deletion, continue
        }
      }
    } catch (error) {
      console.error('Error deleting strategy:', error);
      throw error;
    }
  }

  /**
   * Marcar una estrategia como deleted (soft delete)
   * Now uses backend API but maintains same interface
   */
  async markStrategyAsDeleted(strategyId: string): Promise<void> {
    // Validar que el ID no esté vacío
    if (!strategyId || strategyId.trim() === '') {
      throw new Error('Strategy ID is required');
    }

    try {
      // Obtener userId de la estrategia antes de marcarla como eliminada para invalidar caché
      const strategy = await this.getConfigurationOverview(strategyId);
      const userId = strategy?.userId;

      const idToken = await this.getIdToken();
      const response = await this.backendApi.markStrategyAsDeleted(strategyId, idToken);
      
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to mark strategy as deleted');
      }

      // Invalidar caché de conteo después de marcar estrategia como eliminada
      if (userId) {
        this.invalidateStrategiesCountCache(userId);
      }
    } catch (error) {
      console.error('Error marking strategy as deleted:', error);
      throw error;
    }
  }

  /**
   * Obtener el número total de estrategias de un usuario (solo no eliminadas)
   * Now uses backend API but maintains same interface
   */
  // Cache para evitar peticiones duplicadas
  private strategiesCountCache: Map<string, { count: number; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 2000; // 2 segundos de caché
  private pendingCountRequests: Map<string, Promise<number>> = new Map(); // Evitar peticiones simultáneas

  async getAllLengthConfigurationsOverview(userId: string): Promise<number> {
    // Verificar si hay una petición pendiente para este usuario
    const pendingRequest = this.pendingCountRequests.get(userId);
    if (pendingRequest) {
      return pendingRequest;
    }

    // Verificar caché
    const cached = this.strategiesCountCache.get(userId);
    const now = Date.now();
    if (cached && (now - cached.timestamp) < this.CACHE_TTL) {
      return cached.count;
    }
    
    // Crear promesa y guardarla para evitar peticiones duplicadas
    const requestPromise = (async () => {
      try {
        const idToken = await this.getIdToken();
        const response = await this.backendApi.getStrategiesCount(userId, idToken);
        
        if (!response.success || !response.data) {
          return 0;
        }
        
        const count = response.data.count;
        
        // Guardar en caché
        this.strategiesCountCache.set(userId, {
          count,
          timestamp: now
        });
        
        return count;
      } catch (error) {
        console.error('❌ getAllLengthConfigurationsOverview: Error getting strategies count:', error);
        if (error instanceof Error) {
          console.error('❌ Error details:', {
            message: error.message,
            stack: error.stack
          });
        }
        if (error && typeof error === 'object' && 'status' in error) {
          console.error('❌ HTTP Error details:', {
            status: (error as any).status,
            statusText: (error as any).statusText,
            error: (error as any).error
          });
        }
        return 0;
      } finally {
        // Limpiar petición pendiente
        this.pendingCountRequests.delete(userId);
      }
    })();

    // Guardar la promesa para evitar peticiones duplicadas
    this.pendingCountRequests.set(userId, requestPromise);
    
    return requestPromise;
  }

  /**
   * Invalidar caché de conteo de estrategias (llamar después de crear/eliminar estrategias)
   */
  invalidateStrategiesCountCache(userId: string): void {
    this.strategiesCountCache.delete(userId);
  }

  /**
   * Generar ID único para configuration-overview
   */
  private generateOverviewId(): string {
    return 'overview_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}
