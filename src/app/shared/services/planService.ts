import { Injectable } from '@angular/core';
import { getFirestore, collection, query, getDocs, updateDoc, doc, Timestamp, setDoc, orderBy, getDoc, deleteDoc, where, DocumentSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/firebase.init';

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

  /**
   * CREAR: Crear un nuevo plan
   * @param plan Datos del plan a crear
   * @returns Promise con el ID del documento creado
   */
  async createPlan(plan: Plan): Promise<string> {
    try {
      const planData = {
        ...plan,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await setDoc(doc(db, 'plan', planData.id), planData);
      return planData.id;
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
    try {
      const plansRef = collection(db, 'plan');
      
      // Intentar sin orderBy primero para ver si ese es el problema
      const querySnapshot = await getDocs(plansRef);
      
      if (querySnapshot.empty) {
        console.log('⚠️ No se encontraron planes en la colección "plan"');
        return [];
      }
      
      const plans = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return { id: doc.id, ...data };
      });
      
      return plans as Plan[];
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
    return getDoc(doc(db, 'plan', id))
      .then((doc) => ({ id: doc.id, ...doc.data() } as Plan))
      .catch((error) => {
        console.error('❌ Error al obtener el plan por ID:', error);
        return undefined;
      })
  }

  /**
   * ACTUALIZAR: Actualizar un plan existente
   * @param id ID del plan a actualizar
   * @param plan Datos actualizados del plan
   * @returns Promise que se resuelve cuando se completa la actualización
   */
  async updatePlan(id: string, plan: Partial<Omit<Plan, 'id' | 'createdAt'>>): Promise<void> {
    try {
      const updateData = {
        ...plan,
        updatedAt: new Date()
      };
      
      await updateDoc(doc(db, 'plan', id), updateData);
    } catch (error) {
      console.error('❌ Error al actualizar plan:', error);
      throw error;
    }
  }

  /**
   * ELIMINAR: Eliminar un plan
   * @param id ID del plan a eliminar
   * @returns Promise que se resuelve cuando se completa la eliminación
   */
  async deletePlan(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'plan', id));
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
    try {
      const plansRef = collection(db, 'plan');
      const querySnapshot = await getDocs(plansRef);
      
      if (querySnapshot.empty) {
        return undefined;
      }
      
      // Buscar plan con nombre exacto
      const matchingDoc = querySnapshot.docs.find(doc => {
        const data = doc.data();
        return data['name'] === name;
      });
      
      if (matchingDoc) {
        const data = matchingDoc.data();
        return { id: matchingDoc.id, ...data } as Plan;
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
    try {
      
      const plansRef = collection(db, 'plan');
      
      // Primero obtener todos los planes para debug
      const allPlansSnapshot = await getDocs(plansRef);
      
      if (allPlansSnapshot.empty) {
        console.log('⚠️ La colección "plan" está vacía');
        return [];
      }
      
      // Mostrar todos los planes disponibles
      allPlansSnapshot.docs.forEach((doc, index) => {
        const data = doc.data();
      });
      
      // Buscar planes que coincidan con el nombre (búsqueda simple)
      const matchingPlans = allPlansSnapshot.docs.filter(doc => {
        const data = doc.data();
        const planName = data['name']?.toLowerCase() || '';
        const searchName = name.toLowerCase();
        return planName.includes(searchName) || searchName.includes(planName);
      });
      
      const plans = matchingPlans.map((doc) => {
        const data = doc.data();
        console.log('✅ Plan encontrado:', { id: doc.id, name: data['name'] });
        return { id: doc.id, ...data };
      });
      
      return plans as Plan[];

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
    try {
      const document = await getDoc(doc(db, 'plan', id)) as DocumentSnapshot<Plan>;
      return document.exists() || false;
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
    return getDocs(query(collection(db, 'plan')))
      .then((snapshot) => snapshot.docs.length)
      .catch((error) => {
        return 0;
      })
  }
}