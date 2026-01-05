import { Injectable, inject } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { selectUser } from '../../features/auth/store/user.selectios';
import { BackendApiService } from '../services/backend-api.service';
import { UserStatus } from '../../features/overview/models/overview';
import { Observable, of, switchMap, catchError } from 'rxjs';
import { AppContextService } from '../../shared/context';
import { getAuth } from 'firebase/auth';

export interface PlanLimitations {
  maxAccounts: number;
  maxStrategies: number;
  planName: string;
  isActive: boolean;
  isBanned: boolean;
  isCancelled: boolean;
  needsSubscription: boolean;
}

export interface LimitationCheck {
  canCreate: boolean;
  reason?: string;
  showUpgradeModal: boolean;
  upgradeMessage: string;
  showBlockedModal: boolean;
  blockedMessage: string;
}

export interface ModalData {
  showModal: boolean;
  modalType: 'upgrade' | 'blocked';
  title: string;
  message: string;
  primaryButtonText: string;
  secondaryButtonText?: string;
  onPrimaryAction: () => void;
  onSecondaryAction?: () => void;
}

/**
 * Guard and service for checking user plan limitations and feature access.
 *
 * This guard/service provides comprehensive plan limitation checking for features
 * like account creation, strategy creation, and report access. It validates
 * subscription status, plan limits, and provides modal data for blocked features.
 *
 * Features:
 * - Route guard for plan-limited features
 * - Check account creation limits
 * - Check strategy creation limits
 * - Check report access
 * - Validate subscription status (active, banned, cancelled)
 * - Generate modal data for upgrade/blocked scenarios
 * - Integration with AppContextService for plan data (used as fallback only)
 *
 * Plan Validation Flow:
 * 1. Uses backend API endpoint: GET /api/v1/users/:userId/plan
 *    - Backend obtains the user's latest active subscription (or most recent if none active)
 *    - Extracts planId from subscription
 *    - Searches for plan in 'plans' collection using planId
 *    - Returns complete plan with limits (strategies, tradingAccounts)
 *    - Returns null if user has no subscription (defaults to Free plan)
 * 2. If plan is null, user gets Free plan (1 account, 1 strategy)
 * 3. AppContext is only used as fallback in case of errors
 *
 * Plan Status Validation:
 * - Active: Backend returns a valid plan (subscription already validated)
 * - Free: User has no subscription or plan is null (defaults to Free)
 * - Needs Subscription: Only used in fallback scenarios
 *
 * Relations:
 * - BackendApiService: Gets user plan directly from backend API
 * - AppContextService: Accesses cached plan data (fallback only)
 * - Store (NgRx): Gets current user
 * - Router: Navigation for upgrade flows
 *
 * @guard
 * @service
 * @injectable
 */
@Injectable({
  providedIn: 'root'
})
export class PlanLimitationsGuard implements CanActivate {
  private backendApi = inject(BackendApiService);
  private store = inject(Store);
  private router = inject(Router);
  private appContext = inject(AppContextService);
  
