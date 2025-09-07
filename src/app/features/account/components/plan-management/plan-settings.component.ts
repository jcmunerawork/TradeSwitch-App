import { Component, Input, OnInit } from '@angular/core';

import { CommonModule } from '@angular/common';
import { Store } from '@ngrx/store';
import { SettingsService } from '../../../strategy/service/strategy.service';
import { ReportService } from '../../../report/service/report.service';
import { User } from '../../../overview/models/overview';
import { PlanCard, PlanDetails } from '../../models/account-settings';
import { PLANS } from '../../mocks/account-mocks';

@Component({
  selector: 'app-plan-settings',
  imports: [CommonModule],
  templateUrl: './plan-settings.component.html',
  styleUrl: './plan-settings.component.scss',
  standalone: true,
})
export class PlanSettingsComponent implements OnInit {
  @Input() planDetails: PlanDetails | null = null;

  plansData: PlanCard[] = [];

  user: User | null = null;
  selectedIndex: number = 0;
  tabs: { label: string }[] = [
    { label: 'Profile Details' },
    { label: 'Plan Management' },
    { label: 'Billing Management' },
  ];

  constructor(
    private store: Store,
    private strategySvc: SettingsService,
    private reportSvc: ReportService
  ) {}

  ngOnInit(): void {
    this.plansData = PLANS;
  }

  selectTypeData(index: number): void {
    this.selectedIndex = index;
  }
}
