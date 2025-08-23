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

  constructor(private store: Store) {}

  ngOnInit(): void {
    this.loadConfig();
  }

  loadConfig() {
    this.revenueSummary = mockRevenueSummary;
    this.revenueDailyData = dailyRevenueMock;
    this.revenueMonthlyData = monthlyRevenueMock;
    this.revenueTableData = revenueTableMock;
    this.orderTableData = orderTableMock;
    this.subscriptionsTableData = subscriptionTableMock;
    this.getUsersData();
  }

  getUsersData() {}
}
