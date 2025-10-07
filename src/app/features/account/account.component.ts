import { Component, OnInit } from '@angular/core';
import { User } from '../overview/models/overview';
import { Store } from '@ngrx/store';
import { SettingsService } from '../strategy/service/strategy.service';
import { ReportService } from '../report/service/report.service';
import { CommonModule } from '@angular/common';
import { PlanSettingsComponent } from './components/plan-management/plan-settings.component';
import { ProfileDetailsComponent } from './components/profile-details/profile-details.component';
import { SubscriptionHistoryComponent } from './components/subscription-history/subscription-history.component';
import { PlanDetails } from './models/account-settings';
import { MOCK_PLAN_DETAILS } from './mocks/account-mocks';
import { AppContextService } from '../../shared/context';

@Component({
  selector: 'app-account',
  imports: [CommonModule, PlanSettingsComponent, ProfileDetailsComponent],
  templateUrl: './account.component.html',
  styleUrl: './account.component.scss',
  standalone: true,
})
export class AccountComponent implements OnInit {
  user: User | null = null;
  selectedIndex: number = 0;
  tabs: { label: string }[] = [
    { label: 'Profile Details' },
    { label: 'Plan Management' },
    /*{ label: 'Subscription History' },*/
  ];
  selectedPlanDetails: PlanDetails | null = null;

  constructor(
    private store: Store,
    private strategySvc: SettingsService,
    private reportSvc: ReportService,
    private appContext: AppContextService
  ) {}

  ngOnInit(): void {
    this.selectedPlanDetails = MOCK_PLAN_DETAILS;
    
    // Suscribirse a los datos del usuario desde el contexto
    this.appContext.currentUser$.subscribe(user => {
      this.user = user;
    });
    
    // Cargar datos del usuario si no están disponibles
    if (!this.user) {
      this.appContext.setLoading('user', true);
      // Aquí se podría implementar la carga de datos del usuario si es necesario
      this.appContext.setLoading('user', false);
    }
  }

  selectTypeData(index: number): void {
    this.selectedIndex = index;
  }
}
