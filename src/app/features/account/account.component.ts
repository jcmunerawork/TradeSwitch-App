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
import { ActivatedRoute } from '@angular/router';

/**
 * Main component of the user account module.
 * 
 * This component acts as the main container that manages navigation between
 * different sections of the user account:
 * - Profile Details: Profile details and configuration
 * - Plan Management: Plan and subscription management
 * 
 * Related to:
 * - ProfileDetailsComponent: Displays and allows editing of profile data
 * - PlanSettingsComponent: Manages user subscription plans
 * - AppContextService: Gets current user data
 * - ActivatedRoute: Reads URL parameters to select the correct tab
 * 
 * @component
 * @selector app-account
 * @standalone true
 */
@Component({
  selector: 'app-account',
  imports: [CommonModule, PlanSettingsComponent, ProfileDetailsComponent],
  templateUrl: './account.component.html',
  styleUrl: './account.component.scss',
  standalone: true,
})
export class AccountComponent implements OnInit {
  /** Current user in the system */
  user: User | null = null;
  
  /** Index of the selected tab (0: Profile Details, 1: Plan Management) */
  selectedIndex: number = 0;
  
  /** Array of available tabs in the interface */
  tabs: { label: string }[] = [
    { label: 'Profile Details' },
    { label: 'Plan Management' },
    /*{ label: 'Subscription History' },*/
  ];
  
  /** Selected plan details (currently uses mock data) */
  selectedPlanDetails: PlanDetails | null = null;

  /**
   * Constructor for AccountComponent
   * 
   * @param store - NgRx Store to access global state
   * @param strategySvc - Strategy service (injected but not currently used)
   * @param reportSvc - Report service (injected but not currently used)
   * @param appContext - Application context service to get user data
   * @param route - ActivatedRoute to read URL parameters
   */
  constructor(
    private store: Store,
    private strategySvc: SettingsService,
    private reportSvc: ReportService,
    private appContext: AppContextService,
    private route: ActivatedRoute
  ) {}

  /**
   * Initializes the component on load.
   * 
   * Performs the following actions:
   * 1. Loads plan details from mocks
   * 2. Checks URL query parameters to select the correct tab
   *    (if ?tab=plan exists, selects the Plan Management tab)
   * 3. Subscribes to user changes from the application context
   * 4. If no user is available, attempts to load it
   * 
   * @memberof AccountComponent
   */
  ngOnInit(): void {
    this.selectedPlanDetails = MOCK_PLAN_DETAILS;
    
    // Verificar query parameters para seleccionar la pestaña correcta
    this.route.queryParams.subscribe(params => {
      if (params['tab'] === 'plan') {
        this.selectedIndex = 1; // Plan Management tab
      }
    });
    
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

  /**
   * Changes the selected tab in the interface.
   * 
   * This method is executed when the user clicks on a different tab.
   * Updates the selected index, which causes the corresponding component
   * to be displayed in the template.
   * 
   * @param index - Index of the tab to select (0: Profile Details, 1: Plan Management)
   * @memberof AccountComponent
   */
  selectTypeData(index: number): void {
    this.selectedIndex = index;
  }
}
