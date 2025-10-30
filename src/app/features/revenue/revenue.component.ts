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

  ngOnInit(): void {
    this.loadConfig();
    this.getUserData();
  }

  loadConfig() {
    this.revenueSummary = mockRevenueSummary;
    this.revenueDailyData = dailyRevenueMock;
    this.revenueMonthlyData = monthlyRevenueMock;
    this.revenueTableData = revenueTableMock;
    this.orderTableData = orderTableMock;
    this.subscriptionsTableData = subscriptionTableMock;
  }

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
