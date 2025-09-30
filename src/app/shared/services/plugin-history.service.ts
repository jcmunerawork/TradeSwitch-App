import { isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import {
    collection,
    getDocs,
    getFirestore,
    where,
    query,
    onSnapshot,
} from 'firebase/firestore';
import { Observable, from } from 'rxjs';
import { firebaseApp } from '../../firebase/firebase.init';

export interface PluginHistory {
    id: string;
    isActive: boolean;
    updatedOn: string;
    tokenNeeded: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class PluginHistoryService {

    private isBrowser: boolean;
    private db: ReturnType<typeof getFirestore> | null = null;

    constructor(
        @Inject(PLATFORM_ID) private platformId: Object,
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
            const ref = collection(this.db, 'plugin_history');
            const q = await getDocs(query(ref, where('id', '==', userId)));

            if (q.empty) {
                console.log('⚠️ No se encontraron planes en la colección "plugin_history"');
                return [];
            }

            const pluginHistory = q.docs.map((doc) => {
                const data = doc.data();
                return { id: doc.id, ...data };
            });

            return pluginHistory as PluginHistory[];

        } catch (error) {
            console.error('Error getting plugin usage history:', error);
            return [];
        }

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
            const pluginHistoryRef = collection(this.db!, 'plugin_history');
            const q = query(pluginHistoryRef, where('id', '==', userId));
            
            const unsubscribe = onSnapshot(q, 
                (snapshot) => {
                    const pluginHistory = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    } as PluginHistory));
                    
                    console.log('Plugin history updated (real-time) for user:', userId, pluginHistory);
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