import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LoadingPopupComponent } from '../../shared/pop-ups/loading-pop-up/loading-popup.component';
import { Component, OnInit, inject } from '@angular/core';
import {
  OrderTableRow,
  RefundTableRow,
  RevenueApiResponse,
  SubscriptionTableRow,
} from './models/revenue';
import { Store } from '@ngrx/store';
import { statCardComponent } from '../report/components/statCard/stat_card.component';
import { RefundsTableComponent } from './components/refunds-table/refunds-table.component';
import { OrdersTableComponent } from './components/orders-table/orders-table.component';
import { SubscriptionsTableComponent } from './components/subscriptions-table/subscriptions-table.component';
import { selectUser } from '../auth/store/user.selectios';
import { User } from '../overview/models/overview';
import { AuthService } from '../../shared/services/auth.service';
import { BackendApiService } from '../../core/services/backend-api.service';

@Component({
  selector: 'app-revenue',
  imports: [
    CommonModule,
    LoadingPopupComponent,
    FormsModule,
    statCardComponent,
    RefundsTableComponent,
    OrdersTableComponent,
    SubscriptionsTableComponent,
  ],
  templateUrl: './revenue.component.html',
  styleUrl: './revenue.component.scss',
  standalone: true,
})
export class RevenueComponent implements OnInit {
  // Card data
  netRevenue: number = 0;
  mrr: number = 0;
  grossRevenue: number = 0;
  refunds: number = 0;
  activeSubscriptions: number = 0;

  // Table data
  orderTableData: OrderTableRow[] = [];
  subscriptionsTableData: SubscriptionTableRow[] = [];
  refundsTableData: RefundTableRow[] = [];

  loading = false;
  user: User | null = null;

  constructor(
    private store: Store,
    private authService: AuthService,
    private backendApi: BackendApiService
  ) {}

  /**
   * Initializes the component on load.
   *
   * Fetches user data from the store and loads revenue data from backend.
   *
   * @memberof RevenueComponent
   */
  ngOnInit(): void {
    this.getUserData();
  }

  /**
   * Fetches user data from the NgRx store.
   *
   * Subscribes to the selectUser selector to get current user information.
   * Once user is available, fetches revenue data from backend.
   *
   * Related to:
   * - Store.select(selectUser): Gets user from NgRx store
   * - fetchRevenueData(): Fetches revenue data from backend API
   *
   * @memberof RevenueComponent
   */
  getUserData() {
    this.store.select(selectUser).subscribe((userState) => {
      if (userState && userState.user) {
        this.user = userState.user;
        this.fetchRevenueData();
      }
    });
  }

  async fetchRevenueData() {
    if (!this.user?.id) {
      console.error('No user ID available');
      return;
    }

    this.loading = true;

    try {

      const bearerToken = await this.authService.getBearerTokenFirebase(this.user.id);
      const response = await this.backendApi.getRevenueData(bearerToken);

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to fetch revenue data');
      }

      const data: RevenueApiResponse = response.data;
      
      // Update card data
      this.netRevenue = data.netRevenue || 0;
      this.mrr = data.mrr || 0;
      this.grossRevenue = data.grossRevenue || 0;
      this.refunds = data.refunds || 0;
      this.activeSubscriptions = data.activeSubscriptions || 0;

      // El backend ya formatea todos los datos, usar directamente
      this.orderTableData = data.orders;
      this.subscriptionsTableData = data.subscriptions;
      this.refundsTableData = data.refundsTable;

    } catch (error: any) {
      console.error('❌ RevenueComponent: Error fetching revenue data:', error);
      console.error('❌ RevenueComponent: Error details:', {
        status: error?.status,
        message: error?.message,
        error: error?.error
      });
    } finally {
      this.loading = false;
    }
  }
}
