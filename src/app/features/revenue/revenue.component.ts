import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LoadingPopupComponent } from '../../shared/pop-ups/loading-pop-up/loading-popup.component';
import { Component } from '@angular/core';
import {
  DailyRevenueData,
  MonthlyRevenueData,
  OrderTableRow,
  RevenueSummary,
  RevenueTableRow,
  SubscriptionTableRow,
} from './models/revenue';
import { Store } from '@ngrx/store';
import {
  dailyRevenueMock,
  mockRevenueSummary,
  monthlyRevenueMock,
  orderTableMock,
  revenueTableMock,
  subscriptionTableMock,
} from './mocks/revenue_mock';
import { statCardComponent } from '../report/components/statCard/stat_card.component';
import { RevenueGraphComponent } from './components/revenueGraph/revenue-graph.component';
import { RevenueTableComponent } from './components/revenue-table/revenue-table.component';
import { OrdersTableComponent } from './components/orders-table/orders-table.component';
import { SubscriptionsTableComponent } from './components/subscriptions-table/subscriptions-table.component';
import { ReportService } from '../report/service/report.service';
import { selectUser } from '../auth/store/user.selectios';
import { User } from '../overview/models/overview';
import { AccountData } from '../auth/models/userModel';

/**
 * Main component for displaying revenue analytics and data.
 *
 * This component displays revenue-related information including:
 * - Revenue summary statistics (gross revenue, returns, coupons, net revenue)
 * - Revenue charts (daily and monthly)
 * - Revenue table with filtering and pagination
 * - Orders table with filtering and pagination
 * - Subscriptions table with filtering and pagination
 *
 * Currently uses mock data for display. Future implementation will fetch
 * real data from APIs based on user accounts and access tokens.
 *
 * Relations:
 * - RevenueGraphComponent: Displays revenue charts
 * - RevenueTableComponent: Displays revenue table
 * - OrdersTableComponent: Displays orders table
 * - SubscriptionsTableComponent: Displays subscriptions table
 * - ReportService: For fetching user keys and historical data (future implementation)
 * - Store (NgRx): For accessing user data
 *
 * @component
 * @selector app-revenue
 * @standalone true
 */
@Component({
  selector: 'app-revenue',
  imports: [
    CommonModule,
    LoadingPopupComponent,
    FormsModule,
    statCardComponent,
    RevenueGraphComponent,
    RevenueTableComponent,
    OrdersTableComponent,
    SubscriptionsTableComponent,
  ],
  templateUrl: './revenue.component.html',
  styleUrl: './revenue.component.scss',
  standalone: true,
})
export class RevenueComponent {
  revenueSummary: RevenueSummary | null = null;
  revenueDailyData: DailyRevenueData[] | null = null;
  revenueMonthlyData: MonthlyRevenueData[] | null = null;
  revenueTableData: RevenueTableRow[] | null = null;
  loading = false;
  orderTableData: OrderTableRow[] | null = null;
  subscriptionsTableData: SubscriptionTableRow[] | null = null;
  
  // Propiedades para el accessToken
  accessToken: string | null = null;
  user: User | null = null;
  accountsData: AccountData[] = [];

  constructor(private store: Store, private reportService: ReportService) {}

  /**
   * Initializes the component on load.
   *
   * Loads configuration (mock data) and fetches user data from the store.
   *
   * @memberof RevenueComponent
   */
  ngOnInit(): void {
    this.loadConfig();
    this.getUserData();
  }

  /**
   * Loads configuration data (currently using mock data).
   *
   * Initializes all revenue-related data from mock sources:
   * - Revenue summary
   * - Daily and monthly revenue data
   * - Revenue table data
   * - Orders table data
   * - Subscriptions table data
   *
   * NOTE: In production, this should fetch data from APIs.
   *
   * @memberof RevenueComponent
   */
  loadConfig() {
    this.revenueSummary = mockRevenueSummary;
    this.revenueDailyData = dailyRevenueMock;
    this.revenueMonthlyData = monthlyRevenueMock;
    this.revenueTableData = revenueTableMock;
    this.orderTableData = orderTableMock;
    this.subscriptionsTableData = subscriptionTableMock;
  }

  /**
   * Fetches user data from the NgRx store.
   *
   * Subscribes to the selectUser selector to get current user information.
   * If user has trading accounts, attempts to fetch access token for API calls.
   * Currently falls back to mock data if no accounts are available.
   *
   * Related to:
   * - Store.select(selectUser): Gets user from NgRx store
   * - fetchUserKey(): Fetches access token for API calls
   *
   * @memberof RevenueComponent
   */
  getUserData() {
    // Obtener datos del usuario desde el store
    this.store.select(selectUser).subscribe((userState) => {
      if (userState && userState.user) {
        this.user = userState.user;
        // Por ahora, usar datos mock ya que el modelo User no tiene accountsData
        // TODO: Agregar accountsData al modelo User o obtenerlo de otra fuente
        this.accountsData = []; // Temporalmente vacío
        
        // Si hay cuentas, obtener el accessToken de la primera cuenta
        if (this.accountsData.length > 0) {
          this.fetchUserKey(this.accountsData[0]);
        } else {
          console.warn('No hay cuentas de trading disponibles - usando datos mock');
          this.orderTableData = orderTableMock;
        }
      }
    });
  }

  /**
   * Fetches user authentication key for API access.
   *
   * Uses ReportService to authenticate with trading account credentials
   * and obtain an access token. On success, triggers fetching historical data.
   *
   * Related to:
   * - ReportService.getUserKey(): Authenticates and gets access token
   * - getHistoricalData(): Fetches historical data after authentication
   *
   * @param account - Trading account data with credentials
   * @memberof RevenueComponent
   */
  fetchUserKey(account: AccountData) {
    this.reportService
      .getUserKey(
        account.emailTradingAccount,
        account.brokerPassword,
        account.server
      )
      .subscribe({
        next: (accessToken: string) => {
          this.accessToken = accessToken;
          this.getHistoricalData();
        },
        error: (error) => {
          console.error('Error al obtener el accessToken:', error);
          this.orderTableData = orderTableMock;
        }
      });
  }

  /**
   * Fetches historical revenue data from the API.
   *
   * Currently a placeholder method. In production, this should:
   * - Use the access token to authenticate API requests
   * - Fetch historical order and revenue data
   * - Update orderTableData with real data
   *
   * NOTE: This method is not yet fully implemented.
   *
   * @memberof RevenueComponent
   */
  getHistoricalData() {
    if (!this.accessToken || this.accountsData.length === 0) {
      console.warn('No hay accessToken o cuentas disponibles');
      this.orderTableData = orderTableMock;
      return;
    }

    // Valores de ejemplo para probar el endpoint
    // TODO: Reemplazar con valores reales
    const routeId = 1;
    const from = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 días atrás
    const to = Date.now(); // Ahora
    const resolution = '1D'; // Diario
    const tradableInstrumentId = 1; // TODO: Usar ID real del instrumento
    const accNum = this.accountsData[0].accountNumber || 1; // Usar número de cuenta real


  }
}
