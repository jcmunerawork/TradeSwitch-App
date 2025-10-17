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

@Component({
  selector: 'app-plan-settings',
  imports: [CommonModule, LoadingSpinnerComponent /*SubscriptionProcessingComponent OrderSummaryComponent*/],
  templateUrl: './plan-settings.component.html',
  styleUrl: './plan-settings.component.scss',
  standalone: true,
})
export class PlanSettingsComponent implements OnInit {
  @Input() planDetails: PlanDetails | null = null;

  plansData: PlanCard[] = [];
  userPlan: Plan | undefined = undefined;
  renewalDate: string = '';
  remainingDays: number = 0;
  isFreePlan: boolean = false; // Para determinar si mostrar N/A
  
  // Estado de carga inicial
  initialLoading: boolean = true;
  

  user: User | null = null;
  selectedIndex: number = 0;
  tabs: { label: string }[] = [
    { label: 'Profile Details' },
    { label: 'Plan Management' },
    { label: 'Billing Management' },
  ];

  // Estados para cambio de plan
  showSubscriptionProcessing = false;
  showOrderSummary = false;
  selectedPlanForChange: PlanCard | null = null;
  currentPaymentId: string = '';
  
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
  
  // Configuraciones para componentes compartidos
  subscriptionProcessingConfig = {
    paymentId: '',
    userId: '',
    context: 'plan-change' as const,
    planName: ''
  };
  
  orderSummaryConfig = {
    context: 'plan-change' as const,
    planName: '',
    price: 0
  };

  // Inyectar servicios
  private subscriptionService = inject(SubscriptionService);
  private planService = inject(PlanService);
  private authService = inject(AuthService);
  private appContext = inject(AppContextService);

  constructor(
    private store: Store,
    private strategySvc: SettingsService,
    private reportSvc: ReportService
  ) {}

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

  private async loadPlansManually(): Promise<void> {
    try {
      const plans = await this.planService.getAllPlans();
      this.appContext.setGlobalPlans(plans);
      this.buildPlansData();
    } catch (error) {
      console.error('❌ Error cargando planes manualmente:', error);
    }
  }

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

  // Helper para capitalizar el nombre del plan
  getCapitalizedPlanName(): string {
    if (!this.userPlan?.name) return 'Free Plan';
    const name = this.userPlan.name;
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  }

  // Métodos para el nuevo diseño de comparación de planes
  isCurrentPlan(planName: string): boolean {
    if (!this.userPlan) return false;
    return this.userPlan.name.toLowerCase() === planName.toLowerCase();
  }

  getTradingAccounts(planName: string): string {
    // Usar datos del contexto global
    const limits = this.appContext.getPlanLimits(planName);
    return limits ? limits.tradingAccounts.toString() : '1';
  }

  getStrategies(planName: string): string {
    // Usar datos del contexto global
    const limits = this.appContext.getPlanLimits(planName);
    return limits ? limits.strategies.toString() : '1';
  }

  getButtonText(planName: string): string {
    if (this.isCurrentPlan(planName)) {
      return 'Current Plan';
    }
    return 'Change Plan';
  }

  // Métodos para cambio de plan
  async onPlanChange(plan: PlanCard): Promise<void> {
    
    if (this.isCurrentPlan(plan.name)) {
      return; // No hacer nada si es el plan actual
    }

    // Validar si es un downgrade y si el usuario tiene recursos que exceden el plan de destino
    const isDowngrade = this.isDowngrade(plan.name);
    
    if (isDowngrade) {
      const validationResult = await this.validateDowngrade(plan.name);
      
      if (!validationResult.canDowngrade) {
        this.showDowngradeValidationModal(validationResult);
        return;
      }
    }

    try {
      this.selectedPlanForChange = plan;
      
      // Configurar componentes compartidos (sin crear suscripción aún)
      this.subscriptionProcessingConfig = {
        paymentId: '', // Se creará después del procesamiento exitoso
        userId: this.user?.id || '',
        context: 'plan-change',
        planName: plan.name
      };
      
      this.orderSummaryConfig = {
        context: 'plan-change',
        planName: plan.name,
        price: plan.price
      };
      
      // Mostrar procesamiento de pago
      this.showSubscriptionProcessing = true;
      
      // Simular procesamiento de pago después de un pequeño delay
      setTimeout(() => {
        this.simulateSubscriptionProcessing();
      }, 1000); // 1 segundo de delay para que se vea la ventana
      
    } catch (error) {
      console.error('Error iniciando cambio de plan:', error);
      alert('Error starting plan change. Please try again.');
    }
  }

