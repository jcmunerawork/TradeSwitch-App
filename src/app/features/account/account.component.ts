import { Component, OnInit } from '@angular/core';
import { User } from '../overview/models/overview';
import { Store } from '@ngrx/store';
import { SettingsService } from '../strategy/service/strategy.service';
import { ReportService } from '../report/service/report.service';
import { CommonModule } from '@angular/common';
import { PlanSettingsComponent } from './components/plan-management/plan-settings.component';
import { PlanDetails } from './models/account-settings';
import { MOCK_PLAN_DETAILS } from './mocks/account-mocks';

@Component({
  selector: 'app-account',
  imports: [CommonModule, PlanSettingsComponent],
  templateUrl: './account.component.html',
  styleUrl: './account.component.scss',
  standalone: true,
})
export class AccountComponent implements OnInit {
  user: User | null = null;
  selectedIndex: number = 1;
  tabs: { label: string }[] = [
    { label: 'Profile Details' },
    { label: 'Plan Management' },
    { label: 'Billing Management' },
  ];
  selectedPlanDetails: PlanDetails | null = null;

  constructor(
    private store: Store,
    private strategySvc: SettingsService,
    private reportSvc: ReportService
  ) {}

  ngOnInit(): void {
    this.selectedPlanDetails = MOCK_PLAN_DETAILS;
  }

  selectTypeData(index: number): void {
    this.selectedIndex = index;
  }
}
