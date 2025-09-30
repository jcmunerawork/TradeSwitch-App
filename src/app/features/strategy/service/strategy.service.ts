import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, deleteDoc, updateDoc, orderBy, limit, addDoc } from 'firebase/firestore';
import { MaxDailyTradesConfig, StrategyState, ConfigurationOverview } from '../models/strategy.model';
import { firebaseApp } from '../../../firebase/firebase.init';
import { isPlatformBrowser } from '@angular/common';
import { Timestamp } from 'firebase/firestore';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private isBrowser: boolean;
  private db: ReturnType<typeof getFirestore> | null = null;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (this.isBrowser) {
      const { firebaseApp } = require('../../../firebase/firebase.init.ts');
      this.db = getFirestore(firebaseApp);
    }
  }

  // ===== CONFIGURATION-OVERVIEW (colección de metadatos) =====
  
  // Crear configuration-overview (solo metadatos)
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

  // Obtener configuration-overview por ID (solo metadatos)
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

  // Actualizar configuration-overview
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

  // Eliminar configuration-overview
  async deleteConfigurationOverview(overviewId: string): Promise<void> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return;
    }

    const docRef = doc(this.db, 'configuration-overview', overviewId);
    await deleteDoc(docRef);
  }

  // ===== CONFIGURATIONS (colección de reglas) =====
  
  // Crear configuración (solo reglas + IDs)
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

  // Obtener configuración por userId
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

  // Actualizar configuración
  async updateConfiguration(userId: string, configuration: StrategyState): Promise<void> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return;
    }

    await updateDoc(doc(this.db, 'configurations', userId), configuration as any);
  }

  // ===== MÉTODOS INDIVIDUALES NUEVOS =====
  
  // Crear solo configuration (sin userId ni configurationOverviewId)
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

  // Crear configuration-overview con configurationId
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
        configurationId
      };

      const docRef = await addDoc(collection(this.db, 'configuration-overview'), overviewData as any);
      return docRef.id;
    } catch (error) {
      console.error('Error creating configuration overview:', error);
      throw error;
    }
  }

  // Actualizar configuration por ID
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

  // ===== MÉTODOS COMBINADOS =====
  
  // Crear estrategia completa (configurations + configuration-overview)
  async createStrategyView(userId: string, name: string, configuration: StrategyState, shouldBeActive: boolean = false): Promise<string> {
    // 1. Crear configuration primero para obtener el ID
    const configurationId = await this.createConfigurationOnly(configuration);
    
    // 2. Crear configuration-overview con el configurationId
    const overviewId = await this.createConfigurationOverviewWithConfigId(userId, name, configurationId, shouldBeActive);
    
    return overviewId;
  }

  // Obtener estrategia completa (configuration-overview + configurations)
  async getStrategyView(overviewId: string): Promise<{ overview: ConfigurationOverview; configuration: StrategyState } | null> {
    
    // 1. Primero obtener configuration-overview
    const overview = await this.getConfigurationOverview(overviewId);
    
    if (!overview) {
      return null;
    }

    // 2. Luego obtener configuration usando el configurationId
    const configuration = await this.getConfigurationById(overview.configurationId);
    
    if (!configuration) {
      return null;
    }

    return { overview, configuration };
  }

  // Obtener configuración por ID
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

  // Obtener configuración por configurationOverviewId (método legacy para compatibilidad)
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

  // Actualizar estrategia completa
  async updateStrategyView(overviewId: string, updates: { name?: string; configuration?: StrategyState; userId?: string }): Promise<void> {
    // 1. Primero actualizar configuration-overview si hay cambios de nombre
    if (updates.name) {
      await this.updateConfigurationOverview(overviewId, { name: updates.name });
    }
    
    // 2. Luego actualizar configuration si hay cambios de reglas
    if (updates.configuration) {
      // Obtener el configurationId del overview
      const overview = await this.getConfigurationOverview(overviewId);
      if (overview && overview.configurationId) {
        await this.updateConfigurationById(overview.configurationId, updates.configuration);
      }
    }
  }

  // Obtener todas las estrategias de un usuario
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
      
      // Ordenar manualmente por updated_at descendente
      strategies.sort((a, b) => {
        const dateA = a.updated_at.toDate();
        const dateB = b.updated_at.toDate();
        return dateB.getTime() - dateA.getTime();
      });
      
      return strategies;
    } catch (error) {
      console.error('❌ Error getting user strategies:', error);
      return [];
    }
  }

  // Obtener configuración activa (método legacy para compatibilidad)
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

  // Actualizar fechas de activación/desactivación de estrategias
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

  // Eliminar una estrategia
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

  // Generar ID único para configuration-overview
  private generateOverviewId(): string {
    return 'overview_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}