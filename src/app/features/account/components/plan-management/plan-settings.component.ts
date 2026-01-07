import { Component, Input, OnInit, inject } from '@angular/core';

import { CommonModule } from '@angular/common';
import { Store } from '@ngrx/store';
import { SettingsService } from '../../../strategy/service/strategy.service';
import { ReportService } from '../../../report/service/report.service';
import { User } from '../../../overview/models/overview';
import { PlanCard, PlanDetails } from '../../models/account-settings';
import { PLANS } from '../../mocks/account-mocks';
import { Subscription, SubscriptionService } from '../../../../shared/services/subscription-service';
import { PlanService } from '../../../../shared/services/planService';
import { AuthService } from '../../../auth/service/authService';
import { Plan } from '../../../../shared/services/planService';
import { selectUser } from '../../../auth/store/user.selectios';
import { SubscriptionProcessingComponent } from '../../../../shared/components/subscription-processing/subscription-processing.component';
import { OrderSummaryComponent } from '../../../../shared/components/order-summary/order-summary.component';
import { UserStatus } from '../../../overview/models/overview';
import { AppContextService } from '../../../../shared/context/context';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { StripeLoaderPopupComponent } from '../../../../shared/pop-ups/stripe-loader-popup/stripe-loader-popup.component';
import { ConfigService } from '../../../../core/services/config.service';
import { BackendApiService } from '../../../../core/services/backend-api.service';
import { ToastNotificationService } from '../../../../shared/services/toast-notification.service';
import { ToastContainerComponent } from '../../../../shared/components/toast-container/toast-container.component';

/**
 * Component for managing user subscription plans.
 * 
 * This component allows the user to:
 * - View their current plan and renewal details
 * - Compare and switch between different available plans
 * - Validate downgrades before switching to a lower plan
 * - Manage their subscription through the Stripe portal
 * - Cancel their current plan
 * 
 * Related to:
 * - AccountComponent: Receives planDetails as Input
 * - SubscriptionService: Gets and updates user subscriptions
 * - PlanService: Gets information about available plans
 * - AuthService: Gets authentication tokens for API calls
 * - AppContextService: Accesses global plans and user data
 * - Stripe: Integration for checkout and subscription management portal
 * 
 * Main flow:
 * 1. On initialization, loads user plan and available plans
 * 2. Builds plan cards from global context data
 * 3. Calculates renewal dates and remaining days
 * 4. Handles plan changes with downgrade validation
 * 5. Integrates with Stripe for payments and subscription management
 * 
 * @component
 * @selector app-plan-settings
 * @standalone true
 */
@Component({
  selector: 'app-plan-settings',
  imports: [CommonModule, LoadingSpinnerComponent, StripeLoaderPopupComponent, ToastContainerComponent /*SubscriptionProcessingComponent OrderSummaryComponent*/],
  templateUrl: './plan-settings.component.html',
  styleUrl: './plan-settings.component.scss',
  standalone: true,
})
export class PlanSettingsComponent implements OnInit {
  /** Plan details received from parent component (AccountComponent) */
  @Input() planDetails: PlanDetails | null = null;

  /** Array of available plan cards to display in the interface */
  plansData: PlanCard[] = [];
  
  /** Current user plan obtained from the service */
  userPlan: Plan | undefined = undefined;
  
  /** Plan renewal date formatted as string */
  renewalDate: string = '';
  
  /** Remaining days until next renewal */
  remainingDays: number = 0;
  
  /** Flag to determine if user has free plan (shows N/A for renewal) */
  isFreePlan: boolean = false;
  
  // Estado de carga inicial
  initialLoading: boolean = true;
  

  user: User | null = null;
  selectedIndex: number = 0;
  tabs: { label: string }[] = [
    { label: 'Profile Details' },
    { label: 'Plan Management' },
    { label: 'Billing Management' },
  ];

  // Estados para cancelar plan
  showCancelPlanProcessing = false;
  
  // Estados para validación de downgrade
  showDowngradeValidation = false;
  downgradeValidationData: {
    targetPlan: string;
    currentAccounts: number;
    maxAccounts: number;
    currentStrategies: number;
    maxStrategies: number;
    accountsToDelete: number;
    strategiesToDelete: number;
  } | null = null;

