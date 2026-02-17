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
   * @returns Promise con array de todos los planes
   */
  async getAllPlans(): Promise<Plan[]> {
    if (!this.isBrowser) {
      return [];
    }

    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.getAllPlans(idToken);
      
      if (response.success && response.data?.plans) {
        return response.data.plans as Plan[];
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
      const idToken = await this.getIdToken();
      const response = await this.backendApi.getPlanById(id, idToken);
      
      if (response.success && response.data?.plan) {
        return response.data.plan as Plan;
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
   * @returns Promise que se resuelve cuando se completa la actualización
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
   * @returns Promise que se resuelve cuando se completa la eliminación
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
      const idToken = await this.getIdToken();
      const response = await this.backendApi.searchPlansByName(name, idToken);
      
      if (response.success && response.data?.plans) {
        // Buscar plan con nombre exacto
        const matchingPlan = response.data.plans.find(plan => plan.name === name);
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

  /**
   * UTILIDAD: Verificar si un plan existe
   * @param id ID del plan a verificar
   * @returns Promise que se resuelve con true si existe, false si no
   */
  async planExists(id: string): Promise<boolean> {
    if (!this.isBrowser) {
      return false;
    }

    try {
      const plan = await this.getPlanById(id);
      return plan !== undefined;
    } catch (error) {
      console.error('❌ Error al verificar existencia del plan:', error);
      return false;
    }
  }

  /**
   * UTILIDAD: Obtener el conteo total de planes
   * @returns Promise con el número total de planes
   */
  async getPlansCount(): Promise<number> {
    if (!this.isBrowser) {
      return 0;
    }

    try {
      const plans = await this.getAllPlans();
      return plans.length;
    } catch (error) {
      console.error('❌ Error al obtener conteo de planes:', error);
      return 0;
    }
  }
}