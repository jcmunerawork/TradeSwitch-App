
import { Injectable } from '@angular/core';
import { Timestamp } from 'firebase/firestore';
import { UserStatus } from '../../features/overview/models/overview';
import { BackendApiService } from '../../core/services/backend-api.service';
import { getAuth } from 'firebase/auth';

/**
 * Interface for user subscription data.
 *
 * @interface Subscription
 */
export interface Subscription {
  id?: string;
  planId: string;
  status: UserStatus;
  created_at: Timestamp;
  updated_at: Timestamp;
  userId: string;
  transactionId?: string;
  periodStart?: Timestamp;
  periodEnd?: Timestamp;
  cancelAtPeriodEnd?: boolean;
}

/**
 * Service for managing user subscriptions in Firebase.
 *
 * This service provides CRUD operations for user subscriptions, including
 * creating, reading, updating, and listening to subscription changes.
 * It manages subscription data in the Firestore subcollection
 * `users/{userId}/subscription`.
 *
 * Features:
 * - Get user's latest subscription
 * - Listen to subscription changes in real-time
 * - Create new subscriptions
 * - Update existing subscriptions
 * - Delete subscriptions
 * - Get subscription by ID
 * - Get all user subscriptions
 *
 * Subscription Structure:
 * - Stored in: `users/{userId}/subscription/{subscriptionId}`
 * - Ordered by `created_at` descending
 * - Only one active subscription per user expected
 *
 * Relations:
 * - Used by AuthService for plan management
 * - Used by PlanSettingsComponent for subscription display
 * - Used by PlanLimitationsGuard for plan validation
 *
 * @service
 * @injectable
 * @providedIn root
 */
@Injectable({
  providedIn: 'root'
})
export class SubscriptionService {
  constructor(private backendApi: BackendApiService) {}

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
   * Obtiene la última suscripción de un usuario (único documento esperado)
   * Now uses backend API but maintains same interface
   * 
   * Endpoint: GET /api/v1/profile/subscriptions/latest
   * El endpoint siempre retorna 200, nunca 404.
   * Cuando no hay suscripción, retorna: { "success": true, "data": { "subscription": null } }
   * 
   * @param userId User ID (kept for compatibility; endpoint gets it from the token)
   * @returns Promise con la suscripción o null si no existe
   */
  async getUserLatestSubscription(userId: string): Promise<Subscription | null> {
    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.getUserLatestSubscription(userId, idToken);
      
      // El endpoint siempre retorna success: true
      // Si no hay suscripción, data.subscription será null
      if (!response.success) {
        console.warn('⚠️ SubscriptionService: Respuesta no exitosa del backend:', response);
        return null;
      }
      
      // Si data es null o undefined, o subscription es null, retornar null
      if (!response.data || response.data.subscription === null || response.data.subscription === undefined) {
        return null;
      }
      
      return response.data.subscription as Subscription;
    } catch (error: any) {
      // ✅ Manejar todos los errores como "usuario sin suscripción" (caso válido)
      // El endpoint nunca debería retornar error, pero por si acaso lo manejamos
      if (error?.status === 404) {
        return null;
      }
      
      // Cualquier otro error también se trata como "sin suscripción"
      console.warn('⚠️ SubscriptionService: Error al obtener suscripción, tratando como usuario sin suscripción:', error?.message || error);
      return null;
    }
  }

  /**
   * Escucha cambios en la última suscripción del usuario mediante polling al backend (REST).
   *
   * @param userId - User ID
   * @param handler - Función que se ejecuta cuando se obtiene la suscripción (y en cada poll)
   * @returns Función para desuscribirse (detener el polling)
   */
  listenToUserLatestSubscription(
    userId: string,
    handler: (subscription: Subscription | null) => void
  ): () => void {
    const POLL_INTERVAL_MS = 3 * 60 * 1000; // 3 minutos

    const poll = async () => {
      try {
        const subscription = await this.getUserLatestSubscription(userId);
        handler(subscription ?? null);
      } catch {
        // Ignorar errores de polling
      }
    };

    poll();
    const intervalId = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }

  /**
   * Obtiene un pago específico por ID
   * Now uses backend API but maintains same interface
   * @param userId User ID
   * @param paymentId ID del pago
   * @returns Promise con el pago o null si no existe
   */
  async getSubscriptionById(userId: string, paymentId: string): Promise<Subscription | null> {
    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.getSubscriptionById(userId, paymentId, idToken);
      
      if (!response.success || !response.data) {
        return null;
      }
      
      return response.data.subscription as Subscription;
    } catch (error) {
      console.error('Error al obtener pago:', error);
      throw error;
    }
  }

  /**
   * Update an existing subscription
   * @param userId User ID
   * @param subscriptionId ID de la suscripción a actualizar
   * @param updateData Datos a actualizar (status, planId, etc.)
   */
  async updateSubscription(userId: string, subscriptionId: string, updateData: Partial<Subscription>): Promise<void> {
    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.updateSubscription(userId, subscriptionId, updateData, idToken);
      
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to update subscription');
      }
    } catch (error) {
      console.error('Error updating subscription:', error);
      throw error;
    }
  }

}