  // Estados para pop-up de carga y error de redirección
  showRedirectLoading = false;
  showRedirectError = false;
  redirectErrorMessage = '';
  private windowCheckInterval: any = null;

  // Inyectar servicios
  private subscriptionService = inject(SubscriptionService);
  private planService = inject(PlanService);
  private authService = inject(AuthService);
  private appContext = inject(AppContextService);
  private configService = inject(ConfigService);
  private backendApi = inject(BackendApiService);
  private toastService = inject(ToastNotificationService);

  constructor(
    private store: Store,
    private strategySvc: SettingsService,
    private reportSvc: ReportService
  ) {}

  /**
   * Initializes the component on load.
   * 
   * Performs the following actions in order:
   * 1. Subscribes to changes in global plans from context
   * 2. Attempts to build plan cards immediately
   * 3. If no plans are loaded, loads them manually from PlanService
   * 4. Loads current user plan from SubscriptionService
   * 
   * @async
   * @memberof PlanSettingsComponent
   */
  async ngOnInit(): Promise<void> {
    this.initialLoading = true;
    
    try {
      // Suscribirse a cambios en los planes globales
      this.appContext.subscribeToGlobalPlansChanges().subscribe(plans => {
        if (plans.length > 0) {
          this.buildPlansData();
        }
      });
      
      // También intentar construir inmediatamente por si ya están cargados
      this.buildPlansData();
      
      // Si no hay planes, intentar cargarlos manualmente
      if (this.appContext.globalPlans().length === 0) {
        await this.loadPlansManually();
      }
      
      await this.loadUserPlan();
    } finally {
      this.initialLoading = false;
    }
  }

  /**
   * Loads the current user plan from subscription.
   * 
   * This method:
   * 1. Gets the current user from the store
   * 2. Finds the user's most recent subscription
   * 3. Gets the plan associated with the subscription from PlanService
   * 4. Calculates renewal date and remaining days
   * 5. If there's no subscription or plan, sets default free plan
   * 
   * Related to:
   * - SubscriptionService.getUserLatestSubscription(): Gets user subscription
   * - PlanService.getPlanById(): Gets plan details by ID
   * - calculateRenewalDate(): Calculates renewal date
   * - setDefaultFreePlan(): Sets free plan if there's no subscription
   * 
   * @private
   * @async
   * @memberof PlanSettingsComponent
   */
  private async loadUserPlan(): Promise<void> {
    try {
      // Obtener el usuario actual
      this.getUserData();
      if (!this.user) {
        console.error('❌ User not found');
        return;
      }
      
      // Obtener la suscripción del usuario
      const subscription = await this.subscriptionService.getUserLatestSubscription(this.user.id);
      if (subscription && subscription.planId) {
        // Buscar el plan por ID
        const plan: Plan | undefined = await this.planService.getPlanById(subscription.planId);
        
        if (plan) {
          this.userPlan = plan;
          this.isFreePlan = plan.name.toLowerCase() === 'free';
          
          // Usar periodEnd si existe, sino usar created_at
          if (subscription.periodEnd) {
            this.calculateRenewalDate(subscription.periodEnd);
          } else {
            this.calculateRenewalDate(subscription.created_at);
          }
        } else {
          // Si no se encuentra el plan, usar plan gratuito por defecto
          this.setDefaultFreePlan();
        }
      } else {
        // Si no hay suscripción, usar plan gratuito por defecto
        this.setDefaultFreePlan();
      }
    } catch (error) {
      console.error('Error loading user plan:', error);
      this.setDefaultFreePlan();
    }
  }


