import { Injectable, inject } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { selectUser } from '../features/auth/store/user.selectios';
import { SubscriptionService } from '../shared/services/subscription-service';
import { PlanService } from '../shared/services/planService';
import { UserStatus } from '../features/overview/models/overview';
import { Observable, of, switchMap, catchError } from 'rxjs';
import { Subscription } from '../shared/services/subscription-service';

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

@Injectable({
  providedIn: 'root'
})
export class PlanLimitationsGuard implements CanActivate {
  private subscriptionService = inject(SubscriptionService);
  private planService = inject(PlanService);
  private store = inject(Store);
  private router = inject(Router);

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
   * Check user's plan limitations and return detailed information
   */
  async checkUserLimitations(userId: string): Promise<PlanLimitations> {
    try {
      // Get user's latest subscription
      const subscriptions: Subscription[] = await this.subscriptionService.getAllSubscriptionsByUserId(userId);
  
      
      if (!subscriptions || subscriptions.length === 0) {
        // No subscription found - user needs to purchase a plan
        return {
          maxAccounts: 0,
          maxStrategies: 0,
          planName: 'No Plan',
          isActive: false,
          isBanned: false,
          isCancelled: false,
          needsSubscription: true
        };
      }

      const latestSubscription: Subscription = subscriptions[0];
      
      // Check subscription status
      const isBanned = latestSubscription.status === UserStatus.BANNED;
      const isCancelled = latestSubscription.status === UserStatus.CANCELLED;
      const isActive = latestSubscription.status === UserStatus.PURCHASED || 
                      latestSubscription.status === UserStatus.CREATED || 
                      latestSubscription.status === UserStatus.PROCESSING || 
                      latestSubscription.status === UserStatus.ACTIVE;
      
      if (isBanned || isCancelled || !isActive) {
        return {
          maxAccounts: 0,
          maxStrategies: 0,
          planName: 'Inactive Plan',
          isActive: false,
          isBanned,
          isCancelled,
          needsSubscription: true
        };
      }

      // Get plan details from Firebase
      const plan = await this.planService.getPlanById(latestSubscription.planId);
      
      if (!plan) {
        return {
          maxAccounts: 0,
          maxStrategies: 0,
          planName: 'Unknown Plan',
          isActive: false,
          isBanned: false,
          isCancelled: false,
          needsSubscription: true
        };
      }

      // Extract limitations from plan
      const maxAccounts = plan.tradingAccounts || 1;
      const maxStrategies = plan.strategies || 1;

      return {
        maxAccounts,
        maxStrategies,
        planName: plan.name,
        isActive: true,
        isBanned: false,
        isCancelled: false,
        needsSubscription: false
      };

    } catch (error) {
      console.error('Error checking user limitations:', error);
      return {
        maxAccounts: 0,
        maxStrategies: 0,
        planName: 'Error',
        isActive: false,
        isBanned: false,
        isCancelled: false,
        needsSubscription: true
      };
    }
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
