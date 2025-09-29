import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SubscriptionService } from '../../services/subscription-service';
import { UserStatus } from '../../../features/overview/models/overview';

export interface SubscriptionProcessingConfig {
  paymentId: string;
  userId: string;
  context: 'signup' | 'plan-change';
  planName?: string;
}

@Component({
  selector: 'app-subscription-processing',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './subscription-processing.component.html',
  styleUrl: './subscription-processing.component.scss'
})
export class SubscriptionProcessingComponent implements OnInit, OnDestroy {
  @Input() config: SubscriptionProcessingConfig = {
    paymentId: '',
    userId: '',
    context: 'signup'
  };
  @Output() paymentSuccess = new EventEmitter<void>();
  @Output() paymentError = new EventEmitter<void>();
  @Output() goBack = new EventEmitter<void>();

  processingStatus = 'processing';
  errorMessage = '';
  private statusCheckInterval: any;
  private subscriptionService = inject(SubscriptionService);

  ngOnInit(): void {
    this.startStatusListener();
  }

  ngOnDestroy(): void {
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
    }
  }

  // TODO: IMPLEMENTAR ENDPOINT DE VERIFICACIÓN DE PAGO - Reemplazar polling con API real
  private startStatusListener(): void {
    // Verificar estado del pago cada 2 segundos
    this.statusCheckInterval = setInterval(async () => {
      try {
        const subscription = await this.subscriptionService.getSubscriptionById(this.config.userId, this.config.paymentId);
        
        if (subscription) {
          switch (subscription.status) {
            case UserStatus.PURCHASED:
              this.processingStatus = 'success';
              this.paymentSuccess.emit();
              this.clearInterval();
              break;
            case UserStatus.CREATED:
              // Aún procesando
              break;
            default:
              this.processingStatus = 'error';
              this.errorMessage = 'Error processing the subscription';
              this.paymentError.emit();
              this.clearInterval();
              break;
          }
        } else {
          this.processingStatus = 'error';
          this.errorMessage = 'Subscription not found';
          this.paymentError.emit();
          this.clearInterval();
        }
      } catch (error) {
        console.error('Error verifying subscription status:', error);
        this.processingStatus = 'error';
        this.errorMessage = 'Connection error';
        this.paymentError.emit();
        this.clearInterval();
      }
    }, 2000);

    // Timeout after 30 seconds
    setTimeout(() => {
      if (this.processingStatus === 'processing') {
        this.processingStatus = 'error';
        this.errorMessage = 'Timeout';
        this.paymentError.emit();
        this.clearInterval();
      }
    }, 30000);
  }

  private clearInterval(): void {
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
      this.statusCheckInterval = null;
    }
  }

  onGoBack(): void {
    this.clearInterval();
    this.goBack.emit();
  }

  onRetry(): void {
    this.processingStatus = 'processing';
    this.errorMessage = '';
    this.startStatusListener();
  }

  getContextTitle(): string {
    switch (this.config.context) {
      case 'signup':
        return 'Almost there! Redirecting to finalize your payment.';
      case 'plan-change':
        return 'Almost there! Processing your plan change.';
      default:
        return 'Almost there! Redirecting to finalize your payment.';
    }
  }

  getSuccessMessage(): string {
    switch (this.config.context) {
      case 'signup':
        return 'Your subscription has been activated successfully.';
      case 'plan-change':
        return `Your plan has been successfully changed to ${this.config.planName || 'the new plan'}.`;
      default:
        return 'Your subscription has been activated successfully.';
    }
  }
}
