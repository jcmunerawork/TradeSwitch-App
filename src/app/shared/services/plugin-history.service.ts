import { isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import {
    collection,
    getDocs,
    getFirestore,
    where,
    query,
    onSnapshot,
    doc,
    getDoc,
} from 'firebase/firestore';
import { Observable, from } from 'rxjs';
import { firebaseApp } from '../../firebase/firebase.init';
import { TimezoneService } from './timezone.service';

export interface PluginHistory {
    id: string;
    isActive: boolean;
    updatedOn: string;
    tokenNeeded: boolean;
    dateActive: string[];
    dateInactive: string[];
}

@Injectable({
    providedIn: 'root'
})
export class PluginHistoryService {

    private isBrowser: boolean;
    private db: ReturnType<typeof getFirestore> | null = null;

    constructor(
        @Inject(PLATFORM_ID) private platformId: Object,
        private timezoneService: TimezoneService
    ) {
        this.isBrowser = isPlatformBrowser(this.platformId);
        if (this.isBrowser) {
            this.db = getFirestore(firebaseApp);
        }
    }

    async getPluginUsageHistory(userId: string): Promise<PluginHistory[]> {
        if (!this.db) {
            console.warn('Firestore not available in SSR');
            return [];
        }

        try {
            // NUEVA LÓGICA: Buscar por document ID = plugin_{userId}
            const pluginDocId = `plugin_${userId}`;
            const docRef = doc(this.db, 'plugin_history', pluginDocId);
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists()) {
                return [];
            }

            const data = docSnap.data();
            const pluginHistory = { id: docSnap.id, ...data };

            return [pluginHistory] as PluginHistory[];

        } catch (error) {
            console.error('Error getting plugin usage history:', error);
            return [];
        }

    }

    /**
     * MÉTODO NUEVO: Determinar si el plugin está activo basándose en las fechas
     * LÓGICA MEJORADA CON ZONA HORARIA:
     * - Si dateActive tiene más elementos que dateInactive: está activo
     * - Si tienen la misma cantidad: comparar la última fecha de cada array
     * - Si la última fecha de dateActive > última fecha de dateInactive: está activo
     * - Si la última fecha de dateInactive > última fecha de dateActive: está inactivo
     * - Usa conversión UTC para comparaciones precisas
     */
    isPluginActiveByDates(pluginHistory: PluginHistory): boolean {
        if (!pluginHistory.dateActive || !pluginHistory.dateInactive) {
            // Fallback al campo isActive si no hay fechas
            return pluginHistory.isActive;
        }

        const activeDates = pluginHistory.dateActive;
        const inactiveDates = pluginHistory.dateInactive;

        // Si dateActive tiene más elementos que dateInactive, está activo
        if (activeDates.length > inactiveDates.length) {
            return true;
        }

        // Si tienen la misma cantidad, comparar las últimas fechas
        if (activeDates.length === inactiveDates.length) {
            if (activeDates.length === 0) {
                return false; // No hay fechas, asumir inactivo
            }

            // MEJORA: Usar conversión UTC para comparaciones precisas
            const lastActiveDate = this.timezoneService.convertToUTC(activeDates[activeDates.length - 1]);
            const lastInactiveDate = this.timezoneService.convertToUTC(inactiveDates[inactiveDates.length - 1]);


            // Si la última fecha de active es mayor que la de inactive, está activo
            return lastActiveDate > lastInactiveDate;
        }

        // Si dateInactive tiene más elementos que dateActive, está inactivo
        return false;
    }

    /**
     * MÉTODO NUEVO: Listener en tiempo real para plugin history
     * FLUJO DINÁMICO:
     * - Retorna un Observable que emite cambios en tiempo real
     * - Filtra por userId específico
     * - El componente se suscribe y recibe actualizaciones automáticas
     * - Maneja errores y limpieza de recursos
     */
    getPluginHistoryRealtime(userId: string): Observable<PluginHistory[]> {
        if (!this.db) {
            console.warn('Firestore not available in SSR');
            return from([]);
        }

        return new Observable<PluginHistory[]>(subscriber => {
            // NUEVA LÓGICA: Buscar por document ID = plugin_{userId}
            const pluginDocId = `plugin_${userId}`;
            const pluginHistoryRef = collection(this.db!, 'plugin_history');
            const q = query(pluginHistoryRef, where('__name__', '==', pluginDocId));
            
            const unsubscribe = onSnapshot(q, 
                (snapshot) => {
                    const pluginHistory = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    } as PluginHistory));
                    
                    subscriber.next(pluginHistory);
                }, 
                (error) => {
                    console.error('Error in plugin history listener:', error);
                    subscriber.error(error);
                }
            );

            // Retornar función de limpieza
            return () => {
                unsubscribe();
            };
        });
    }

}