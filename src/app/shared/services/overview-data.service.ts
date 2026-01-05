import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BackendApiService } from '../../core/services/backend-api.service';
import { getAuth } from 'firebase/auth';

/**
 * Service for fetching overview dashboard data.
 *
 * This service provides methods to fetch data for the admin overview dashboard,
 * including users, subscriptions, monthly reports, strategies, and accounts.
 * It supports pagination for large datasets.
 *
 * Features:
 * - Get overview subscription data (from backend API)
 * - Get users data (with pagination from backend API)
 * - Get user accounts (with pagination)
 * - Get monthly reports data
 * - Get configuration overview data
 * - Get accounts data
 *
 * Backend Integration:
 * - GET /api/v1/admin/overview/users: Cursor-based pagination, orders by subscription_date desc
 * - GET /api/v1/admin/overview/subscriptions: Returns all subscriptions with userId and id
 * - Backend converts Firestore timestamps to numbers automatically
 *
 * Pagination:
 * - Supports cursor-based pagination via startAfter parameter
 * - Backend orders users by subscription_date (descending, fallback: lastUpdated descending)
 * - Orders accounts by accountID (descending)
 *
 * Relations:
 * - Used by OverviewService for data aggregation
 * - Used by OverviewComponent for dashboard display
 * - Uses BackendApiService for API calls
 *
 * @service
 * @injectable
 * @providedIn root
 */
@Injectable({
  providedIn: 'root'
})
export class OverviewDataService {
  private isBrowser: boolean;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
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

