import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

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

@Component({
  selector: 'app-plan-selection',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './plan-selection.component.html',
  styleUrl: './plan-selection.component.scss'
})
export class PlanSelectionComponent {
  @Input() userData: any = null;
  @Output() planSelected = new EventEmitter<PlanCard>();
  @Output() goBack = new EventEmitter<void>();

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

  onPlanSelect(plan: PlanCard): void {
    this.planSelected.emit(plan);
  }

  onGoBack(): void {
    this.goBack.emit();
  }

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