  /**
   * Builds the array of plan cards from global context plans.
   * 
   * This method transforms plans obtained from AppContextService into
   * PlanCard objects used to display cards in the interface.
   * 
   * For each plan:
   * - Assigns price and period
   * - Marks the second plan as "most popular"
   * - Assigns icons and colors based on position
   * - Builds the features array (trading accounts, strategies, etc.)
   * - Defines the CTA button text
   * 
   * Related to:
   * - AppContextService.orderedPlans(): Gets ordered plans
   * - AppContextService.getPlanLimits(): Gets limits for each plan
   * 
   * @private
   * @memberof PlanSettingsComponent
   */
  private buildPlansData(): void {
    // Usar planes del contexto global
    const orderedPlans = this.appContext.orderedPlans();
    
    if (orderedPlans.length === 0) {
      return;
    }
    
    // Construir plansData desde los planes ordenados del contexto
    this.plansData = orderedPlans.map((plan, index) => ({
      name: plan.name,
      price: parseInt(plan.price) || 0,
      period: '/month',
      mostPopular: index === 1, // Marcar el segundo plan como más popular (Starter)
      icon: index === 0 ? 'triangle' : index === 1 ? 'circle' : 'square',
      color: index === 0 ? '#4b7ee8' : index === 1 ? '#4b7ee8' : '#d1ff81',
      features: [
        { label: 'Trading Accounts', value: plan.tradingAccounts.toString() },
        { label: 'Strategies', value: plan.strategies.toString() },
        { label: 'Consistency Rules', value: 'YES' },
        { label: 'Trading Journal', value: 'YES' },
        { label: 'Live Statistics', value: 'YES' }
      ],
      cta: `Get ${plan.name} Now`
    }));
  }

  /**
   * Loads plans manually from PlanService if they're not in context.
   * 
   * This method runs as a fallback when plans are not available
   * in the global context. Loads all plans from PlanService and
   * sets them in the context for future use.
   * 
   * Related to:
   * - PlanService.getAllPlans(): Gets all available plans
   * - AppContextService.setGlobalPlans(): Sets plans in context
   * - buildPlansData(): Builds cards after loading
   * 
   * @private
   * @async
   * @memberof PlanSettingsComponent
   */
  private async loadPlansManually(): Promise<void> {
    try {
      const plans = await this.planService.getAllPlans();
      this.appContext.setGlobalPlans(plans);
      this.buildPlansData();
    } catch (error) {
      console.error('❌ Error cargando planes manualmente:', error);
    }
  }

  /**
   * Gets current user data from NgRx store.
   * 
   * Subscribes to selectUser selector to get current user
   * and update the component's user property.
   * 
   * Related to:
   * - Store.select(selectUser): NgRx selector to get user
   * 
   * @private
   * @memberof PlanSettingsComponent
   */
  private getUserData() {
    this.store.select(selectUser).subscribe({
      next: (user) => {
        this.user = user.user;
      },
      error: (err) => {
        console.error('Error fetching user data', err);
      },
    });
  }

