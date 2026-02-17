/**
 * Plan selection sub-component used after signup.
 *
 * Displays a fixed list of plans (Free, Starter, Pro) and emits the selected plan
 * or a go-back event. Used only by SignupComponent in the auth flow.
 */
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

/** Data for a single plan card: name, price, period, optional highlight, icon, color, features, CTA text. */
export interface PlanCard {
  name: string;
  price: number;
  period: string;
  mostPopular?: boolean;
  icon: 'triangle' | 'circle' | 'square';
  color: string;
  features: {
    label: string;
    value: string | number;
  }[];
  cta: string;
}

/**
 * Renders plan cards (Free, Starter, Pro) and emits planSelected or goBack.
 * Parent (SignupComponent) handles Stripe checkout when a paid plan is selected.
 */
@Component({
  selector: 'app-plan-selection',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './plan-selection.component.html',
  styleUrl: './plan-selection.component.scss'
})
export class PlanSelectionComponent {
  /** Optional user data passed from parent (e.g. for display). */
  @Input() userData: any = null;
  /** Emitted when the user selects a plan. */
  @Output() planSelected = new EventEmitter<PlanCard>();
  /** Emitted when the user clicks go back to signup form. */
  @Output() goBack = new EventEmitter<void>();

  /** Fixed list of plan cards shown in the UI. */
  plansData: PlanCard[] = [
    {
      name: 'Free',
      price: 0,
      period: '/month',
      icon: 'triangle',
      color: '#4b7ee8',
      features: [
        { label: 'Trading Accounts', value: 1 },
        { label: 'Strategies', value: 1 },
        { label: 'Consistency Rules', value: 'YES' },
        { label: 'Trading Journal', value: 'YES' },
        { label: 'Live Statistics', value: 'YES' }
      ],
      cta: 'Get Free Now'
    },
    {
      name: 'Starter',
      price: 35,
      period: '/month',
      icon: 'circle',
      color: '#4b7ee8',
      features: [
        { label: 'Trading Accounts', value: 2 },
        { label: 'Strategies', value: 3 },
        { label: 'Consistency Rules', value: 'YES' },
        { label: 'Trading Journal', value: 'YES' },
        { label: 'Live Statistics', value: 'YES' }
      ],
      cta: 'Get Starter Now'
    },
    {
      name: 'Pro',
      price: 99,
      period: '/month',
      mostPopular: true,
      icon: 'square',
      color: '#d1ff81',
      features: [
        { label: 'Trading Accounts', value: 6 },
        { label: 'Strategies', value: 8 },
        { label: 'Consistency Rules', value: 'YES' },
        { label: 'Trading Journal', value: 'YES' },
        { label: 'Live Statistics', value: 'YES' }
      ],
      cta: 'Get Pro Now'
    }
  ];

  constructor(private router: Router) {}

  /** Emits the selected plan to the parent. */
  onPlanSelect(plan: PlanCard): void {
    this.planSelected.emit(plan);
  }

  /** Emits go-back to the parent. */
  onGoBack(): void {
    this.goBack.emit();
  }

  /** Returns true if the value is a number or a numeric string (for template feature display). */
  isNumeric(value: string | number): boolean {
    if (typeof value === 'number') {
      return true;
    }
    if (typeof value === 'string') {
      return !isNaN(Number(value)) && !isNaN(parseFloat(value));
    }
    return false;
  }
}
