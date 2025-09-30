import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { getFirestore, collection, query, getDocs, updateDoc, doc, Timestamp, where } from 'firebase/firestore';
import { firebaseApp } from '../../firebase/firebase.init';

@Injectable({
  providedIn: 'root'
})
export class StrategyDaysUpdaterService {
  private isBrowser: boolean;
  private db: ReturnType<typeof getFirestore> | null = null;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (this.isBrowser) {
      this.db = getFirestore(firebaseApp);
    }
  }

  /**
   * Actualiza los días activos de todas las estrategias del usuario
   * @param userId - ID del usuario
   */
  async updateAllStrategiesDaysActive(userId: string): Promise<void> {
    if (!this.isBrowser || !this.db) {
      console.warn('StrategyDaysUpdaterService: No se puede ejecutar en el servidor');
      return;
    }

    try {
      // Obtener todas las estrategias del usuario
      const strategiesRef = collection(this.db, 'configuration-overview');
      const q = query(strategiesRef);
      const querySnapshot = await getDocs(q);
      
      const strategiesToUpdate: { id: string; daysActive: number }[] = [];

      querySnapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        
        // Verificar que la estrategia pertenece al usuario
        if (data['userId'] === userId && data['created_at']) {
          const daysActive = this.calculateDaysActive(data['created_at']);
          
          // Actualizar siempre para mantener sincronizado
          strategiesToUpdate.push({
            id: docSnapshot.id,
            daysActive: daysActive
          });
        }
      });

      // Actualizar todas las estrategias
      const updatePromises = strategiesToUpdate.map(strategy => 
        updateDoc(doc(this.db!, 'configuration-overview', strategy.id), {
          days_active: strategy.daysActive,
          updated_at: Timestamp.now()
        })
      );

      if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
      }

    } catch (error) {
      console.error('StrategyDaysUpdaterService: Error al actualizar días activos:', error);
      throw error;
    }
  }

  /**
   * Actualiza los días activos de la estrategia activa del usuario
   * @param userId - ID del usuario
   */
  async updateActiveStrategyDaysActive(userId: string): Promise<void> {
    if (!this.isBrowser || !this.db) {
      console.warn('StrategyDaysUpdaterService: No se puede ejecutar en el servidor');
      return;
    }

    try {
      // Buscar la estrategia activa del usuario
      const strategiesRef = collection(this.db, 'configuration-overview');
      const q = query(
        strategiesRef,
        where('userId', '==', userId),
        where('status', '==', true)
      );
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        console.log('StrategyDaysUpdaterService: No se encontró estrategia activa para el usuario:', userId);
        return;
      }

      // Solo debe haber una estrategia activa
      const activeStrategyDoc = querySnapshot.docs[0];
      const data = activeStrategyDoc.data();
      
      if (!data['created_at']) {
        console.warn('StrategyDaysUpdaterService: Estrategia activa sin fecha de creación');
        return;
      }

      const daysActive = this.calculateDaysActive(data['created_at']);
      
      // Solo actualizar si los días han cambiado
      if (data['days_active'] !== daysActive) {
        await updateDoc(activeStrategyDoc.ref, {
          days_active: daysActive,
          updated_at: Timestamp.now()
        });
        console.log(`StrategyDaysUpdaterService: Actualizada estrategia activa ${activeStrategyDoc.id} con ${daysActive} días activos`);
      }

    } catch (error) {
      console.error('StrategyDaysUpdaterService: Error al actualizar días activos de la estrategia activa:', error);
      throw error;
    }
  }

  /**
   * Actualiza los días activos de una estrategia específica
   * @param strategyId - ID de la estrategia
   * @param userId - ID del usuario (para verificación de seguridad)
   */
  async updateStrategyDaysActive(strategyId: string, userId: string): Promise<void> {
    if (!this.isBrowser || !this.db) {
      console.warn('StrategyDaysUpdaterService: No se puede ejecutar en el servidor');
      return;
    }

    try {
      const strategyRef = doc(this.db, 'configuration-overview', strategyId);
      const strategyDoc = await getDocs(query(collection(this.db, 'configuration-overview')));
      
      let strategyData: any = null;
      strategyDoc.forEach(docSnapshot => {
        if (docSnapshot.id === strategyId && docSnapshot.data()['userId'] === userId) {
          strategyData = docSnapshot.data();
        }
      });

      if (!strategyData || !strategyData['created_at']) {
        console.warn('StrategyDaysUpdaterService: Estrategia no encontrada o sin fecha de creación');
        return;
      }

      const daysActive = this.calculateDaysActive(strategyData['created_at']);
      
      // Solo actualizar si los días han cambiado
      if (strategyData['days_active'] !== daysActive) {
        await updateDoc(strategyRef, {
          days_active: daysActive,
          updated_at: Timestamp.now()
        });
      }

    } catch (error) {
      console.error('StrategyDaysUpdaterService: Error al actualizar días activos de la estrategia:', error);
      throw error;
    }
  }

  /**
   * Calcula los días activos desde la fecha de creación
   * @param createdAt - Timestamp de Firebase o fecha de creación
   * @returns Número de días activos
   */
  private calculateDaysActive(createdAt: any): number {
    let createdDate: Date;

    // Manejar diferentes tipos de timestamp de Firebase
    if (createdAt && typeof createdAt.toDate === 'function') {
      // Es un Timestamp de Firebase
      createdDate = createdAt.toDate();
    } else if (createdAt && createdAt.seconds) {
      // Es un objeto con seconds
      createdDate = new Date(createdAt.seconds * 1000);
    } else if (createdAt instanceof Date) {
      // Ya es una fecha
      createdDate = createdAt;
    } else if (typeof createdAt === 'string') {
      // Es un string de fecha
      createdDate = new Date(createdAt);
    } else {
      console.warn('StrategyDaysUpdaterService: Formato de fecha no reconocido:', createdAt);
      return 0;
    }

    // Obtener la fecha actual y la fecha de creación en formato YYYY-MM-DD (sin horas)
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const createdDay = new Date(createdDate.getFullYear(), createdDate.getMonth(), createdDate.getDate());
    
    // Calcular la diferencia en días completos
    const diffTime = today.getTime() - createdDay.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    // Si es el mismo día, retornar 0
    // Si han pasado días completos, retornar la diferencia
    return Math.max(0, diffDays);
  }

  /**
   * Obtiene los días activos de una estrategia sin actualizar en Firebase
   * @param createdAt - Timestamp de Firebase o fecha de creación
   * @returns Número de días activos
   */
  getDaysActive(createdAt: any): number {
    return this.calculateDaysActive(createdAt);
  }
}
