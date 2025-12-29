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
import { RevenueGraphComponent } from './components/revenueGraph/revenue-graph.component';
import { RefundsTableComponent } from './components/refunds-table/refunds-table.component';
import { OrdersTableComponent } from './components/orders-table/orders-table.component';
import { SubscriptionsTableComponent } from './components/subscriptions-table/subscriptions-table.component';
import { selectUser } from '../auth/store/user.selectios';
import { User } from '../overview/models/overview';
import { AuthService } from '../../shared/services/auth.service';
import { ConfigService } from '../../core/services/config.service';

@Component({
  selector: 'app-revenue',
  imports: [
    CommonModule,
    LoadingPopupComponent,
    FormsModule,
    statCardComponent,
    RevenueGraphComponent,
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
  private configService = inject(ConfigService);

  constructor(
    private store: Store,
    private authService: AuthService
  ) {}

  /**
   * Initializes the component on load.
   *
   * Loads configuration (mock data) and fetches user data from the store.
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
      
      const response = await fetch(`${this.configService.apiUrl}/admin-dashboard/revenue`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${bearerToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: RevenueApiResponse = await response.json();
      
      // Update card data
      this.netRevenue = data.netRevenue || 0;
      this.mrr = data.mrr || 0;
      this.grossRevenue = data.grossRevenue || 0;
      this.refunds = data.refunds || 0;
      this.activeSubscriptions = data.activeSubscriptions || 0;

      // Transform orders data
      this.orderTableData = data.orders.map(order => ({
        date: this.formatTimestamp(order.date),
        value: order.value,
        concepto: order.concepto,
        paid: order.paid,
        method: this.capitalizeFirst(order.method),
        status: order.status
      }));

      // Transform subscriptions data
      this.subscriptionsTableData = data.subscriptions.map(sub => ({
        status: sub.status,
        canceladaAFinalDePeriodo: sub.canceladaAFinalDePeriodo,
        valor: sub.valor,
        item: this.capitalizeFirst(sub.item),
        user: sub.user,
        startDate: this.formatTimestamp(sub.startDate),
        actualPeriodStart: this.formatTimestamp(sub.actualPeriodStart),
        actualPeriodEnd: this.formatTimestamp(sub.actualPeriodEnd)
      }));

      // Transform refunds data
      this.refundsTableData = data.refundsTable.map(refund => ({
        created: this.formatTimestamp(refund.created),
        amount: refund.amount,
        destination: this.capitalizeFirst(refund.destination),
        status: this.formatRefundStatus(refund.status)
      }));

    } catch (error) {
      console.error('Error fetching revenue data:', error);
    } finally {
      this.loading = false;
    }
  }

  formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  capitalizeFirst(str: string): string {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  formatRefundStatus(status: string): string {
    return status
      .split('_')
      .map(word => this.capitalizeFirst(word))
      .join(' ');
  }
}