  /**
   * Sets the free plan as the user's default plan.
   * 
   * This method runs when:
   * - User doesn't have an active subscription
   * - Plan associated with subscription cannot be found
   * - An error occurs loading user plan
   * 
   * Searches for "Free" plan in global context, or creates a default one
   * if not available. Sets renewal date as "N/A"
   * and remaining days to 0.
   * 
   * Related to:
   * - AppContextService.getPlanByName(): Searches for Free plan in context
   * 
   * @private
   * @memberof PlanSettingsComponent
   */
  private setDefaultFreePlan(): void {
    // Buscar el plan Free en los planes del contexto global
    const freePlan = this.appContext.getPlanByName('Free');
    
    if (freePlan) {
      this.userPlan = freePlan;
    } else {
      // Fallback si no se encuentra el plan Free en el contexto
      this.userPlan = {
        id: 'free',
        name: 'Free',
        price: '0',
        strategies: 1,
        tradingAccounts: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }
    this.isFreePlan = true;
    this.renewalDate = 'N/A';
    this.remainingDays = 0;
  }

  /**
   * Calculates renewal date and remaining days until renewal.
   * 
   * This method:
   * 1. Checks if user has free plan (returns N/A if so)
   * 2. Converts periodEnd to Date object (handles both Firebase Timestamp and Date)
   * 3. Formats renewal date in readable format
   * 4. Calculates remaining days from today until renewal date
   * 5. If date has passed, sets days to 0
   * 
   * Related to:
   * - loadUserPlan(): Called after getting user subscription
   * 
   * @private
   * @param periodEnd - Subscription period end date (can be Firebase Timestamp or Date)
   * @memberof PlanSettingsComponent
   */
  private calculateRenewalDate(periodEnd?: any): void {
    // Si es plan Free, no calcular nada
    if (this.isFreePlan) {
      this.renewalDate = 'N/A';
      this.remainingDays = 0;
      return;
    }
    
    let renewalDate: Date;
    
    if (periodEnd) {
      // Usar periodEnd de la subscription
      renewalDate = periodEnd.toDate ? periodEnd.toDate() : new Date(periodEnd);
    } else {
      // Fallback: usar fecha actual
      renewalDate = new Date();
    }
    
    // Formatear fecha de renovación
    this.renewalDate = renewalDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    // Calcular días restantes desde hoy hasta la fecha de renovación
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset horas para comparación precisa
    renewalDate.setHours(0, 0, 0, 0);
    
    const timeDiff = renewalDate.getTime() - today.getTime();
    this.remainingDays = Math.ceil(timeDiff / (1000 * 3600 * 24));
    
    // Si ya pasó la fecha de renovación, mostrar 0 días
    if (this.remainingDays < 0) {
      this.remainingDays = 0;
    }
  }

  selectTypeData(index: number): void {
    this.selectedIndex = index;
  }

  /**
   * Gets capitalized current plan name.
   * 
   * Helper to display plan name in readable format
   * (first letter uppercase, rest lowercase).
   * 
   * @returns Capitalized plan name or "Free Plan" if no plan
   * @memberof PlanSettingsComponent
   */
  getCapitalizedPlanName(): string {
    if (!this.userPlan?.name) return 'Free Plan';
    const name = this.userPlan.name;
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  }

  /**
   * Capitalizes any plan name.
   * 
   * Generic helper to format plan names
   * (first letter uppercase, rest lowercase).
   * 
   * @param planName - Plan name to capitalize
   * @returns Capitalized plan name or empty string if not provided
   * @memberof PlanSettingsComponent
   */
  capitalizePlanName(planName: string): string {
    if (!planName) return '';
    return planName.charAt(0).toUpperCase() + planName.slice(1).toLowerCase();
  }

  /**
   * Checks if a plan is the user's current plan.
   * 
   * Compares the provided plan name with the user's current
   * plan name (case-insensitive comparison).
   * 
   * @param planName - Name of plan to check
   * @returns true if plan is current plan, false otherwise
   * @memberof PlanSettingsComponent
   */
  isCurrentPlan(planName: string): boolean {
    if (!this.userPlan) return false;
    return this.userPlan.name.toLowerCase() === planName.toLowerCase();
  }

  /**
   * Gets the number of trading accounts allowed for a plan.
   * 
   * Searches for plan limits in global context and returns
   * the number of allowed trading accounts.
   * 
   * Related to:
   * - AppContextService.getPlanLimits(): Gets plan limits
   * 
   * @param planName - Plan name
   * @returns Number of trading accounts as string (default "1")
   * @memberof PlanSettingsComponent
   */
  getTradingAccounts(planName: string): string {
    // Usar datos del contexto global
    const limits = this.appContext.getPlanLimits(planName);
    return limits ? limits.tradingAccounts.toString() : '1';
  }

  /**
   * Gets the number of strategies allowed for a plan.
   * 
   * Searches for plan limits in global context and returns
   * the number of allowed strategies.
   * 
   * Related to:
   * - AppContextService.getPlanLimits(): Gets plan limits
   * 
   * @param planName - Plan name
   * @returns Number of strategies as string (default "1")
   * @memberof PlanSettingsComponent
   */
  getStrategies(planName: string): string {
    // Usar datos del contexto global
    const limits = this.appContext.getPlanLimits(planName);
    return limits ? limits.strategies.toString() : '1';
  }

  /**
   * Gets button text based on plan status.
   * 
   * Returns:
   * - "Current plan" if plan is user's current plan
   * - "Change plan" for all other cases
   * 
   * @param planName - Plan name
   * @returns Corresponding button text
   * @memberof PlanSettingsComponent
   */
  getButtonText(planName: string): string {
    // Verificar si el plan de la card es el plan actual del usuario
    const currentPlanName = this.userPlan?.name.toLowerCase();
    const cardPlanName = planName.toLowerCase();
    
    // Si el plan de la card coincide con el plan actual del usuario
    if (currentPlanName === cardPlanName) {
      return 'Current plan';
    }
    
    // Para todos los demás casos
    return 'Change plan';
  }

  /**
   * Determines if a plan's button should be disabled.
   * 
   * Button is disabled if:
   * - Plan is user's current plan
   * 
   * @param planName - Plan name
   * @returns true if button should be disabled, false otherwise
   * @memberof PlanSettingsComponent
   */
  isButtonDisabled(planName: string): boolean {
    const isCurrentPlanFree = this.userPlan?.name.toLowerCase() === 'free';
    
    // Solo deshabilitar el botón FREE cuando el usuario tiene plan FREE
    if (this.userPlan?.name.toLowerCase() === planName.toLowerCase()) {
      return true;
    }
    
    return false;
  }

  /**
   * Handles plan change when user selects a new plan.
   * 
   * This method is the main entry point for changing plans.
   * Performs the following actions:
   * 1. Checks if selected plan is current plan (does nothing if so)
   * 2. Validates if it's a downgrade and checks if user has resources exceeding target plan
   * 3. If downgrade and there are excess resources, shows validation modal
   * 4. If current plan is FREE and target is also FREE, does nothing
   * 5. If current plan is FREE, creates Stripe checkout session
   * 6. If current plan is NOT FREE, opens Stripe portal for management
   * 
   * Related to:
   * - isCurrentPlan(): Checks if it's current plan
   * - isDowngrade(): Determines if it's a downgrade
   * - validateDowngrade(): Validates if downgrade is possible
   * - createCheckoutSession(): Creates checkout session for paid plans
   * - openStripePortal(): Opens Stripe portal for subscription management
   * 
   * @async
   * @param plan - Selected plan card
   * @memberof PlanSettingsComponent
   */
  async onPlanChange(plan: PlanCard): Promise<void> {
    try {
      // Verificar si es el plan actual
      if (this.isCurrentPlan(plan.name)) {
        return; // No hacer nada si es el plan actual
      }

      console.log('plan', plan);

      // Validar si es un downgrade y si el usuario tiene recursos que exceden el plan de destino
      const isDowngrade = this.isDowngrade(plan.name);
      
      if (isDowngrade) {
        const validationResult = await this.validateDowngrade(plan.name);
        
        if (!validationResult.canDowngrade) {
          this.showDowngradeValidationModal(validationResult);
          return;
        }
      }

      // Verificar si el plan actual es FREE
      const isCurrentPlanFree = this.userPlan?.name.toLowerCase() === 'free';
      const isTargetPlanFree = plan.name.toLowerCase() === 'free';
      
      // Si el plan actual es FREE y el plan de destino también es FREE, no hacer nada
      if (isCurrentPlanFree && isTargetPlanFree) {
        return; // No hacer nada si ambos son Free
      }
      
      // Si llegamos aquí, significa que puede hacer el cambio de plan
      // Mostrar pop-up de carga solo para planes de pago
      this.showRedirectLoading = true;
      
      // Variable para controlar si hay error
      let hasError = false;
      let errorMessage = '';
      
      try {
        if (isCurrentPlanFree) {
          // Si el plan actual es FREE y hace click en otro plan → crear checkout session
          await this.createCheckoutSession(plan.name);
        } else {
          // Si el plan actual NO es FREE → abrir portal de Stripe
          await this.openStripePortal();
        }
      } catch (error) {
        // Marcar que hay error pero no mostrar pop-up aún
        hasError = true;
        errorMessage = 'Error redirecting to payment. Please try again.';
        console.error('Error during plan change:', error);
      }
      
      // Esperar mínimo 2 segundos antes de mostrar error o ocultar loader
      setTimeout(() => {
        if (hasError) {
          // Si hay error, mostrar pop-up de error
          this.showRedirectLoading = false;
          this.showRedirectError = true;
          this.redirectErrorMessage = errorMessage;
          
          // Limpiar intervalo si existe
          if (this.windowCheckInterval) {
            clearInterval(this.windowCheckInterval);
            this.windowCheckInterval = null;
          }
        }
        // Si no hay error, el loader se ocultará automáticamente cuando se cierre la ventana
      }, 2000);
    } catch (error) {
      console.error('Error processing plan change:', error);
      // Eliminar el alert y manejar el error de forma más elegante
      console.error('Error processing your request. Please try again.');
    }
  }

  /**
   * Creates a Stripe checkout session for a new plan.
   * 
   * This method runs when user has FREE plan and wants to
   * switch to a paid plan. Performs:
   * 1. Gets complete plan from context to obtain planPriceId
   * 2. Gets Firebase authentication token
   * 3. Makes POST request to API to create checkout session
   * 4. Redirects user to Stripe checkout URL
   * 
   * Related to:
   * - AppContextService.getPlanByName(): Gets plan by name
   * - AuthService.getBearerTokenFirebase(): Gets authentication token
   * - API: /payments/create-checkout-session (via ConfigService)
   * 
   * @private
   * @async
   * @param planName - Selected plan name
   * @throws Error if planPriceId is not found or session creation fails
   * @memberof PlanSettingsComponent
   */
  private async createCheckoutSession(planName: string): Promise<void> {
    try {
      // Obtener el plan completo del contexto para obtener el priceId
      const selectedPlan = this.appContext.getPlanByName(planName);
      
      if (!selectedPlan || !selectedPlan.planPriceId) {
        throw new Error('Plan price ID not found');
      }

      // Obtener el token de Firebase
      const bearerTokenFirebase = await this.authService.getBearerTokenFirebase(this.user?.id || '');

      // Crear checkout session
      const response = await fetch(`${this.configService.apiUrl}/v1/payments/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${bearerTokenFirebase}`
        },
        body: JSON.stringify({
          priceId: selectedPlan.planPriceId,
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error creating checkout session: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const responseData = await response.json();
      const checkoutUrl = responseData.body?.url || responseData.url;
      
      if (!checkoutUrl) {
        throw new Error('Checkout URL not found in response');
      }

      // Redirigir a la página de checkout
      window.location.href = checkoutUrl;
      
    } catch (error) {
      console.error('Error creating checkout session:', error);
      // No ocultar el loader aquí, dejar que el timeout de 2 segundos lo maneje
      throw error;
    }
  }

  /**
   * Opens Stripe subscription management portal in a new window.
   * 
   * This method runs when user has a paid plan and wants to
   * manage their subscription. Performs:
   * 1. Gets Firebase authentication token
   * 2. Makes POST request to API to create portal session
   * 3. Opens portal in a new window
   * 4. Monitors if window closes to hide loader
   * 5. Has a safety timeout of 8 seconds
   * 
   * Related to:
   * - AuthService.getBearerTokenFirebase(): Gets authentication token
   * - BackendApiService.createPortalSession(): Creates portal session via backend API
   * - API: POST /api/v1/payments/create-portal-session
   * - windowCheckInterval: Interval to check if window closed
   * 
   * @private
   * @async
   * @throws Error if session creation fails or window cannot be opened
   * @memberof PlanSettingsComponent
   */
  private async openStripePortal(): Promise<void> {
    try {
      const bearerTokenFirebase = await this.authService.getBearerTokenFirebase(this.user?.id || '');

      // Use BackendApiService to create portal session
      const response = await this.backendApi.createPortalSession(bearerTokenFirebase);

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Error creating portal session');
      }

      const portalSessionUrl = response.data.url;
      
      if (!portalSessionUrl) {
        throw new Error('Portal session URL not found in response');
      }

      // Open portal in new window
      const newWindow = window.open(portalSessionUrl, '_blank');
      
      // Verify if window opened correctly
      if (!newWindow || newWindow.closed || typeof newWindow.closed == 'undefined') {
        throw new Error('Failed to open Stripe portal. Please check your pop-up blocker.');
      }

      // Periodically check if window is still open
      this.windowCheckInterval = setInterval(() => {
        if (newWindow.closed) {
          // Window closed, hide loading
          clearInterval(this.windowCheckInterval);
          this.showRedirectLoading = false;
        }
      }, 500);

      // Safety timeout: if window hasn't closed after 10 seconds, hide loading
      setTimeout(() => {
        if (this.windowCheckInterval) {
          clearInterval(this.windowCheckInterval);
        }
        this.showRedirectLoading = false;
      }, 8000);

    } catch (error: any) {
      console.error('Error opening Stripe portal:', error);
      // Show backend error in toast
      this.toastService.showBackendError(error, 'Error opening Stripe portal');
      // Don't hide loader here, let the 2 second timeout handle it
      throw error;
    }
  }

  /**
   * Shows processing modal to cancel plan.
   * 
   * This method runs when user clicks the cancel plan button.
   * Shows a confirmation modal.
   * 
   * @memberof PlanSettingsComponent
   */
  onCancelPlan(): void {
    this.showCancelPlanProcessing = true;
  }

  /**
   * Confirms and executes user plan cancellation.
   * 
   * This method:
   * 1. Gets user's most recent subscription
   * 2. Updates subscription with CANCELLED status and empty planId
   * 3. Reloads user plan data
   * 
   * Related to:
   * - SubscriptionService.getUserLatestSubscription(): Gets subscription
   * - SubscriptionService.updateSubscription(): Updates subscription
   * - loadUserPlan(): Reloads plan after cancellation
   * 
   * @async
   * @memberof PlanSettingsComponent
   */
  async confirmCancelPlan(): Promise<void> {
    if (!this.user) {
      return;
    }

    try {
      // Obtener la suscripción actual del usuario
      const subscriptions = await this.subscriptionService.getUserLatestSubscription(this.user.id);
      
      if (subscriptions) {
        // Obtener la suscripción más reciente
        const latestSubscription = subscriptions;
        
        // Actualizar la suscripción con status CANCELLED y planId vacío
        await this.subscriptionService.updateSubscription(this.user.id, latestSubscription.id!, {
          status: UserStatus.CANCELLED,
          planId: ''
        });
        
        // Recargar los datos del usuario
        await this.loadUserPlan();
        
      } else {
        console.error('No active subscription found to cancel.');
      }
      
    } catch (error) {
      console.error('Error cancelling plan. Please try again.');
    } finally {
      this.showCancelPlanProcessing = false;
    }
  }

  /**
   * Cancels the plan cancellation process.
   * 
   * Hides processing modal without performing any action.
   * 
   * @memberof PlanSettingsComponent
   */
  cancelCancelPlan(): void {
    this.showCancelPlanProcessing = false;
  }

  /**
   * Opens Stripe portal to manage subscription.
   * 
   * Similar to openStripePortal(), but runs from a specific
   * "Manage Subscription" button. Opens portal in a new window.
   * 
   * Related to:
   * - AuthService.getBearerTokenFirebase(): Gets authentication token
   * - BackendApiService.createPortalSession(): Creates portal session via backend API
   * - API: POST /api/v1/payments/create-portal-session
   * 
   * @async
   * @memberof PlanSettingsComponent
   */
  async onManageSubscription(): Promise<void> {
    try {
      const bearerTokenFirebase = await this.authService.getBearerTokenFirebase(this.user?.id || '');

      // Use BackendApiService to create portal session
      const response = await this.backendApi.createPortalSession(bearerTokenFirebase);

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Error creating portal session');
      }

      const portalSessionUrl = response.data.url;
      
      if (!portalSessionUrl) {
        throw new Error('Portal session URL not found in response');
      }

      window.open(portalSessionUrl, '_blank');
    } catch (error: any) {
      console.error('Error opening Stripe portal:', error);
      // Show backend error in toast
      this.toastService.showBackendError(error, 'Error opening Stripe portal');
    }
  }

  /**
   * Determines if a plan change is a downgrade (change to a lower plan).
   * 
   * Compares current plan level with target plan level.
   * Levels are: Free (1), Starter (2), Pro (3).
   * 
   * Related to:
   * - getPlanLevel(): Gets numeric level of a plan
   * 
   * @private
   * @param targetPlanName - Target plan name
   * @returns true if it's a downgrade, false otherwise
   * @memberof PlanSettingsComponent
   */
  private isDowngrade(targetPlanName: string): boolean {
    if (!this.userPlan) return false;
    
    const currentPlanLevel = this.getPlanLevel(this.userPlan.name);
    const targetPlanLevel = this.getPlanLevel(targetPlanName);
    
    return targetPlanLevel < currentPlanLevel;
  }

  /**
   * Gets numeric level of a plan for comparison.
   * 
   * Levels are:
   * - Free: 1
   * - Starter: 2
   * - Pro: 3
   * 
   * @private
   * @param planName - Plan name
   * @returns Numeric level of plan (default 1)
   * @memberof PlanSettingsComponent
   */
  private getPlanLevel(planName: string): number {
    const planLevels: { [key: string]: number } = {
      'free': 1,
      'starter': 2,
      'pro': 3
    };
    return planLevels[planName.toLowerCase()] || 1;
  }

  /**
   * Validates if user can downgrade to a specific plan.
   * 
   * This method checks if user has resources (trading accounts
   * or strategies) that exceed target plan limits. If so,
   * downgrade is not allowed until user removes excess resources.
   * 
   * Performs:
   * 1. Gets target plan limits
   * 2. Loads current user data (accounts and strategies)
   * 3. Calculates how many resources must be deleted
   * 4. Determines if downgrade is possible
   * 
   * Related to:
   * - getTradingAccounts(): Gets account limit of target plan
   * - getStrategies(): Gets strategy limit of target plan
   * - AuthService.getUserDataForValidation(): Gets current user data
   * 
   * @private
   * @async
   * @param targetPlanName - Target plan name
   * @returns Object with validation information (canDowngrade, resources to delete, etc.)
   * @memberof PlanSettingsComponent
   */
  private async validateDowngrade(targetPlanName: string): Promise<{
    canDowngrade: boolean;
    targetPlan: string;
    currentAccounts: number;
    maxAccounts: number;
    currentStrategies: number;
    maxStrategies: number;
    accountsToDelete: number;
    strategiesToDelete: number;
  }> {
    if (!this.user?.id) {
      throw new Error('User ID not available');
    }

    // Obtener límites del plan de destino usando la lógica existente
    const targetMaxAccountsStr = this.getTradingAccounts(targetPlanName);
    const targetMaxStrategiesStr = this.getStrategies(targetPlanName);
    
    const targetMaxAccounts = parseInt(targetMaxAccountsStr);
    const targetMaxStrategies = parseInt(targetMaxStrategiesStr);
    
    // Cargar datos actuales del usuario directamente desde Firebase
    const userData = await this.authService.getUserDataForValidation(this.user.id);
    const currentAccounts = userData.accounts.length;
    const currentStrategies = userData.strategies.length;
    
    const accountsToDelete = Math.max(0, currentAccounts - targetMaxAccounts);
    const strategiesToDelete = Math.max(0, currentStrategies - targetMaxStrategies);
    
    const canDowngrade = accountsToDelete === 0 && strategiesToDelete === 0;
    
    return {
      canDowngrade,
      targetPlan: targetPlanName,
      currentAccounts,
      maxAccounts: targetMaxAccounts,
      currentStrategies,
      maxStrategies: targetMaxStrategies,
      accountsToDelete,
      strategiesToDelete
    };
  }

  /**
   * Shows downgrade validation modal.
   * 
   * Sets validation data and shows modal that informs
   * user about resources they must delete before downgrading.
   * 
   * @private
   * @param validationData - Validation data obtained from validateDowngrade()
   * @memberof PlanSettingsComponent
   */
  private showDowngradeValidationModal(validationData: any): void {
    this.downgradeValidationData = validationData;
    this.showDowngradeValidation = true;
  }

  /**
   * Closes downgrade validation modal.
   * 
   * Hides modal and clears validation data.
   * 
   * @memberof PlanSettingsComponent
   */
  closeDowngradeValidation(): void {
    this.showDowngradeValidation = false;
    this.downgradeValidationData = null;
  }

  /**
   * Navigates to resource management pages.
   * 
   * This method runs when user wants to delete resources
   * before downgrading. Currently only shows a console message.
   * 
   * TODO: Implement real navigation to resource management pages.
   * 
   * @memberof PlanSettingsComponent
   */
  goToManageResources(): void {
    this.showDowngradeValidation = false;
    this.downgradeValidationData = null;
    
    // Navegar a las páginas de gestión de recursos
    // TODO: Implementar navegación a las páginas de gestión de recursos
  }

  /**
   * Closes redirect error pop-up.
   * 
   * Hides error pop-up, clears message and stops any
   * active window check interval.
   * 
   * Related to:
   * - windowCheckInterval: Interval that checks if Stripe window closed
   * 
   * @memberof PlanSettingsComponent
   */
  closeRedirectError(): void {
    this.showRedirectError = false;
    this.redirectErrorMessage = '';
    
    // Limpiar intervalo si existe
    if (this.windowCheckInterval) {
      clearInterval(this.windowCheckInterval);
      this.windowCheckInterval = null;
    }
    
    // Ocultar loading si está visible
    this.showRedirectLoading = false;
  }
}