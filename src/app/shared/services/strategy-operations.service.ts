import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, deleteDoc, updateDoc, orderBy, limit, addDoc } from 'firebase/firestore';
import { isPlatformBrowser } from '@angular/common';
import { Timestamp } from 'firebase/firestore';
import { MaxDailyTradesConfig, StrategyState, ConfigurationOverview } from '../../features/strategy/models/strategy.model';

@Injectable({
  providedIn: 'root'
})
export class StrategyOperationsService {
  private isBrowser: boolean;
  private db: ReturnType<typeof getFirestore> | null = null;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (this.isBrowser) {
      const { firebaseApp } = require('../../firebase/firebase.init.ts');
      this.db = getFirestore(firebaseApp);
    }
  }

  // ===== CONFIGURATION-OVERVIEW (colección de metadatos) =====
  
  /**
   * Crear configuration-overview (solo metadatos)
   */
  async createConfigurationOverview(userId: string, name: string): Promise<string> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return '';
    }

    const overviewId = this.generateOverviewId();
    const now = Timestamp.now();
    
    const configurationOverview: ConfigurationOverview = {
      userId: userId,
      name: name,
      status: false, // Inicialmente inactiva
      created_at: now,
      updated_at: now,
      days_active: 0,
      configurationId: '' // Se establecerá después de crear la configuración
    };

    await setDoc(doc(this.db, 'configuration-overview', overviewId), configurationOverview);
    return overviewId;
  }

  /**
   * Obtener configuration-overview por ID (solo metadatos)
   */
  async getConfigurationOverview(overviewId: string): Promise<ConfigurationOverview | null> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return null;
    }

    try {
      const docRef = doc(this.db, 'configuration-overview', overviewId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data() as ConfigurationOverview;
        (data as any).id = docSnap.id; // Agregar ID del documento
        return data;
      }
      return null;
    } catch (error) {
      console.error('Error getting configuration overview:', error);
      return null;
    }
  }

  /**
   * Actualizar configuration-overview
   */
  async updateConfigurationOverview(overviewId: string, updates: Partial<ConfigurationOverview>): Promise<void> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return;
    }

    const docRef = doc(this.db, 'configuration-overview', overviewId);
    const updateData = {
      ...updates,
      updated_at: Timestamp.now()
    };
    
    await updateDoc(docRef, updateData);
  }

  /**
   * Eliminar configuration-overview
   */
  async deleteConfigurationOverview(overviewId: string): Promise<void> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return;
    }

    const docRef = doc(this.db, 'configuration-overview', overviewId);
    await deleteDoc(docRef);
  }

  // ===== CONFIGURATIONS (colección de reglas) =====
  
  /**
   * Crear configuración (solo reglas + IDs)
   */
  async createConfiguration(userId: string, configurationOverviewId: string, configuration: StrategyState): Promise<void> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return;
    }
    
    const configData = {
      ...configuration,
      configurationOverviewId: configurationOverviewId,
      userId: userId
    };
      
    await setDoc(doc(this.db, 'configurations', userId), configData);
  }

  /**
   * Obtener configuración por userId
   */
  async getConfiguration(userId: string): Promise<StrategyState | null> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return null;
    }

    try {
      const docRef = doc(this.db, 'configurations', userId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return docSnap.data() as StrategyState;
      }
      return null;
    } catch (error) {
      console.error('Error getting configuration:', error);
      return null;
    }
  }

  /**
   * Actualizar configuración
   */
  async updateConfiguration(userId: string, configuration: StrategyState): Promise<void> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return;
    }

    await updateDoc(doc(this.db, 'configurations', userId), configuration as any);
  }

  /**
   * Crear solo configuration (sin userId ni configurationOverviewId)
   */
  async createConfigurationOnly(configuration: StrategyState): Promise<string> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      throw new Error('Firestore not available');
    }

    try {
      const docRef = await addDoc(collection(this.db, 'configurations'), configuration as any);
      return docRef.id;
    } catch (error) {
      console.error('Error creating configuration:', error);
      throw error;
    }
  }

  /**
   * Crear configuration-overview con configurationId
   */
  async createConfigurationOverviewWithConfigId(userId: string, name: string, configurationId: string, shouldBeActive: boolean = false): Promise<string> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      throw new Error('Firestore not available');
    }

    try {
      const now = new Date();
      const overviewData: ConfigurationOverview = {
        userId,
        name,
        status: shouldBeActive, // Activa solo si no hay otra activa
        created_at: now,
        updated_at: now,
        days_active: 0,
        configurationId,
        dateActive: [now],
      };

      const docRef = await addDoc(collection(this.db, 'configuration-overview'), overviewData as any);
      return docRef.id;
    } catch (error) {
      console.error('Error creating configuration overview:', error);
      throw error;
    }
  }

  /**
   * Actualizar configuration por ID
   */
  async updateConfigurationById(configurationId: string, configuration: StrategyState): Promise<void> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      throw new Error('Firestore not available');
    }

    try {
      const docRef = doc(this.db, 'configurations', configurationId);
      await updateDoc(docRef, configuration as any);
    } catch (error) {
      console.error('Error updating configuration by ID:', error);
      throw error;
    }
  }

  /**
   * Obtener configuración por ID
   */
  async getConfigurationById(configurationId: string): Promise<StrategyState | null> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return null;
    }

    try {
      const docRef = doc(this.db, 'configurations', configurationId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data() as StrategyState;
      }
      return null;
    } catch (error) {
      console.error('Error getting configuration by ID:', error);
      return null;
    }
  }

  /**
   * Obtener configuración por configurationOverviewId (método legacy para compatibilidad)
   */
  async getConfigurationByOverviewId(overviewId: string): Promise<StrategyState | null> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return null;
    }

    try {
      // Buscar en configurations donde configurationOverviewId coincida
      const q = query(
        collection(this.db, 'configurations'),
        where('configurationOverviewId', '==', overviewId),
        limit(1)
      );
      
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        return doc.data() as StrategyState;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting configuration by overview ID:', error);
      return null;
    }
  }

  /**
   * Obtener todas las estrategias de un usuario
   */
  async getUserStrategyViews(userId: string): Promise<ConfigurationOverview[]> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return [];
    }

    try {
      // 1. Primero obtener todos los configuration-overview del usuario
      const overviewQuery = query(
        collection(this.db, 'configuration-overview'),
        where('userId', '==', userId)
      );
      
      const overviewSnapshot = await getDocs(overviewQuery);
      
      const strategies: ConfigurationOverview[] = [];
      
      overviewSnapshot.forEach((doc) => {
        const data = doc.data() as ConfigurationOverview;
        (data as any).id = doc.id; // Agregar ID del documento
        strategies.push(data);
      });
      
      // Filtrar estrategias que no estén marcadas como deleted
      // Mostrar solo las que:
      // 1. No tienen el campo 'deleted' (estrategias antiguas)
      // 2. Tienen 'deleted: false' (explícitamente no eliminadas)
      const activeStrategies = strategies.filter(strategy => 
        strategy.deleted === undefined || strategy.deleted === false
      );
      
      // Ordenar manualmente por updated_at descendente
      activeStrategies.sort((a, b) => {
        const dateA = a.updated_at.toDate();
        const dateB = b.updated_at.toDate();
        return dateB.getTime() - dateA.getTime();
      });
      
      return activeStrategies;
    } catch (error) {
      console.error('❌ Error getting user strategies:', error);
      return [];
    }
  }

  /**
   * Obtener configuración activa (método legacy para compatibilidad)
   */
  async getActiveConfiguration(userId: string): Promise<ConfigurationOverview | null> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return null;
    }

    try {
      // Buscar estrategia activa en configuration-overview
      const q = query(
        collection(this.db, 'configuration-overview'),
        where('userId', '==', userId),
        where('status', '==', true),
        limit(1)
      );
      
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        const data = doc.data() as ConfigurationOverview;
        (data as any).id = doc.id;
        return data;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting active configuration:', error);
      return null;
    }
  }

  /**
   * Activar una estrategia
   */
  async activateStrategyView(userId: string, strategyId: string): Promise<void> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return;
    }

    try {
      // 1. Desactivar todas las estrategias del usuario
      const q = query(
        collection(this.db, 'configuration-overview'),
        where('userId', '==', userId),
        where('status', '==', true)
      );
      
      const querySnapshot = await getDocs(q);
      const batch = [];
      
      querySnapshot.forEach((doc) => {
        batch.push(updateDoc(doc.ref, { status: false }));
      });
      
      // 2. Activar la estrategia seleccionada
      batch.push(updateDoc(doc(this.db, 'configuration-overview', strategyId), { 
        status: true,
        updated_at: Timestamp.now()
      }));
      
      // Ejecutar todas las actualizaciones
      await Promise.all(batch);
    } catch (error) {
      console.error('Error activating strategy:', error);
      throw error;
    }
  }

  /**
   * Actualizar fechas de activación/desactivación de estrategias
   */
  async updateStrategyDates(userId: string, strategyId: string, dateActive?: Date, dateInactive?: Date): Promise<void> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return;
    }

    try {
      const strategyRef = doc(this.db, 'configuration-overview', strategyId);
      const strategyDoc = await getDoc(strategyRef);
      
      if (!strategyDoc.exists()) {
        throw new Error('Strategy not found');
      }

      const currentData = strategyDoc.data();
      const updateData: any = {};

      // Solo actualizar si se proporciona un valor válido
      if (dateActive !== undefined && dateActive !== null) {
        const currentDateActive = currentData['dateActive'] || [];
        const newDateActive = [...currentDateActive, Timestamp.fromDate(dateActive)];
        updateData.dateActive = newDateActive;
        
        // Si se está activando, cambiar status a true
        updateData.status = true;
      }

      // Solo actualizar si se proporciona un valor válido
      if (dateInactive !== undefined && dateInactive !== null) {
        const currentDateInactive = currentData['dateInactive'] || [];
        const newDateInactive = [...currentDateInactive, Timestamp.fromDate(dateInactive)];
        updateData.dateInactive = newDateInactive;
        
        // Si se está desactivando, cambiar status a false
        updateData.status = false;
      }

      // Actualizar timestamp solo si hay cambios
      if (Object.keys(updateData).length > 0) {
        updateData.updated_at = Timestamp.now();
        await updateDoc(strategyRef, updateData);
      }
    } catch (error) {
      console.error('Error updating strategy dates:', error);
      throw error;
    }
  }

  /**
   * Eliminar una estrategia
   */
  async deleteStrategyView(strategyId: string): Promise<void> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return;
    }

    try {
      // 1. Obtener el configurationId del overview
      const strategy = await this.getConfigurationOverview(strategyId);
      if (!strategy) {
        throw new Error('Strategy not found');
      }

      // 2. Eliminar configuration-overview
      await this.deleteConfigurationOverview(strategyId);

      // 3. Eliminar configuration usando configurationId
      if (strategy.configurationId) {
        try {
          const configDocRef = doc(this.db, 'configurations', strategy.configurationId);
          await deleteDoc(configDocRef);
        } catch (error) {
          console.warn('Configuration not found for deletion:', error);
        }
      }
    } catch (error) {
      console.error('Error deleting strategy:', error);
      throw error;
    }
  }

  /**
   * Marcar una estrategia como deleted (soft delete)
   */
  async markStrategyAsDeleted(strategyId: string): Promise<void> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return;
    }

    try {
      // 1. Obtener el configurationId del overview
      const strategy = await this.getConfigurationOverview(strategyId);
      if (!strategy) {
        throw new Error('Strategy not found');
      }

      const currentTimestamp = new Date();

      // 2. Marcar configuration-overview como deleted y agregar dateInactive
      const overviewDocRef = doc(this.db, 'configuration-overview', strategyId);
      const overviewDoc = await getDoc(overviewDocRef);
      
      if (overviewDoc.exists()) {
        const currentData = overviewDoc.data();
        const updateData: any = {
          deleted: true,
          deleted_at: Timestamp.now(),
          updated_at: Timestamp.now(),
          status: false // Marcar como inactiva
        };

        // Agregar dateInactive si la estrategia estaba activa
        if (currentData['status'] === true) {
          const currentDateInactive = currentData['dateInactive'] || [];
          const newDateInactive = [...currentDateInactive, Timestamp.fromDate(currentTimestamp)];
          updateData.dateInactive = newDateInactive;
        }

        await updateDoc(overviewDocRef, updateData);
      }

      // 3. Marcar configuration como deleted usando configurationId
      if (strategy.configurationId) {
        try {
          const configDocRef = doc(this.db, 'configurations', strategy.configurationId);
          await updateDoc(configDocRef, {
            deleted: true,
            deleted_at: Timestamp.now(),
            updated_at: Timestamp.now()
          });
        } catch (error) {
          console.warn('Configuration not found for soft deletion:', error);
        }
      }
    } catch (error) {
      console.error('Error marking strategy as deleted:', error);
      throw error;
    }
  }

  /**
   * Obtener el número total de estrategias de un usuario (solo no eliminadas)
   */
  async getAllLengthConfigurationsOverview(userId: string): Promise<number> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return 0;
    }

    try {
      // Obtener todas las estrategias del usuario
      const overviewQuery = query(
        collection(this.db, 'configuration-overview'),
        where('userId', '==', userId)
      );
      
      const overviewSnapshot = await getDocs(overviewQuery);
      
      let count = 0;
      overviewSnapshot.forEach((doc) => {
        const data = doc.data() as ConfigurationOverview;
        // Solo contar las que no estén marcadas como deleted (deleted !== true)
        // Las que tienen deleted === false o no tienen el campo deleted se cuentan
        if (data.deleted === undefined || data.deleted === false) {
          count++;
        }
      });
      
      return count;
    } catch (error) {
      console.error('Error getting strategies count:', error);
      return 0;
    }
  }

  /**
   * Generar ID único para configuration-overview
   */
  private generateOverviewId(): string {
    return 'overview_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}
