import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface OrderDetails {
  planName: string;
  price: number;
  currency: string;
  billing: string;
  features: {
    tradingAccounts: number;
    strategies: number;
    consistencyRules: boolean;
    tradingJournal: boolean;
    liveStatistics: boolean;
  };
  discount?: {
    code: string;
    amount: number;
  };
  taxes: number;
  total: number;
}

export interface OrderSummaryConfig {
  context: 'signup' | 'plan-change';
  planName: string;
  price: number;
  userData?: any;
}

@Component({
  selector: 'app-order-summary',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order-summary.component.html',
  styleUrl: './order-summary.component.scss'
})
export class OrderSummaryComponent {
  @Input() config: OrderSummaryConfig = {
    context: 'signup',
    planName: 'Free',
    price: 0
  };
  @Output() continue = new EventEmitter<void>();

  get orderDetails(): OrderDetails {
    const subtotal = this.config.price;
    const discountAmount = this.getDiscountAmount(subtotal);
    const taxes = this.calculateTaxes(subtotal - discountAmount);
    const total = subtotal - discountAmount + taxes;

    return {
      planName: this.config.planName,
      price: subtotal,
      currency: 'USD',
      billing: 'Monthly',
      features: {
        tradingAccounts: this.getTradingAccountsCount(this.config.planName),
        strategies: this.getStrategiesCount(this.config.planName),
        consistencyRules: true,
        tradingJournal: true,
        liveStatistics: true
      },
      discount: discountAmount > 0 ? {
        code: '10RSTORDER',
        amount: discountAmount
      } : undefined,
      taxes: taxes,
      total: total
    };
  }

  private getTradingAccountsCount(planName: string): number {
    switch (planName.toLowerCase()) {
      case 'free': return 1;
      case 'starter': return 2;
      case 'pro': return 6;
      default: return 1;
    }
  }

  private getStrategiesCount(planName: string): number {
    switch (planName.toLowerCase()) {
      case 'free': return 1;
      case 'starter': return 3;
      case 'pro': return 8;
      default: return 1;
    }
  }

  private getDiscountAmount(subtotal: number): number {
    // Aplicar descuento del 10% para nuevos usuarios o cambios de plan
    return subtotal > 0 ? Math.round(subtotal * 0.1 * 100) / 100 : 0;
  }

  private calculateTaxes(subtotal: number): number {
    // Calcular impuestos del 21% (IVA)
    return Math.round(subtotal * 0.21 * 100) / 100;
  }

  onContinue(): void {
    this.continue.emit();
  }

  getContextTitle(): string {
    switch (this.config.context) {
      case 'signup':
        return 'Review your plan details.';
      case 'plan-change':
        return 'Review your new plan details.';
      default:
        return 'Review your plan details.';
    }
  }

  getProgressSteps(): { step: number; label: string; status: 'completed' | 'active' }[] {
    switch (this.config.context) {
      case 'signup':
        return [
          { step: 1, label: 'Plan Selection', status: 'completed' },
          { step: 2, label: 'Payment', status: 'completed' },
          { step: 3, label: 'Summary', status: 'active' }
        ];
      case 'plan-change':
        return [
          { step: 1, label: 'Plan Selection', status: 'completed' },
          { step: 2, label: 'Payment', status: 'completed' },
          { step: 3, label: 'Summary', status: 'active' }
        ];
      default:
        return [
          { step: 1, label: 'Plan Selection', status: 'completed' },
          { step: 2, label: 'Payment', status: 'completed' },
          { step: 3, label: 'Summary', status: 'active' }
        ];
    }
  }
}
