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
  private createStrategyButtonState: 'available' | 'plan_reached' | 'block' = 'available';

  constructor(
    private strategyOperationsService: StrategyOperationsService,
    private appContext: AppContextService,
    private authService: AuthService,
    private strategyCacheService: StrategyCacheService
  ) { }

  setCreateStrategyButtonState(button_state: 'available' | 'plan_reached' | 'block'): void {
    this.createStrategyButtonState = button_state;
  }

  getCreateStrategyButtonState(): 'available' | 'plan_reached' | 'block' {
    return this.createStrategyButtonState;
  }

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


      this.appContext.setLoading('strategies', false);
      return overviewId;
    } catch (error) {
      this.appContext.setLoading('strategies', false);
      this.appContext.setError('strategies', 'Error al crear estrategia');
      throw error;
    }
  }

  // Obtener estrategia completa (configuration-overview + configurations)
  // Siempre pide al backend primero; si falla, usa cache (localStorage) como respaldo
  async getStrategyView(overviewId: string): Promise<{ overview: ConfigurationOverview; configuration: StrategyState } | null> {
    try {
      // 1. Siempre pedir al backend primero
      const overview = await this.getConfigurationOverview(overviewId);
      if (!overview) {
        return this.strategyCacheService.getStrategy(overviewId);
      }

      const configuration = await this.getConfigurationById(overview.configurationId);
      if (!configuration) {
        return this.strategyCacheService.getStrategy(overviewId);
      }

      // 2. Actualizar cache (localStorage) con los datos frescos
      this.strategyCacheService.setStrategy(overviewId, overview, configuration);

      return { overview, configuration };
    } catch {
      // 3. Si el backend falla, usar cache como respaldo
      return this.strategyCacheService.getStrategy(overviewId);
    }
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

    } catch (error) {// 
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



  // Activar una estrategia (usando endpoint transaccional)
  async activateStrategyView(userId: string, strategyId: string): Promise<void> {
    // Usar el nuevo método transaccional
    await this.strategyOperationsService.activateStrategy(userId, strategyId);

    // ✅ OPTIMIZACIÓN: Actualizar solo la strategy activada en cache y localStorage
    try {
      // Como es transaccional, todas las demás se desactivaron.
      // Necesitamos actualizar el estado local para reflejar esto sin recargar todo.

      const allStrategies = this.strategyCacheService.getAllStrategies();
      const strategiesCache = new Map<string, { overview: ConfigurationOverview; configuration: StrategyState }>();

      // Recorrer todas las estrategias en cache
      for (const [id, data] of allStrategies.entries()) {
        const isTarget = id === strategyId;

        // Actualizar solo status; el backend gestiona timeline en activate/deactivate
        const updatedOverview = {
          ...data.overview,
          status: isTarget
        };

        strategiesCache.set(id, {
          overview: updatedOverview,
          configuration: data.configuration
        });

        // Actualizar active strategy en contexto si es la target
        if (isTarget) {
          this.appContext.activateStrategy(id);
        }
      }

      // Guardar todo el mapa actualizado
      this.strategyCacheService.setAllStrategies(strategiesCache);

    } catch (error) {// 
      // Si falla, hacer recarga completa como fallback
      await this.reloadAllStrategiesToCache(userId);
    }
  }

  /**
   * @deprecated El backend gestiona timeline en activate/deactivate; no usar.
   */
  async updateStrategyDates(userId: string, strategyId: string, dateActive?: Date, dateInactive?: Date): Promise<void> {
    return this.strategyOperationsService.updateStrategyDates(userId, strategyId, dateActive, dateInactive);
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

    } catch (error) {// 
      // Si falla, hacer recarga completa como fallback
      if (userId) {
        await this.reloadAllStrategiesToCache(userId);
      }
    }
  }

  /**
   * Obtener estrategias completas y estado del botón desde el backend (único endpoint).
   */
  async getStrategiesWithButtonState(userId: string): Promise<{
    strategies: Array<{ overview: ConfigurationOverview; configuration: StrategyState }>;
    button_state: 'available' | 'plan_reached' | 'block';
  }> {
    return this.strategyOperationsService.getStrategiesForUser(userId);
  }

  /**
   * Obtener todas las estrategias completas (overview + configuration)
   */
  async getUserCompleteStrategies(userId: string): Promise<Array<{ overview: ConfigurationOverview; configuration: StrategyState }>> {
    return this.strategyOperationsService.getUserCompleteStrategies(userId);
  }

  /**
   * Recargar todas las estrategias del usuario desde el backend y guardarlas en cache (memoria y localStorage)
   * Este método debe llamarse después de cualquier operación CRUD (crear, editar, borrar, activar)
   * para mantener el cache sincronizado con el backend.
   * 
   * @param userId - User ID
   * @returns Promise that resolves when all strategies have been loaded and saved to cache
   */
  async reloadAllStrategiesToCache(userId: string): Promise<void> {
    try {
      const { strategies, button_state } = await this.getStrategiesWithButtonState(userId);
      this.setCreateStrategyButtonState(button_state);

      if (!strategies || strategies.length === 0) {
        this.strategyCacheService.clearCache();
        return;
      }

      const strategiesCache = new Map<string, { overview: ConfigurationOverview; configuration: StrategyState }>();
      strategies.forEach(s => {
        if (s.overview.id) {
          strategiesCache.set(s.overview.id, s);
        }
      });

      this.strategyCacheService.setAllStrategies(strategiesCache);
      this.appContext.setUserStrategies(strategies.map(s => s.overview));
    } catch (error) {// 
    }
  }

  // ===== HELPER METHODS =====

  /**
   * Generar nombre único para una estrategia
   * @param baseName - Base name for the strategy
   * @param existingStrategies - Lista de estrategias existentes para verificar duplicados
   */
  generateUniqueStrategyName(baseName: string, existingStrategies: ConfigurationOverview[]): string {
    // Extraer solo los nombres
    const existingNames = existingStrategies.map(strategy => strategy.name);

    // Si el nombre base no existe, usarlo tal como está
    if (!existingNames.includes(baseName)) {
      return baseName;
    }

    // Si el nombre base termina con "copy", agregar número secuencial
    if (baseName.toLowerCase().endsWith('copy')) {
      let counter = 1;
      let newName = `${baseName} ${counter}`;

      while (existingNames.includes(newName)) {
        counter++;
        newName = `${baseName} ${counter}`;
      }

      return newName;
    }

    // Si el nombre base no termina con "copy", agregar "copy" primero
    let copyName = `${baseName} copy`;

    if (!existingNames.includes(copyName)) {
      return copyName;
    }

    // Si "copy" ya existe, agregar número secuencial
    let counter = 1;
    let newName = `${baseName} copy ${counter}`;

    while (existingNames.includes(newName)) {
      counter++;
      newName = `${baseName} copy ${counter}`;
    }

    return newName;
  }

  /**
   * Crear una estrategia genérica con configuración vacía
   * Maneja la lógica de "Primera Estrategia" (activa por defecto) y nombres únicos
   * 
   * @param userId - User ID
   * @param existingStrategies - List of existing strategies for business logic
   * @returns Promise<string> - ID of the newly created strategy
   */
  async createGenericStrategy(userId: string, existingStrategies: ConfigurationOverview[]): Promise<string> {
    // 1. Generar nombre único
    const genericName = this.generateUniqueStrategyName('Strategy', existingStrategies);

    // 2. Determinar si es la primera estrategia (si no hya estrategias activas ni eliminadas)
    // NOTA: Para ser consistentes con el frontend, asumimos que si existingStrategies está vacío, es la primera.
    // Aunque idealmente deberíamos verificar con backend si hay eliminadas, 
    // asumiremos la lista pasada como fuente de verdad para la decisión de "Active/Inactive".
    const isFirstStrategy = existingStrategies.length === 0;

    // 3. Crear configuración vacía con reglas por defecto
    const emptyStrategyConfig: StrategyState = {
      maxDailyTrades: {
        isActive: false,
        maxDailyTrades: 0,
        type: 'MAX DAILY TRADES' as any,
      },
      riskReward: {
        isActive: false,
        riskRewardRatio: '1:2',
        type: 'RISK REWARD RATIO' as any,
      },
      riskPerTrade: {
        isActive: false,
        review_type: 'MAX',
        number_type: 'PERCENTAGE',
        percentage_type: 'NULL',
        risk_ammount: 0,
        type: 'MAX RISK PER TRADE' as any,
        balance: 0,
        actualBalance: 0,
      },
      daysAllowed: {
        isActive: false,
        type: 'DAYS ALLOWED' as any,
        tradingDays: [],
      },
      hoursAllowed: {
        isActive: false,
        tradingOpenTime: '',
        tradingCloseTime: '',
        timezone: '',
        type: 'TRADING HOURS' as any,
      },
      assetsAllowed: {
        isActive: false,
        type: 'ASSETS ALLOWED' as any,
        assetsAllowed: [],
      },
    };

    // 4. Crear la estrategia
    const strategyId = await this.createStrategyView(
      userId,
      genericName,
      emptyStrategyConfig,
      isFirstStrategy // Primera estrategia activa, el resto inactivas
    );

    // El backend ya creó la estrategia como inactiva si !isFirstStrategy; no hace falta actualizar fechas
    return strategyId;
  }
}