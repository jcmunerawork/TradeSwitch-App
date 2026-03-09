import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BackendApiService } from '../../core/services/backend-api.service';
import { getAuth } from 'firebase/auth';

/**
 * Interface for subscription plan data.
 *
 * @interface Plan
 */
export interface Plan {
  id: string;
  name: string;
  price: string;
  strategies: number;
  tradingAccounts: number;
  createdAt?: any;
  updatedAt?: any;
  planPriceId?: string;
}

/**
 * Service for managing subscription plans in Firebase.
 *
 * This service provides CRUD operations for subscription plans, including
 * creating, reading, updating, and deleting plans. Plans define the features
 * and limits available to users (e.g., number of strategies, trading accounts).
 *
 * Features:
 * - Create new plans
 * - Get all plans
 * - Get plan by ID
 * - Update existing plans
 * - Delete plans
 * - Query plans by name
 *
 * Plan Structure:
 * - Stored in: `plan/{planId}`
 * - Contains: name, price, strategies limit, trading accounts limit
 * - Includes Stripe price ID for payment integration
 *
 * Relations:
 * - Used by AuthService for loading global plans
 * - Used by PlanSettingsComponent for displaying available plans
 * - Used by PlanLimitationsGuard for checking plan limits
 * - Used by AppContextService for caching global plans
 *
 * @service
 * @injectable
 * @providedIn root
 */
@Injectable({
  providedIn: 'root'
})
export class PlanService {
  private isBrowser: boolean;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
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
   * CREAR: Crear un nuevo plan (admin only)
   * @param plan Datos del plan a crear
   * @returns Promise con el ID del documento creado
   */
  async createPlan(plan: Plan): Promise<string> {
    if (!this.isBrowser) {
      throw new Error('Not available in SSR');
    }

    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.createPlan(plan, idToken);
      
      if (response.success && response.data?.plan) {
        return response.data.plan.id;
      }
      throw new Error(response.error?.message || 'Failed to create plan');
    } catch (error) {
      console.error('❌ Error al crear plan:', error);
      throw error;
    }
  }

  /**
   * LEER: Obtener todos los planes
   * Cachea los resultados en localStorage para evitar múltiples peticiones.
   * @param forceRefresh Fuerza a pedir los datos a Firebase ignorando el caché
   * @returns Promise con array de todos los planes
   */
  async getAllPlans(forceRefresh: boolean = false): Promise<Plan[]> {
    if (!this.isBrowser) {
      return [];
    }

    const CACHE_KEY = 'trade_switch_plans';

    try {
      if (!forceRefresh) {
        const cachedPlans = localStorage.getItem(CACHE_KEY);
        if (cachedPlans) {
          try {
            return JSON.parse(cachedPlans) as Plan[];
          } catch (e) {
            console.error('❌ Error al parsear planes cacheados:', e);
            // Ignorar caché si hay error al parsear
          }
        }
      }

      const idToken = await this.getIdToken();
      const response = await this.backendApi.getAllPlans(idToken);
      if (response.success && response.data?.plans) {
        const plans = response.data.plans as Plan[];
        localStorage.setItem(CACHE_KEY, JSON.stringify(plans));
        return plans;
      }
      return [];
    } catch (error) {
      console.error('❌ Error al obtener planes:', error);
      return [];
    }
  }

  /**
   * LEER: Obtener un plan por ID
   * @param id ID del plan
   * @returns Promise con el plan específico
   */
  async getPlanById(id: string): Promise<Plan | undefined> {
    if (!this.isBrowser) {
      return undefined;
    }

    try {
      // Buscar el plan en el listado cacheado (o forzar su carga inicial)
      const allPlans = await this.getAllPlans();
      const cachedPlan = allPlans.find(p => p.id === id);

      if (cachedPlan) {
        return cachedPlan;
      }

      // Si aún no está en caché (ej. se creó un plan recientemente), hacer petición API
      const idToken = await this.getIdToken();
      const response = await this.backendApi.getPlanById(id, idToken);
      
      if (response.success && response.data?.plan) {
        const plan = response.data.plan as Plan;
        // Refrescar caché en background con el nuevo listado de planes
        this.getAllPlans(true).catch(e => console.error('Error refrescando caché de planes:', e));
        return plan;
      }
      return undefined;
    } catch (error) {
      console.error('❌ Error al obtener el plan por ID:', error);
      return undefined;
    }
  }

  /**
   * ACTUALIZAR: Actualizar un plan existente (admin only)
   * @param id ID del plan a actualizar
   * @param plan Datos actualizados del plan
   * @returns Promise that resolves when the update completes
   */
  async updatePlan(id: string, plan: Partial<Omit<Plan, 'id' | 'createdAt'>>): Promise<void> {
    if (!this.isBrowser) {
      throw new Error('Not available in SSR');
    }

    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.updatePlan(id, plan, idToken);
      
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to update plan');
      }
    } catch (error) {
      console.error('❌ Error al actualizar plan:', error);
      throw error;
    }
  }

  /**
   * ELIMINAR: Eliminar un plan (admin only)
   * @param id ID del plan a eliminar
   * @returns Promise that resolves when the deletion completes
   */
  async deletePlan(id: string): Promise<void> {
    if (!this.isBrowser) {
      throw new Error('Not available in SSR');
    }

    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.deletePlan(id, idToken);
      
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to delete plan');
      }
    } catch (error) {
      console.error('❌ Error al eliminar plan:', error);
      throw error;
    }
  }

  /**
   * LEER: Obtener un plan por nombre exacto
   * @param name Nombre exacto del plan
   * @returns Promise con el plan específico o undefined si no se encuentra
   */
  async getPlanByName(name: string): Promise<Plan | undefined> {
    if (!this.isBrowser) {
      return undefined;
    }

    try {
      // Buscar el plan en el listado cacheado
      const allPlans = await this.getAllPlans();
      const cachedPlan = allPlans.find(plan => plan.name === name);

      if (cachedPlan) {
        return cachedPlan;
      }

      // Si no se encuentra, hacer fallback a la API
      const idToken = await this.getIdToken();
      const response = await this.backendApi.searchPlansByName(name, idToken);
      
      if (response.success && response.data?.plans) {
        // Buscar plan con nombre exacto
        const matchingPlan = response.data.plans.find(plan => plan.name === name);
        if (matchingPlan) {
          // Refrescar caché en background
          this.getAllPlans(true).catch(e => console.error('Error refrescando caché de planes:', e));
        }
        return matchingPlan as Plan | undefined;
      }
      return undefined;
    } catch (error) {
      console.error('❌ Error al obtener plan por nombre:', error);
      return undefined;
    }
  }

  /**
   * LEER: Buscar planes por nombre
   * @param name Nombre o parte del nombre a buscar
   * @returns Promise con planes que coinciden con la búsqueda
   */
  async searchPlansByName(name: string): Promise<Plan[]> {
    if (!this.isBrowser) {
      return [];
    }

    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.searchPlansByName(name, idToken);
      
      if (response.success && response.data?.plans) {
        return response.data.plans as Plan[];
      }
      return [];
    } catch (error) {
      console.error('❌ Error en searchPlansByName:', error);
      return [];
    }
  }

}