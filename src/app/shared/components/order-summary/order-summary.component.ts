import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Interface for order details display.
 *
 * @interface OrderDetails
 */
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

/**
 * Interface for order summary configuration.
 *
 * @interface OrderSummaryConfig
 */
export interface OrderSummaryConfig {
  context: 'signup' | 'plan-change';
  planName: string;
  price: number;
  userData?: any;
}

/**
 * Component for displaying order summary before payment.
 *
 * This component shows a detailed summary of the selected plan including
 * price, features, discounts, taxes, and total. It's used in both signup
 * and plan change flows to confirm the order before payment.
 *
 * Features:
 * - Display plan details (name, price, features)
 * - Calculate discounts (10% for new users)
 * - Calculate taxes (21% VAT)
 * - Display total amount
 * - Progress steps indicator
 * - Context-aware messaging (signup vs plan-change)
 *
 * Calculations:
 * - Discount: 10% of subtotal (applied automatically)
 * - Taxes: 21% of (subtotal - discount)
 * - Total: subtotal - discount + taxes
 *
 * Plan Features:
 * - Trading accounts: Varies by plan (Free: 1, Starter: 2, Pro: 6)
 * - Strategies: Varies by plan (Free: 1, Starter: 3, Pro: 8)
 * - All plans include: Consistency rules, Trading journal, Live statistics
 *
 * Relations:
 * - Used in signup flow before payment
 * - Used in plan change flow before payment
 *
 * @component
 * @selector app-order-summary
 * @standalone true
 */
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