  // Cache para evitar peticiones duplicadas
  private planCache: Map<string, { data: PlanLimitations; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 2000; // 2 segundos de caché
  private pendingRequests: Map<string, Promise<PlanLimitations>> = new Map(); // Evitar peticiones simultáneas

  canActivate(): Observable<boolean> {
    return this.store.select(selectUser).pipe(
      switchMap(async (userState) => {
        const user = userState?.user;
        if (!user?.id) {
          return false;
        }
        const limitations = await this.checkUserLimitations(user.id);
        return limitations.isActive && !limitations.needsSubscription;
      }),
      catchError(() => of(false))
    );
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
   * Check user's plan limitations and return detailed information
   * 
   * Usa el endpoint GET /api/v1/users/:userId/plan que:
   * - Obtiene la última suscripción activa del usuario
   * - Extrae el planId de la suscripción
   * - Busca el plan en la colección plans
   * - Retorna el plan completo con límites (strategies, tradingAccounts)
   * - Retorna null si el usuario no tiene suscripción (plan Free por defecto)
   */
  async checkUserLimitations(userId: string): Promise<PlanLimitations> {
    // Verificar si hay una petición pendiente para este usuario
    const pendingRequest = this.pendingRequests.get(userId);
    if (pendingRequest) {
      return pendingRequest;
    }

    // Verificar caché
    const cached = this.planCache.get(userId);
    const now = Date.now();
    if (cached && (now - cached.timestamp) < this.CACHE_TTL) {
      return cached.data;
    }
    
    // Crear promesa y guardarla para evitar peticiones duplicadas
    const requestPromise = (async () => {
      try {
        // Obtener token de autenticación
        const idToken = await this.getIdToken();
        
        // Usar el nuevo endpoint que retorna directamente el plan del usuario
        const response = await this.backendApi.getUserPlan(userId, idToken);
      
      if (!response.success) {
        return {
          maxAccounts: 1,
          maxStrategies: 1,
          planName: 'Free',
          isActive: true,
          isBanned: false,
          isCancelled: false,
          needsSubscription: false
        };
      }

      // Si no hay plan (plan es null), el usuario tiene plan Free por defecto
      if (!response.data?.plan) {
        return {
          maxAccounts: 1,
          maxStrategies: 1,
          planName: 'Free',
          isActive: true,
          isBanned: false,
          isCancelled: false,
          needsSubscription: false
        };
      }

      const plan = response.data.plan;
      
      // Extraer limitaciones del plan
      const maxAccounts = plan.tradingAccounts || 1;
      const maxStrategies = plan.strategies || 1;

      // El plan siempre está activo si el backend lo retorna (ya validó la suscripción)
      const limitations: PlanLimitations = {
        maxAccounts,
        maxStrategies,
        planName: plan.name,
        isActive: true,
        isBanned: false,
        isCancelled: false,
        needsSubscription: false
      };

      // Guardar en caché
      this.planCache.set(userId, {
        data: limitations,
        timestamp: now
      });

      return limitations;
      } catch (error) {
        console.error('❌ PlanLimitationsGuard: Error checking user limitations:', error);
        
        // En caso de error, intentar usar el contexto como fallback
        const ctxPlan = this.appContext.userPlan();
        if (ctxPlan) {
          const isBanned = (ctxPlan as any).status === UserStatus.BANNED || ctxPlan.isActive === false;
          const isCancelled = (ctxPlan as any).status === UserStatus.CANCELLED && ctxPlan.planName === 'Free';
          const isActive = ctxPlan.isActive && !isBanned;
          const fallbackLimitations: PlanLimitations = {
            maxAccounts: ctxPlan.maxAccounts,
            maxStrategies: ctxPlan.maxStrategies,
            planName: ctxPlan.planName,
            isActive,
            isBanned,
            isCancelled,
            needsSubscription: !isActive && !isCancelled && !isBanned
          };
          
          // Guardar en caché incluso el fallback
          this.planCache.set(userId, {
            data: fallbackLimitations,
            timestamp: now
          });
          
          return fallbackLimitations;
        }
        
        // Si no hay contexto, retornar plan Free por defecto (no error)
        const freePlanLimitations: PlanLimitations = {
          maxAccounts: 1,
          maxStrategies: 1,
          planName: 'Free',
          isActive: true,
          isBanned: false,
          isCancelled: false,
          needsSubscription: false
        };

        // Guardar en caché incluso el plan Free
        this.planCache.set(userId, {
          data: freePlanLimitations,
          timestamp: now
        });

        return freePlanLimitations;
      } finally {
        // Limpiar petición pendiente
        this.pendingRequests.delete(userId);
      }
    })();

    // Guardar la promesa para evitar peticiones duplicadas
    this.pendingRequests.set(userId, requestPromise);
    
    return requestPromise;
  }

  /**
   * Check if user can create accounts
   */
  async checkAccountCreation(userId: string, currentAccountCount: number): Promise<LimitationCheck> {
    const limitations = await this.checkUserLimitations(userId);
    
    // If user needs subscription or is banned/cancelled
    if (limitations.needsSubscription || limitations.isBanned || limitations.isCancelled) {
      return {
        canCreate: false,
        showBlockedModal: true,
        blockedMessage: this.getBlockedMessage(limitations),
        showUpgradeModal: false,
        upgradeMessage: ''
      };
    }

    // Check if user has reached account limit
    if (currentAccountCount >= limitations.maxAccounts) {
      return {
        canCreate: false,
        showUpgradeModal: true,
        upgradeMessage: `You've reached the account limit for your ${limitations.planName} plan. Move to a higher plan and keep growing your account.`,
        showBlockedModal: false,
        blockedMessage: ''
      };
    }

    return {
      canCreate: true,
      showUpgradeModal: false,
      upgradeMessage: '',
      showBlockedModal: false,
      blockedMessage: ''
    };
  }

  /**
   * Check if user can create strategies
   */
  async checkStrategyCreation(userId: string, currentStrategyCount: number): Promise<LimitationCheck> {
    const limitations = await this.checkUserLimitations(userId);
    
    // If user needs subscription or is banned/cancelled
    if (limitations.needsSubscription || limitations.isBanned || limitations.isCancelled) {
      return {
        canCreate: false,
        showBlockedModal: true,
        blockedMessage: this.getBlockedMessage(limitations),
        showUpgradeModal: false,
        upgradeMessage: ''
      };
    }

    // Check if user has reached strategy limit
    if (currentStrategyCount >= limitations.maxStrategies) {
      return {
        canCreate: false,
        showUpgradeModal: true,
        upgradeMessage: `You've reached the strategy limit for your ${limitations.planName} plan. Move to a higher plan and keep growing your account.`,
        showBlockedModal: false,
        blockedMessage: ''
      };
    }

    return {
      canCreate: true,
      showUpgradeModal: false,
      upgradeMessage: '',
      showBlockedModal: false,
      blockedMessage: ''
    };
  }

  /**
   * Get appropriate blocked message based on user status
   */
  private getBlockedMessage(limitations: PlanLimitations): string {
    if (limitations.isBanned) {
      return 'Your account has been banned. Please contact support for assistance.';
    }
    
    if (limitations.isCancelled) {
      return 'Your subscription has been cancelled. Please purchase a plan to access this functionality.';
    }
    
    if (limitations.needsSubscription) {
      return 'You need to purchase a plan to access this functionality.';
    }
    
    return 'Access denied. Please contact support for assistance.';
  }

  /**
   * Navigate to account page for plan management
   */
  navigateToAccount(): void {
    this.router.navigate(['/account']);
  }

  /**
   * Navigate to signup page for new users
   */
  navigateToSignup(): void {
    this.router.navigate(['/signup']);
  }

  /**
   * Check if user can access a specific feature and return modal data if blocked
   */
  async checkFeatureAccess(
    userId: string, 
    feature: 'accounts' | 'strategies' | 'reports', 
    currentCount?: number
  ): Promise<{ canAccess: boolean; modalData?: ModalData }> {
    try {
      const limitations = await this.checkUserLimitations(userId);
      
      // If user needs subscription or is banned/cancelled
      if (limitations.needsSubscription || limitations.isBanned || limitations.isCancelled) {
        return {
          canAccess: false,
          modalData: {
            showModal: true,
            modalType: 'blocked',
            title: 'Access Restricted',
            message: this.getBlockedMessage(limitations),
            primaryButtonText: 'Go to Account',
            onPrimaryAction: () => this.navigateToAccount()
          }
        };
      }

      // Check specific feature limits
      let maxAllowed = 0;
      let featureName = '';
      
      switch (feature) {
        case 'accounts':
          maxAllowed = limitations.maxAccounts;
          featureName = 'trading accounts';
          break;
        case 'strategies':
          maxAllowed = limitations.maxStrategies;
          featureName = 'strategies';
          break;
        case 'reports':
          // Reports don't have a count limit, but need active subscription
          return { canAccess: true };
      }

      // If user has reached the limit
      if (currentCount !== undefined && currentCount >= maxAllowed) {
        // Check if user is on the maximum plan (Pro plan with max limits)
        const isProPlanWithMaxLimits = limitations.planName.toLowerCase().includes('pro') && 
                                       ((feature === 'strategies' && maxAllowed === 8) || 
                                        (feature === 'accounts' && maxAllowed === 10));
        
        // If user is already on the maximum plan, don't show upgrade modal
        if (isProPlanWithMaxLimits) {
          return {
            canAccess: false
          };
        }
        
        // For other plans, show upgrade modal
        return {
          canAccess: false,
          modalData: {
            showModal: true,
            modalType: 'upgrade',
            title: 'Upgrade Required',
            message: `You've reached the ${featureName} limit for your ${limitations.planName} plan. Move to a higher plan and keep growing your account.`,
            primaryButtonText: 'Upgrade Plan',
            secondaryButtonText: 'Cancel',
            onPrimaryAction: () => this.navigateToAccount(),
            onSecondaryAction: () => {}
          }
        };
      }

      return { canAccess: true };

    } catch (error) {
      console.error('Error checking feature access:', error);
      return {
        canAccess: false,
        modalData: {
          showModal: true,
          modalType: 'blocked',
          title: 'Access Restricted',
          message: 'An error occurred while checking your access. Please try again.',
          primaryButtonText: 'Go to Account',
          onPrimaryAction: () => this.navigateToAccount()
        }
      };
    }
  }

  /**
   * Check if user can create accounts and return modal data if blocked
   */
  async checkAccountCreationWithModal(userId: string, currentAccountCount: number): Promise<{ canCreate: boolean; modalData?: ModalData }> {
    const result = await this.checkFeatureAccess(userId, 'accounts', currentAccountCount);
    return {
      canCreate: result.canAccess,
      modalData: result.modalData
    };
  }

  /**
   * Check if user can create strategies and return modal data if blocked
   */
  async checkStrategyCreationWithModal(userId: string, currentStrategyCount: number): Promise<{ canCreate: boolean; modalData?: ModalData }> {
    const result = await this.checkFeatureAccess(userId, 'strategies', currentStrategyCount);
    return {
      canCreate: result.canAccess,
      modalData: result.modalData
    };
  }

  /**
   * Check if user can access reports and return modal data if blocked
   */
  async checkReportAccessWithModal(userId: string): Promise<{ canAccess: boolean; modalData?: ModalData }> {
    return this.checkFeatureAccess(userId, 'reports');
  }
}