  // TODO: IMPLEMENTAR ENDPOINT DE PAGO - Reemplazar simulación con API real
  private simulateSubscriptionProcessing(): void {
    // Simular tiempo de procesamiento
    setTimeout(async () => {
      try {
        // Simular éxito del pago (80% de probabilidad para cambios de plan)
        const isSuccess = Math.random() > 0.2;
        
        if (isSuccess) {
          // Crear nueva suscripción con el plan seleccionado
          await this.createNewSubscription();
          this.onPaymentSuccess();
        } else {
          this.onPaymentError();
        }
      } catch (error) {
        console.error('Error creando nueva suscripción:', error);
        this.onPaymentError();
      }
    }, 5000); // 5 segundos de simulación para que se vea mejor
  }

  private onPaymentSuccess(): void {
    this.showSubscriptionProcessing = false;
    this.showOrderSummary = true;
  }

  private onPaymentError(): void {
    this.showSubscriptionProcessing = false;
    alert('Error processing plan change. Please try again.');
  }

  onPaymentProcessingSuccess(): void {
    this.showSubscriptionProcessing = false;
    this.showOrderSummary = true;
  }

  onPaymentProcessingError(): void {
    this.showSubscriptionProcessing = false;
    alert('Error processing plan change. Please try again.');
  }

  onPaymentProcessingGoBack(): void {
    this.showSubscriptionProcessing = false;
  }

  onOrderSummaryContinue(): void {
    this.showOrderSummary = false;
    alert('Plan change completed successfully!');
    // Recargar el plan del usuario
    this.loadUserPlan();
  }

  onCancelPlan(): void {
    this.showCancelPlanProcessing = true;
  }

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
        
        alert('Your plan has been cancelled successfully.');
        
        // Recargar los datos del usuario
        await this.loadUserPlan();
        
      } else {
        alert('No active subscription found to cancel.');
      }
      
    } catch (error) {
      alert('Error cancelling plan. Please try again.');
    } finally {
      this.showCancelPlanProcessing = false;
    }
  }

  cancelCancelPlan(): void {
    this.showCancelPlanProcessing = false;
  }

  // Métodos para validación de downgrade
  private isDowngrade(targetPlanName: string): boolean {
    if (!this.userPlan) return false;
    
    const currentPlanLevel = this.getPlanLevel(this.userPlan.name);
    const targetPlanLevel = this.getPlanLevel(targetPlanName);
    
    return targetPlanLevel < currentPlanLevel;
  }

  private getPlanLevel(planName: string): number {
    const planLevels: { [key: string]: number } = {
      'free': 1,
      'starter': 2,
      'pro': 3
    };
    return planLevels[planName.toLowerCase()] || 1;
  }

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

  private showDowngradeValidationModal(validationData: any): void {
    this.downgradeValidationData = validationData;
    this.showDowngradeValidation = true;
  }

  closeDowngradeValidation(): void {
    this.showDowngradeValidation = false;
    this.downgradeValidationData = null;
  }

  goToManageResources(): void {
    this.showDowngradeValidation = false;
    this.downgradeValidationData = null;
    
    // Navegar a las páginas de gestión de recursos
    alert('Please delete excess resources before downgrading your plan.');
  }

  private async createNewSubscription(): Promise<void> {
    //TODO: IMPLEMENTAR ENDPOINT DE PAGO A NUEVA SUBSCRIPTION - Reemplazar simulación con API real
  }

  async onManageSubscription(): Promise<void> {

    const bearerTokenFirebase = await this.authService.getBearerTokenFirebase(this.user?.id || '');

    const response = await fetch('https://trade-manager-backend-836816769157.us-central1.run.app/payments/create-portal-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${bearerTokenFirebase}`
      },
      body: JSON.stringify({
        userId: this.user?.id
      })
    });

    if (!response.ok) {
      throw new Error('Error creating portal session');
    }

    const responseData = await response.json();
    const portalSessionUrl = responseData.body?.url || responseData.url;
    
    if (!portalSessionUrl) {
      throw new Error('Portal session URL not found in response');
    }

    window.open(portalSessionUrl, '_blank');
  }
}