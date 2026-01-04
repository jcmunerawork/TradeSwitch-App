
import { Injectable } from '@angular/core';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy,
  Timestamp,
  onSnapshot,
  limit
} from 'firebase/firestore';
import { db } from '../../firebase/firebase.init';
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
   * @param userId ID del usuario (se mantiene por compatibilidad, pero el endpoint lo obtiene del token)
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
        console.log('ℹ️ SubscriptionService: Usuario sin suscripción (404), retornando null');
        return null;
      }
      
      // Cualquier otro error también se trata como "sin suscripción"
      console.warn('⚠️ SubscriptionService: Error al obtener suscripción, tratando como usuario sin suscripción:', error?.message || error);
      return null;
    }
  }

  /**
   * Escucha cambios en la última suscripción del usuario (único documento esperado)
   * NOTE: This method still uses Firebase real-time listener for now.
   * In the future, this could be replaced with WebSocket or Server-Sent Events from backend.
   * Devuelve una función para desuscribirse
   */
  listenToUserLatestSubscription(
    userId: string,
    handler: (subscription: Subscription | null) => void
  ): () => void {
    // For now, keep using Firebase real-time listener
    // TODO: Replace with backend WebSocket/SSE when available
    const paymentsRef = collection(db, 'users', userId, 'subscription');
    const q = query(paymentsRef, orderBy('created_at', 'desc'), limit(1));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        handler(null);
        return;
      }
      const latestDoc = snapshot.docs[0];
      const data = latestDoc.data();
      handler({ id: latestDoc.id, ...data } as Subscription);
    }, (error) => {
      console.error('❌ Error en listener de suscripción:', error);
      handler(null);
    });
    return unsubscribe;
  }

  /**
   * Obtiene un pago específico por ID
   * Now uses backend API but maintains same interface
   * @param userId ID del usuario
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
   * Crea un nuevo pago
   * Now uses backend API but maintains same interface
   * @param userId ID del usuario
   * @param paymentData Datos del pago (sin id)
   * @returns Promise con el ID del pago creado
   */
  async createSubscription(userId: string, paymentData: Omit<Subscription, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.createSubscription(userId, paymentData, idToken);
      
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to create subscription');
      }
      
      return response.data.subscriptionId;
    } catch (error) {
      console.error('Error al crear pago:', error);
      throw error;
    }
  }

  /**
   * Actualiza un pago existente
   * Now uses backend API but maintains same interface
   * @param userId ID del usuario
   * @param paymentId ID del pago
   * @param updateData Datos a actualizar
   * @returns Promise void
   */
  async updateSubscription(userId: string, paymentId: string, updateData: Partial<Omit<Subscription, 'id' | 'created_at' | 'userId'>>): Promise<void> {
    try {
      const idToken = await this.getIdToken();
      const updatePayload = {
        ...updateData,
        updated_at: Timestamp.now()
      };
      const response = await this.backendApi.updateSubscription(userId, paymentId, updatePayload, idToken);
      
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to update subscription');
      }
    } catch (error) {
      console.error('Error al actualizar pago:', error);
      throw error;
    }
  }

  /**
   * Elimina un pago
   * Now uses backend API but maintains same interface
   * @param userId ID del usuario
   * @param paymentId ID del pago
   * @returns Promise void
   */
  async deleteSubscription(userId: string, paymentId: string): Promise<void> {
    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.deleteSubscription(userId, paymentId, idToken);
      
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to delete subscription');
      }
    } catch (error) {
      console.error('Error al eliminar pago:', error);
      throw error;
    }
  }

  /**
   * Obtiene pagos filtrados por estado
   * Now uses backend API but maintains same interface
   * @param userId ID del usuario
   * @param status Estado del pago
   * @returns Promise con array de pagos filtrados
   */
  async getSubscriptionsByStatus(userId: string, status: Subscription['status']): Promise<Subscription[]> {
    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.getSubscriptionsByStatus(userId, status.toString(), idToken);
      
      if (!response.success || !response.data) {
        return [];
      }
      
      return response.data.subscriptions || [];
    } catch (error) {
      console.error('Error al obtener pagos por estado:', error);
      throw error;
    }
  }

  /**
   * Obtiene el total de pagos de un usuario
   * Now uses backend API but maintains same interface
   * @param userId ID del usuario
   * @returns Promise con el número total de pagos
   */
  async getTotalSubscriptionsCount(userId: string): Promise<number> {
    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.getTotalSubscriptionsCount(userId, idToken);
      
      if (!response.success || !response.data) {
        return 0;
      }
      
      return response.data.count;
    } catch (error) {
      console.error('Error al obtener conteo de pagos:', error);
      throw error;
    }
  }

  /**
   * Método de debug para verificar la estructura de la base de datos
   * @param userId ID del usuario
   */
}