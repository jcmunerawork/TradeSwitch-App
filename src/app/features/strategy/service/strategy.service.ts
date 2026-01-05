import { Injectable } from '@angular/core';
import { MaxDailyTradesConfig, StrategyState, ConfigurationOverview } from '../models/strategy.model';
import { StrategyOperationsService } from '../../../shared/services/strategy-operations.service';
import { AppContextService } from '../../../shared/context';
import { AuthService } from '../../../shared/services/auth.service';
import { StrategyCacheService } from '../services/strategy-cache.service';

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
    private authService: AuthService,
    private strategyCacheService: StrategyCacheService
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
      
      // 3. Obtener la nueva estrategia completa
      const newStrategy = await this.getConfigurationOverview(overviewId);
      if (!newStrategy) {
        throw new Error('Failed to get created strategy');
      }
      
      // 4. Actualizar conteos del usuario
      await this.authService.updateUserCounts(userId);
      
      // 5. ✅ OPTIMIZACIÓN: Guardar solo la nueva strategy en cache y localStorage
      // En lugar de recargar todas las strategies, solo agregamos la nueva
      this.strategyCacheService.setStrategy(overviewId, newStrategy, configuration);
      
      // 6. Actualizar contexto con la nueva estrategia (solo una vez)
      this.appContext.addStrategy({ ...newStrategy, id: overviewId });
      
      console.log('✅ New strategy saved to cache and localStorage:', overviewId);
      
      this.appContext.setLoading('strategies', false);
      return overviewId;
    } catch (error) {
      this.appContext.setLoading('strategies', false);
      this.appContext.setError('strategies', 'Error al crear estrategia');
      throw error;
    }
  }

  // Obtener estrategia completa (configuration-overview + configurations)
  // Primero intenta desde el cache (localStorage), si no está, hace petición al backend
  async getStrategyView(overviewId: string): Promise<{ overview: ConfigurationOverview; configuration: StrategyState } | null> {
    // 1. Intentar obtener desde el cache primero
    const cached = this.strategyCacheService.getStrategy(overviewId);
    if (cached) {
      return cached;
    }
    
    // 2. Si no está en cache, obtener desde el backend
    const overview = await this.getConfigurationOverview(overviewId);
    
    if (!overview) {
      return null;
    }

    // 3. Luego obtener configuration usando el configurationId
    const configuration = await this.getConfigurationById(overview.configurationId);
    
    if (!configuration) {
      return null;
    }

    // 4. Guardar en cache para futuras consultas
    this.strategyCacheService.setStrategy(overviewId, overview, configuration);

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
    // 1. Obtener el userId y la estrategia actual antes de actualizar
    const currentOverview = await this.getConfigurationOverview(overviewId);
    if (!currentOverview || !currentOverview.userId) {
      throw new Error('Strategy not found or missing userId');
    }
    const userId = currentOverview.userId;
    
    // 2. Actualizar configuration-overview si hay cambios de nombre
    if (updates.name) {
      await this.updateConfigurationOverview(overviewId, { name: updates.name });
    }
    
    // 3. Actualizar configuration si hay cambios de reglas
    if (updates.configuration) {
      if (currentOverview.configurationId) {
        await this.updateConfigurationById(currentOverview.configurationId, updates.configuration);
      }
    }
    
    // 4. ✅ OPTIMIZACIÓN: Actualizar solo la strategy modificada en cache y localStorage
    // En lugar de recargar todas las strategies, solo actualizamos la que cambió
    try {
      // Obtener la strategy actualizada completa
      const updatedOverview = await this.getConfigurationOverview(overviewId);
      if (!updatedOverview) {
        throw new Error('Failed to get updated strategy overview');
      }
      
      // Obtener la configuración (puede ser la actualizada o la existente)
      let updatedConfiguration: StrategyState;
      if (updates.configuration && updatedOverview.configurationId) {
        // Si se actualizó la configuración, obtener la nueva
        updatedConfiguration = updates.configuration;
      } else {
        // Si no se actualizó, obtener la existente desde cache o backend
        const existingStrategy = this.strategyCacheService.getStrategy(overviewId);
        if (existingStrategy) {
          updatedConfiguration = existingStrategy.configuration;
        } else if (updatedOverview.configurationId) {
          const config = await this.getConfigurationById(updatedOverview.configurationId);
          if (!config) {
            throw new Error('Failed to get strategy configuration');
          }
          updatedConfiguration = config;
        } else {
          throw new Error('Strategy has no configuration ID');
        }
      }
      
      // Actualizar en cache (esto también actualiza localStorage automáticamente)
      this.strategyCacheService.setStrategy(overviewId, updatedOverview, updatedConfiguration);
      
      // Actualizar en el contexto de la aplicación (solo esta strategy)
      this.appContext.updateStrategy(overviewId, updatedOverview);
      
      console.log('✅ Strategy updated in cache and localStorage:', overviewId);
    } catch (error) {
      console.error('❌ Error updating strategy in cache, falling back to full reload:', error);
      // Si falla la actualización individual, hacer recarga completa como fallback
      await this.reloadAllStrategiesToCache(userId);
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

  // Obtener el número total de estrategias de un usuario (solo no eliminadas)
  async getAllLengthConfigurationsOverview(userId: string): Promise<number> {
    return this.strategyOperationsService.getAllLengthConfigurationsOverview(userId);
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
    await this.strategyOperationsService.activateStrategyView(userId, strategyId);
    
    // ✅ OPTIMIZACIÓN: Actualizar solo la strategy activada en cache y localStorage
    try {
      const updatedOverview = await this.getConfigurationOverview(strategyId);
      if (updatedOverview) {
        // Obtener la configuración desde cache o backend
        const existingStrategy = this.strategyCacheService.getStrategy(strategyId);
        if (existingStrategy) {
          // Actualizar solo el overview (el estado de activación cambió)
          this.strategyCacheService.setStrategy(strategyId, updatedOverview, existingStrategy.configuration);
          
          // Actualizar en el contexto
          this.appContext.activateStrategy(strategyId);
          
          console.log('✅ Strategy activation updated in cache and localStorage:', strategyId);
        } else {
          // Si no está en cache, recargar solo esta strategy
          const strategyData = await this.getStrategyView(strategyId);
          if (strategyData) {
            this.strategyCacheService.setStrategy(strategyId, strategyData.overview, strategyData.configuration);
            this.appContext.activateStrategy(strategyId);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error updating strategy activation in cache, falling back to full reload:', error);
      // Si falla, hacer recarga completa como fallback
      await this.reloadAllStrategiesToCache(userId);
    }
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
    // Validar que el ID no esté vacío
    if (!strategyId || strategyId.trim() === '') {
      throw new Error('Strategy ID is required');
    }

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
    
    // 4. ✅ OPTIMIZACIÓN: Remover solo esta strategy del cache y localStorage
    // En lugar de recargar todas las strategies, solo removemos la eliminada
    try {
      // Remover del cache (esto también actualiza localStorage automáticamente)
      const allStrategies = this.strategyCacheService.getAllStrategies();
      allStrategies.delete(strategyId);
      this.strategyCacheService.setAllStrategies(allStrategies);
      
      // Remover del contexto
      this.appContext.removeStrategy(strategyId);
      
      console.log('✅ Strategy removed from cache and localStorage:', strategyId);
    } catch (error) {
      console.error('❌ Error removing strategy from cache, falling back to full reload:', error);
      // Si falla, hacer recarga completa como fallback
      if (userId) {
        await this.reloadAllStrategiesToCache(userId);
      }
    }
  }

  /**
   * Recargar todas las estrategias del usuario desde el backend y guardarlas en cache (memoria y localStorage)
   * Este método debe llamarse después de cualquier operación CRUD (crear, editar, borrar, activar)
   * para mantener el cache sincronizado con el backend.
   * 
   * @param userId - ID del usuario
   * @returns Promise que se resuelve cuando todas las estrategias han sido cargadas y guardadas en cache
   */
  async reloadAllStrategiesToCache(userId: string): Promise<void> {
    try {
      // 1. Obtener todas las estrategias (overviews) del usuario
      const allStrategies = await this.getUserStrategyViews(userId);
      
      if (!allStrategies || allStrategies.length === 0) {
        // Si no hay estrategias, limpiar el cache
        this.strategyCacheService.clearCache();
        return;
      }

      // 2. Para cada estrategia, cargar su configuración completa
      // Limitar peticiones concurrentes para evitar rate limiting (429)
      const CONCURRENT_REQUESTS = 2; // Procesar máximo 2 estrategias a la vez
      const strategiesCache = new Map<string, { overview: ConfigurationOverview; configuration: StrategyState }>();
      
      for (let i = 0; i < allStrategies.length; i += CONCURRENT_REQUESTS) {
        const batch = allStrategies.slice(i, i + CONCURRENT_REQUESTS);
        
        await Promise.all(
          batch.map(async (strategy) => {
            try {
              // Validar que la estrategia tenga un ID válido
              const strategyId = (strategy as any).id || (strategy as any)._id || (strategy as any).overviewId;
              
              if (!strategyId) {
                console.error('❌ Strategy missing ID:', strategy);
                return;
              }
              
              // Obtener la configuración completa
              const strategyData = await this.getStrategyView(strategyId);
              
              if (strategyData && strategyData.configuration) {
                // Guardar en cache
                strategiesCache.set(strategyId, {
                  overview: strategyData.overview,
                  configuration: strategyData.configuration
                });
              }
            } catch (error: any) {
              // Manejar específicamente errores 429
              if (error?.status === 429) {
                console.warn(`⚠️ Rate limit (429) when loading strategy ${strategy.name} for cache. Will retry later.`);
              } else {
                console.error(`❌ Error loading strategy ${strategy.name} for cache:`, error);
              }
            }
          })
        );
        
        // Pequeña pausa entre lotes para evitar rate limiting
        if (i + CONCURRENT_REQUESTS < allStrategies.length) {
          await new Promise(resolve => setTimeout(resolve, 300)); // 300ms entre lotes
        }
      }

      // 3. Guardar todas las estrategias en el cache (memoria y localStorage)
      this.strategyCacheService.setAllStrategies(strategiesCache);
    } catch (error) {
      console.error('❌ Error reloading strategies to cache:', error);
      // No lanzar el error para que no interrumpa el flujo principal
    }
  }
}