  /**
   * Get overview subscription data
   * Obtiene todas las suscripciones desde el backend
   */
  async getOverviewSubscriptionData() {
    if (!this.isBrowser) {
      console.warn('Not available in SSR');
      return null;
    }

    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.getOverviewSubscriptions(idToken);
      
      if (response.success && response.data?.subscriptions) {
        // El backend ya incluye el id y userId en cada suscripción
        // Los timestamps ya están convertidos a números
        const docs = response.data.subscriptions.map((sub: any, index: number) => ({
          id: sub.id || `sub_${index}`,
          data: () => sub
        }));
        // Retornar formato similar a Firestore snapshot para compatibilidad
        return {
          docs,
          empty: docs.length === 0
        };
      }
      
      // Si no hay datos, retornar estructura vacía
      return {
        docs: [],
        empty: true
      };
    } catch (error) {
      console.error('Error getting overview subscription data:', error);
      return null;
    }
  }

  /**
   * Get users data for overview
   * Obtiene todos los usuarios con paginación desde el backend
   * El backend ordena por subscription_date desc (fallback: lastUpdated desc)
   */
  async getUsersData() {
    if (!this.isBrowser) {
      console.warn('Not available in SSR');
      return null;
    }

    try {
      const idToken = await this.getIdToken();
      // Obtener primera página con límite grande para obtener todos los usuarios
      const response = await this.backendApi.getOverviewUsers(1, 1000, undefined, idToken);
      
      if (response.success && response.data?.users) {
        // El backend ya incluye todos los campos del usuario de Firebase
        // y el id del documento
        const docs = response.data.users.map((user: any) => ({
          id: user.id,
          data: () => user
        }));
        // Retornar formato similar a Firestore snapshot para compatibilidad
        return {
          docs,
          empty: docs.length === 0
        };
      }
      
      // Si no hay datos, retornar estructura vacía
      return {
        docs: [],
        empty: true
      };
    } catch (error) {
      console.error('Error getting users data:', error);
      return null;
    }
  }

  /**
   * Paginación de usuarios para la tabla de Overview
   * El backend maneja la paginación cursor-based con startAfter
   * Ordena por subscription_date desc (fallback: lastUpdated desc)
   */
  async getUsersPage(pageSize: number, startAfterDocId?: string) {
    if (!this.isBrowser) {
      console.warn('Not available in SSR');
      return { docs: [], lastDocId: undefined };
    }

    try {
      const idToken = await this.getIdToken();
      // El backend maneja la paginación cursor-based
      // page siempre es 1 para cursor-based, el backend usa startAfter para la siguiente página
      const page = 1;
      const response = await this.backendApi.getOverviewUsers(page, pageSize, startAfterDocId, idToken);
      
      if (response.success && response.data) {
        const docs = response.data.users.map((user: any) => ({
          id: user.id,
          data: () => user
        }));
        
        // El backend retorna lastDocId en pagination para la siguiente página
        return {
          docs,
          lastDocId: response.data.pagination?.lastDocId,
          hasMore: response.data.pagination?.hasMore || false,
          total: response.data.pagination?.total || 0
        };
      }
      return { docs: [], lastDocId: undefined, hasMore: false, total: 0 };
    } catch (error) {
      console.error('Error getting users page:', error);
      return { docs: [], lastDocId: undefined, hasMore: false, total: 0 };
    }
  }

  /**
   * Paginación de cuentas por usuario para la tabla (si se requiere desplegar cuentas)
   * Nota: Este método aún no tiene endpoint específico en el backend
   * Por ahora, filtra las cuentas del usuario desde todos los accounts
   */
  async getUserAccountsPage(userId: string, pageSize: number, startAfterAccountId?: string) {
    if (!this.isBrowser) {
      console.warn('Not available in SSR');
      return { docs: [], lastDocId: undefined };
    }

    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.getOverviewAccounts(idToken);
      
      if (response.success && response.data?.accounts) {
        // Filtrar por userId y ordenar por accountID desc
        const userAccounts = response.data.accounts
          .filter((account: any) => account.userId === userId)
          .sort((a: any, b: any) => {
            const aId = parseInt(a.accountID || '0', 10);
            const bId = parseInt(b.accountID || '0', 10);
            return bId - aId;
          });
        
        // Aplicar paginación manual
        let startIndex = 0;
        if (startAfterAccountId) {
          const index = userAccounts.findIndex((acc: any) => acc.id === startAfterAccountId);
          if (index >= 0) {
            startIndex = index + 1;
          }
        }
        
        const paginatedAccounts = userAccounts.slice(startIndex, startIndex + pageSize);
        const docs = paginatedAccounts.map((account: any) => ({
          id: account.id,
          data: () => account
        }));
        
        return {
          docs,
          lastDocId: paginatedAccounts.length > 0 ? paginatedAccounts[paginatedAccounts.length - 1].id : undefined
        };
      }
      return { docs: [], lastDocId: undefined };
    } catch (error) {
      console.error('Error getting user accounts page:', error);
      return { docs: [], lastDocId: undefined };
    }
  }

  /**
   * Get monthly reports data
   */
  async getMonthlyReportsData() {
    if (!this.isBrowser) {
      console.warn('Not available in SSR');
      return null;
    }

    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.getOverviewMonthlyReports(idToken);
      
      if (response.success && response.data?.monthlyReports) {
        const docs = response.data.monthlyReports.map((report: any) => ({
          id: report.id,
          data: () => report
        }));
        // Retornar formato similar a Firestore snapshot para compatibilidad
        return {
          docs,
          empty: docs.length === 0
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting monthly reports data:', error);
      return null;
    }
  }

  /**
   * Get configuration overview data
   */
  async getConfigurationOverviewData() {
    if (!this.isBrowser) {
      console.warn('Not available in SSR');
      return null;
    }

    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.getOverviewStrategies(idToken);
      
      if (response.success && response.data?.strategies) {
        const docs = response.data.strategies.map((strategy: any) => ({
          id: strategy.id,
          data: () => strategy
        }));
        // Retornar formato similar a Firestore snapshot para compatibilidad
        return {
          docs,
          empty: docs.length === 0
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting configuration overview data:', error);
      return null;
    }
  }

  /**
   * Get accounts data
   */
  async getAccountsData() {
    if (!this.isBrowser) {
      console.warn('Not available in SSR');
      return null;
    }

    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.getOverviewAccounts(idToken);
      
      if (response.success && response.data?.accounts) {
        const docs = response.data.accounts.map((account: any) => ({
          id: account.id,
          data: () => account
        }));
        // Retornar formato similar a Firestore snapshot para compatibilidad
        return {
          docs,
          empty: docs.length === 0
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting accounts data:', error);
      return null;
    }
  }
}
