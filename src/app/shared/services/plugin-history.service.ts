import { isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { Observable, from, interval, switchMap, startWith, catchError, of, share } from 'rxjs';
import { TimezoneService } from './timezone.service';
import { BackendApiService } from '../../core/services/backend-api.service';
import { getAuth } from 'firebase/auth';

/**
 * Interface for plugin history data.
 *
 * @interface PluginHistory
 */
export interface PluginHistory {
    id: string;
    isActive: boolean;
    updatedOn: string;
    tokenNeeded: boolean;
    dateActive: string[];
    dateInactive: string[];
}

/**
 * Service for managing plugin activation history.
 *
 * This service tracks when the trading plugin was activated and deactivated
 * for users. It's used to determine if trades were executed while the plugin
 * was active, which is essential for strategy adherence calculations.
 *
 * Features:
 * - Get plugin usage history for a user
 * - Determine if plugin is currently active based on dates
 * - Real-time listener for plugin history changes
 * - Timezone-aware date comparisons
 *
 * Plugin Status Logic:
 * - If `dateActive` has more elements than `dateInactive`: plugin is active
 * - If same count: compare last dates (last active > last inactive = active)
 * - Uses UTC conversion for accurate date comparisons
 *
 * Data Structure:
 * - Stored in: `plugin_history/plugin_{userId}`
 * - Contains: activation/deactivation date arrays
 *
 * Relations:
 * - Used by CalendarComponent for strategy adherence checks
 * - Used by ReportComponent for determining if trades followed strategies
 * - TimezoneService: For accurate date comparisons
 *
 * @service
 * @injectable
 * @providedIn root
 */
@Injectable({
    providedIn: 'root'
})
export class PluginHistoryService {

    private isBrowser: boolean;
    // Cachear el Observable por userId para compartir entre suscriptores y evitar múltiples intervalos
    private realtimeObservables: Map<string, Observable<PluginHistory[]>> = new Map();

    constructor(
        @Inject(PLATFORM_ID) private platformId: Object,
        private timezoneService: TimezoneService,
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

    async getPluginUsageHistory(userId: string): Promise<PluginHistory[]> {
        if (!this.isBrowser) {
            console.warn('Not available in SSR');
            return [];
        }

        try {
            const idToken = await this.getIdToken();
            const response = await this.backendApi.getPluginHistory(userId, idToken);
            
            if (response.success && response.data?.pluginHistory) {
                return [response.data.pluginHistory] as PluginHistory[];
            }
            return [];
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
     * - Retorna un Observable que emite cambios periódicamente (polling cada 5 segundos)
     * - Filtra por userId específico
     * - El componente se suscribe y recibe actualizaciones automáticas
     * - Maneja errores y limpieza de recursos
     * - COMPARTE el Observable entre múltiples suscriptores para evitar múltiples intervalos
     * 
     * Nota: Como no hay WebSockets, usamos polling para simular tiempo real
     */
    getPluginHistoryRealtime(userId: string): Observable<PluginHistory[]> {
        if (!this.isBrowser) {
            console.warn('Not available in SSR');
            return from([]);
        }

        // Si ya existe un Observable para este userId, reutilizarlo para evitar múltiples intervalos
        if (this.realtimeObservables.has(userId)) {
            return this.realtimeObservables.get(userId)!;
        }

        // Crear un nuevo Observable y compartirlo entre múltiples suscriptores
        const observable = interval(5000).pipe(
            startWith(0), // Emitir inmediatamente al suscribirse
            switchMap(() => {
                return from(this.getIdToken()).pipe(
                    switchMap(idToken => {
                        return from(this.backendApi.getPluginHistory(userId, idToken));
                    }),
                    switchMap(response => {
                        if (response.success && response.data?.pluginHistory) {
                            return of([response.data.pluginHistory] as PluginHistory[]);
                        }
                        return of([]);
                    }),
                    catchError(error => {
                        console.error('Error in plugin history polling:', error);
                        return of([]);
                    })
                );
            }),
            share() // Compartir el Observable entre múltiples suscriptores (evita múltiples intervalos)
        );

        // Guardar el Observable en el cache para reutilizarlo
        this.realtimeObservables.set(userId, observable);
        return observable;
    }

}