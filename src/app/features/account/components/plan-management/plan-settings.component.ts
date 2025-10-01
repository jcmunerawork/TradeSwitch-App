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

@Component({
  selector: 'app-plan-settings',
  imports: [CommonModule, SubscriptionProcessingComponent, OrderSummaryComponent],
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

  constructor(
    private store: Store,
    private strategySvc: SettingsService,
    private reportSvc: ReportService
  ) {}

  async ngOnInit(): Promise<void> {
    this.plansData = PLANS;
    this.loadUserPlan();
  }

  private async loadUserPlan(): Promise<void> {
    try {
      // Obtener el usuario actual
      this.getUserData();
      if (!this.user) {
        console.error('❌ User not found');
        return;
      }
      
      // Obtener los pagos del usuario
      const subscriptions = await this.subscriptionService.getAllSubscriptionsByUserId(this.user.id);
      if (subscriptions && subscriptions.length > 0) {
        // Obtener el último pago (más reciente)
        const latestPayment = subscriptions[0];
        
        // Buscar el plan por ID
        const plan: Plan | undefined = await this.planService.getPlanById(latestPayment.planId);
        
        if (plan) {
          this.userPlan = plan;
          this.calculateRenewalDate(latestPayment.created_at);
        } else {
          // Si no se encuentra el plan, usar plan gratuito por defecto
          this.setDefaultFreePlan();
        }
      } else {
        // Si no hay pagos, usar plan gratuito por defecto
        this.setDefaultFreePlan();
      }
    } catch (error) {
      console.error('Error loading user plan:', error);
      this.setDefaultFreePlan();
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
    this.userPlan = {
      id: 'free',
      name: 'Free',
      price: '0',
      strategies: 1,
      tradingAccounts: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.calculateRenewalDate(new Date());
  }

  private calculateRenewalDate(paymentCreatedAt?: any): void {
    let baseDate: Date;
    
    if (paymentCreatedAt) {
      // Si existe el payment, usar su fecha de creación
      baseDate = paymentCreatedAt.toDate ? paymentCreatedAt.toDate() : new Date(paymentCreatedAt);
    } else {
      // Si no existe payment, usar fecha actual
      baseDate = new Date();
    }
    
    // Calcular fecha de renovación (30 días desde la fecha base)
    const renewalDate = new Date(baseDate.getTime() + (30 * 24 * 60 * 60 * 1000));
    
    this.renewalDate = renewalDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    // Calcular días restantes desde hoy hasta la fecha de renovación
    const today = new Date();
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

  // Métodos para el nuevo diseño de comparación de planes
  isCurrentPlan(planName: string): boolean {
    if (!this.userPlan) return false;
    return this.userPlan.name.toLowerCase().includes(planName.toLowerCase()) || 
           (planName === 'Free' && this.userPlan.name.toLowerCase().includes('free'));
  }

  getTradingAccounts(planName: string): string {
    const planMap: { [key: string]: string } = {
      'Free': '1',
      'Starter': '2', 
      'Pro': '6'
    };
    return planMap[planName] || '1';
  }

  getStrategies(planName: string): string {
    const planMap: { [key: string]: string } = {
      'Free': '1',
      'Starter': '3',
      'Pro': '8'
    };
    return planMap[planName] || '1';
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
      console.error('❌ User not found');
      return;
    }

    try {
      // Obtener la suscripción actual del usuario
      const subscriptions = await this.subscriptionService.getAllSubscriptionsByUserId(this.user.id);
      
      if (subscriptions && subscriptions.length > 0) {
        // Obtener la suscripción más reciente
        const latestSubscription = subscriptions[0];
        
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
      console.error('❌ Error cancelando plan:', error);
      alert('Error cancelling plan. Please try again.');
    } finally {
      this.showCancelPlanProcessing = false;
    }
  }

  cancelCancelPlan(): void {
    this.showCancelPlanProcessing = false;
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
