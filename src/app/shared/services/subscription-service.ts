
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
  constructor() {}

  /**
   * Obtiene la última suscripción de un usuario (único documento esperado)
   * @param userId ID del usuario
   * @returns Promise con la suscripción o null si no existe
   */
  async getUserLatestSubscription(userId: string): Promise<Subscription | null> {
    try {
      const paymentsRef = collection(db, 'users', userId, 'subscription');
      const q = query(paymentsRef, orderBy('created_at', 'desc'), limit(1));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return null;
      }

      const latestDoc = querySnapshot.docs[0];
      const data = latestDoc.data();
      return data as unknown as Subscription;
    } catch (error) {
      console.error('❌ Error al obtener suscripción del usuario:', error);
      throw error;
    }
  }

  /**
   * Escucha cambios en la última suscripción del usuario (único documento esperado)
   * Devuelve una función para desuscribirse
   */
  listenToUserLatestSubscription(
    userId: string,
    handler: (subscription: Subscription | null) => void
  ): () => void {
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

  // TODO: IMPLEMENTAR ENDPOINT DE VERIFICACIÓN DE PAGO - Reemplazar Firebase con API real
  /**
   * Obtiene un pago específico por ID
   * @param userId ID del usuario
   * @param paymentId ID del pago
   * @returns Promise con el pago o null si no existe
   */
  async getSubscriptionById(userId: string, paymentId: string): Promise<Subscription | null> {
    try {
      const paymentRef = doc(db, 'users', userId, 'subscription', paymentId);
      const paymentSnap = await getDoc(paymentRef);
      
      if (paymentSnap.exists()) {
        return {
          id: paymentSnap.id,
          ...paymentSnap.data()
        } as Subscription;
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error al obtener pago:', error);
      throw error;
    }
  }

  // TODO: IMPLEMENTAR ENDPOINT DE CREACIÓN DE PAGO - Reemplazar Firebase con API real
  /**
   * Crea un nuevo pago
   * @param userId ID del usuario
   * @param paymentData Datos del pago (sin id)
   * @returns Promise con el ID del pago creado
   */
  async createSubscription(userId: string, paymentData: Omit<Subscription, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    try {
      const paymentsRef = collection(db, 'users', userId, 'subscription');
      const now = Timestamp.now();
      
      const newPayment = {
        ...paymentData,
        created_at: now,
        updated_at: now
      };
      
      const docRef = await addDoc(paymentsRef, newPayment);
      return docRef.id;
    } catch (error) {
      console.error('Error al crear pago:', error);
      throw error;
    }
  }

  /**
   * Actualiza un pago existente
   * @param userId ID del usuario
   * @param paymentId ID del pago
   * @param updateData Datos a actualizar
   * @returns Promise void
   */
  async updateSubscription(userId: string, paymentId: string, updateData: Partial<Omit<Subscription, 'id' | 'created_at' | 'userId'>>): Promise<void> {
    try {
      const paymentRef = doc(db, 'users', userId, 'subscription', paymentId);
      const updatePayload = {
        ...updateData,
        updated_at: Timestamp.now()
      };
      
      await updateDoc(paymentRef, updatePayload);
    } catch (error) {
      console.error('Error al actualizar pago:', error);
      throw error;
    }
  }

  /**
   * Elimina un pago
   * @param userId ID del usuario
   * @param paymentId ID del pago
   * @returns Promise void
   */
  async deleteSubscription(userId: string, paymentId: string): Promise<void> {
    try {
      const paymentRef = doc(db, 'users', userId, 'subscription', paymentId);
      await deleteDoc(paymentRef);
    } catch (error) {
      console.error('Error al eliminar pago:', error);
      throw error;
    }
  }

  /**
   * Obtiene pagos filtrados por estado
   * @param userId ID del usuario
   * @param status Estado del pago
   * @returns Promise con array de pagos filtrados
   */
  async getSubscriptionsByStatus(userId: string, status: Subscription['status']): Promise<Subscription[]> {
    try {
      const paymentsRef = collection(db, 'users', userId, 'subscription');
      const q = query(
        paymentsRef, 
        orderBy('created_at', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Subscription))
        .filter(payment => payment.status === status);
    } catch (error) {
      console.error('Error al obtener pagos por estado:', error);
      throw error;
    }
  }

  /**
   * Obtiene el total de pagos de un usuario
   * @param userId ID del usuario
   * @returns Promise con el número total de pagos
   */
  async getTotalSubscriptionsCount(userId: string): Promise<number> {
    try {
      const paymentsRef = collection(db, 'users', userId, 'subscription');
      const querySnapshot = await getDocs(paymentsRef);
      return querySnapshot.size;
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