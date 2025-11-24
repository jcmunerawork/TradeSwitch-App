import { Injectable } from '@angular/core';
import { MaxDailyTradesConfig, StrategyState, ConfigurationOverview } from '../models/strategy.model';
import { StrategyOperationsService } from '../../../shared/services/strategy-operations.service';
import { AppContextService } from '../../../shared/context';
import { AuthService } from '../../../shared/services/auth.service';

/**
 * Service for managing trading strategies.
 *
 * This service acts as a facade for strategy operations, providing methods
 * to create, read, update, and delete strategies. It manages both the
 * strategy metadata (ConfigurationOverview) and the actual rules (StrategyState).
 *
 * The service uses a two-collection approach:
 * - 'configuration-overview': Stores metadata (name, status, dates)
 * - 'configurations': Stores actual trading rules
 *
 * Responsibilities:
 * - Creating complete strategies (overview + configuration)
 * - Fetching strategies with their configurations
 * - Updating strategy metadata and rules
 * - Activating/deactivating strategies
 * - Soft deleting strategies
 * - Managing user strategy counts
 *
 * Relations:
 * - StrategyOperationsService: Direct Firebase operations
 * - AppContextService: Global state management
 * - AuthService: User count updates
 *
 * @injectable
 * @providedIn root
 */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  /**
   * Constructor for SettingsService.
   *
   * @param strategyOperationsService - Service for direct Firebase operations
   * @param appContext - Application context service for global state
   * @param authService - Authentication service for user operations
   */
  constructor(
    private strategyOperationsService: StrategyOperationsService,
    private appContext: AppContextService,
    private authService: AuthService
  ) {}

  // ===== CONFIGURATION-OVERVIEW (colección de metadatos) =====
  
  // Crear configuration-overview (solo metadatos)
  async createConfigurationOverview(userId: string, name: string): Promise<string> {
    return this.strategyOperationsService.createConfigurationOverview(userId, name);
  }

  // Obtener configuration-overview por ID (solo metadatos)
  async getConfigurationOverview(overviewId: string): Promise<ConfigurationOverview | null> {
    return this.strategyOperationsService.getConfigurationOverview(overviewId);
  }

  // Actualizar configuration-overview
  async updateConfigurationOverview(overviewId: string, updates: Partial<ConfigurationOverview>): Promise<void> {
    return this.strategyOperationsService.updateConfigurationOverview(overviewId, updates);
  }

  // Eliminar configuration-overview
  async deleteConfigurationOverview(overviewId: string): Promise<void> {
    return this.strategyOperationsService.deleteConfigurationOverview(overviewId);
  }

  // ===== CONFIGURATIONS (colección de reglas) =====
  
  // Crear configuración (solo reglas + IDs)
  async createConfiguration(userId: string, configurationOverviewId: string, configuration: StrategyState): Promise<void> {
    return this.strategyOperationsService.createConfiguration(userId, configurationOverviewId, configuration);
  }

  // Obtener configuración por userId
  async getConfiguration(userId: string): Promise<StrategyState | null> {
    return this.strategyOperationsService.getConfiguration(userId);
  }

  // Actualizar configuración
  async updateConfiguration(userId: string, configuration: StrategyState): Promise<void> {
    return this.strategyOperationsService.updateConfiguration(userId, configuration);
  }

  // ===== MÉTODOS INDIVIDUALES NUEVOS =====
  
  // Crear solo configuration (sin userId ni configurationOverviewId)
  async createConfigurationOnly(configuration: StrategyState): Promise<string> {
    return this.strategyOperationsService.createConfigurationOnly(configuration);
  }

  // Crear configuration-overview con configurationId
  async createConfigurationOverviewWithConfigId(userId: string, name: string, configurationId: string, shouldBeActive: boolean = false): Promise<string> {
    return this.strategyOperationsService.createConfigurationOverviewWithConfigId(userId, name, configurationId, shouldBeActive);
  }

  // Actualizar configuration por ID
  async updateConfigurationById(configurationId: string, configuration: StrategyState): Promise<void> {
    return this.strategyOperationsService.updateConfigurationById(configurationId, configuration);
  }

  // ===== MÉTODOS COMBINADOS =====
  
  // Crear estrategia completa (configurations + configuration-overview)
  async createStrategyView(userId: string, name: string, configuration: StrategyState, shouldBeActive: boolean = false): Promise<string> {
    this.appContext.setLoading('strategies', true);
    this.appContext.setError('strategies', null);
    
    try {
      // 1. Crear configuration primero para obtener el ID
      const configurationId = await this.createConfigurationOnly(configuration);
      
      // 2. Crear configuration-overview con el configurationId
      const overviewId = await this.createConfigurationOverviewWithConfigId(userId, name, configurationId, shouldBeActive);
      
      // 3. Actualizar contexto con la nueva estrategia
      const newStrategy = await this.getConfigurationOverview(overviewId);
      if (newStrategy) {
        this.appContext.addStrategy({ ...newStrategy, id: overviewId });
      }
      
      // 4. Actualizar conteos del usuario
      await this.authService.updateUserCounts(userId);
      
      this.appContext.setLoading('strategies', false);
      return overviewId;
    } catch (error) {
      this.appContext.setLoading('strategies', false);
      this.appContext.setError('strategies', 'Error al crear estrategia');
      throw error;
    }
  }

  // Obtener estrategia completa (configuration-overview + configurations)
  async getStrategyView(overviewId: string): Promise<{ overview: ConfigurationOverview; configuration: StrategyState } | null> {
    
    // 1. Primero obtener configuration-overview
    const overview = await this.getConfigurationOverview(overviewId);
    
    if (!overview) {
      return null;
    }

    // 2. Luego obtener configuration usando el configurationId
    const configuration = await this.getConfigurationById(overview.configurationId);
    
    if (!configuration) {
      return null;
    }

    return { overview, configuration };
  }

  // Obtener configuración por ID
  async getConfigurationById(configurationId: string): Promise<StrategyState | null> {
    return this.strategyOperationsService.getConfigurationById(configurationId);
  }

  // Obtener configuración por configurationOverviewId (método legacy para compatibilidad)
  async getConfigurationByOverviewId(overviewId: string): Promise<StrategyState | null> {
    return this.strategyOperationsService.getConfigurationByOverviewId(overviewId);
  }

  // Actualizar estrategia completa
  async updateStrategyView(overviewId: string, updates: { name?: string; configuration?: StrategyState; userId?: string }): Promise<void> {
    // 1. Primero actualizar configuration-overview si hay cambios de nombre
    if (updates.name) {
      await this.updateConfigurationOverview(overviewId, { name: updates.name });
    }
    
    // 2. Luego actualizar configuration si hay cambios de reglas
    if (updates.configuration) {
      // Obtener el configurationId del overview
      const overview = await this.getConfigurationOverview(overviewId);
      if (overview && overview.configurationId) {
        await this.updateConfigurationById(overview.configurationId, updates.configuration);
      }
    }
  }

  // Obtener todas las estrategias de un usuario
  async getUserStrategyViews(userId: string): Promise<ConfigurationOverview[]> {
    this.appContext.setLoading('strategies', true);
    this.appContext.setError('strategies', null);
    
    try {
      const strategies = await this.strategyOperationsService.getUserStrategyViews(userId);
      this.appContext.setUserStrategies(strategies);
      this.appContext.setLoading('strategies', false);
      return strategies;
    } catch (error) {
      this.appContext.setLoading('strategies', false);
      this.appContext.setError('strategies', 'Error al obtener estrategias del usuario');
      throw error;
    }
  }

  // Obtener configuración activa (método legacy para compatibilidad)
  async getActiveConfiguration(userId: string): Promise<ConfigurationOverview | null> {
    return this.strategyOperationsService.getActiveConfiguration(userId);
  }

  // Método legacy para compatibilidad
  async getStrategyConfig(userId: string) {
    return await this.getConfiguration(userId);
  }

  // Método legacy para compatibilidad
  async saveStrategyConfig(userId: string, configurationOverviewId: string) {
    // Este método ya no es necesario con la nueva estructura
    console.warn('saveStrategyConfig is deprecated. Use createConfiguration instead.');
  }

  // Activar una estrategia
  async activateStrategyView(userId: string, strategyId: string): Promise<void> {
    return this.strategyOperationsService.activateStrategyView(userId, strategyId);
  }

  // Actualizar fechas de activación/desactivación de estrategias
  async updateStrategyDates(userId: string, strategyId: string, dateActive?: Date, dateInactive?: Date): Promise<void> {
    return this.strategyOperationsService.updateStrategyDates(userId, strategyId, dateActive, dateInactive);
  }

  // Eliminar una estrategia
  async deleteStrategyView(strategyId: string): Promise<void> {
    return this.strategyOperationsService.deleteStrategyView(strategyId);
  }

  // Marcar una estrategia como deleted (soft delete)
  async markStrategyAsDeleted(strategyId: string): Promise<void> {
    // 1. Obtener el userId de la estrategia antes de marcarla como eliminada
    const strategy = await this.getConfigurationOverview(strategyId);
    if (!strategy) {
      throw new Error('Strategy not found');
    }
    
    const userId = strategy.userId;
    
    // 2. Marcar la estrategia como eliminada
    await this.strategyOperationsService.markStrategyAsDeleted(strategyId);
    
    // 3. Actualizar conteos del usuario
    if (userId) {
      await this.authService.updateUserCounts(userId);
    }
  }
}