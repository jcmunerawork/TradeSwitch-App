import { Store } from '@ngrx/store';
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { statCardComponent } from '../report/components/statCard/stat_card.component';
import { OverviewService } from './services/overview.service';
import { overviewSubscriptionData, User } from './models/overview';
import { LoadingPopupComponent } from '../../shared/pop-ups/loading-pop-up/loading-popup.component';
import { FormsModule } from '@angular/forms';
import { TradeSwitchTableComponent } from './components/tradeSwitch-table/tradeSwitchTable.component';
import { TopListComponent } from './components/top-list/top-list.component';
import { RouterLink } from '@angular/router';
import { AppContextService } from '../../shared/context';
import { PlanService } from '../../shared/services/planService';
import { SubscriptionService } from '../../shared/services/subscription-service';

@Component({
  selector: 'app-overview',
  imports: [
    CommonModule,
    statCardComponent,
    LoadingPopupComponent,
    FormsModule,
    TradeSwitchTableComponent,
    TopListComponent,
    RouterLink,
  ],
  templateUrl: './overview.component.html',
  styleUrl: './overview.component.scss',
  standalone: true,
})
export class Overview {
  topUsers: User[] = [];
  constructor(
    private store: Store, 
    private overviewSvc: OverviewService,
    private appContext: AppContextService,
    private planService: PlanService,
    private subscriptionService: SubscriptionService
  ) {}

  loading = false;
  subscriptionsData: overviewSubscriptionData | null = null;
  usersData: User[] = [];
  newUsers = 0;
  newUsersGrowthPercentage = 0;
  calculatedRevenue = 0;
  paidSubscriptions = 0;

  // Export modal state
  showExportModal = false;
  exportStartDate: string = '';
  exportEndDate: string = '';
  exportError: string = '';
  showDateDropdown = false;
  // Calendar state (single-picker for range)
  calYear = 0;
  calMonth = 0; // 0-11
  weeks: { date: Date; inMonth: boolean }[][] = [];

  private buildCalendar(year: number, month: number) {
    // Start from Sunday of the week containing the 1st of the month
    const firstOfMonth = new Date(year, month, 1);
    const start = new Date(firstOfMonth);
    const day = start.getDay(); // 0 Sun .. 6 Sat
    start.setDate(start.getDate() - day);

    const grid: { date: Date; inMonth: boolean }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      grid.push({ date: d, inMonth: d.getMonth() === month });
    }
    // chunk into weeks
    this.weeks = [];
    for (let i = 0; i < 6; i++) {
      this.weeks.push(grid.slice(i * 7, i * 7 + 7));
    }
  }

  get monthLabel(): string {
    const m = new Date(this.calYear, this.calMonth, 1);
    return m.toLocaleString(undefined, { month: 'long', year: 'numeric' });
  }

  openExportModal() {
    this.showExportModal = true;
    this.exportError = '';
    const today = new Date();
    this.calYear = today.getFullYear();
    this.calMonth = today.getMonth();
    this.buildCalendar(this.calYear, this.calMonth);
  }

  ngOnInit(): void {
    this.subscribeToContextData();
    this.loadConfig();
  }

  private subscribeToContextData() {
    // Suscribirse a los datos de overview desde el contexto
    this.appContext.overviewData$.subscribe(data => {
      this.usersData = data.allUsers;
      // Convertir subscriptions a overviewSubscriptionData si es necesario
      this.subscriptionsData = data.subscriptions as any;
    });

    // Suscribirse a los estados de carga
    this.appContext.isLoading$.subscribe(loading => {
      this.loading = loading.overview;
    });
  }

  async loadConfig() {
    this.loading = true;
    await this.getUsersData();
    await this.calculateRevenue();
    this.getOverviewSubscriptionData();
  }

  async getUsersData() {
    return this.overviewSvc
      .getUsersData()
      .then((docSnap) => {
        if (docSnap && !docSnap.empty && docSnap.docs.length > 0) {
          this.usersData = docSnap.docs
            .map((doc) => doc.data() as User)
            .filter((user) => !user.isAdmin);

          // Calcular nuevos usuarios basándose en la fecha actual
          this.calculateNewUsers();
          this.filterTop10Users();
          this.loading = false;
        } else {
          this.loading = false;
          console.warn('No config');
        }
      })
      .catch((err) => {
        this.loading = false;

        console.error('Error to get the config', err);
      });
  }

  getOverviewSubscriptionData() {
    this.overviewSvc
      .getOverviewSubscriptionData()
      .then((docSnap) => {
        if (docSnap && !docSnap.empty && docSnap.docs.length > 0) {
          const data = docSnap.docs[0].data() as overviewSubscriptionData;
          this.subscriptionsData = data;
        } else {
          console.warn('No config');
        }
      })
      .catch((err) => {
        this.loading = false;

        console.error('Error to get the config', err);
      });
  }

  calculateNewUsers() {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    
    // Convertir las fechas a timestamps para comparar con subscription_date
    const startOfDayTimestamp = startOfDay.getTime();
    const endOfDayTimestamp = endOfDay.getTime();
    
    // Filtrar usuarios que se registraron hoy
    this.newUsers = this.usersData.filter(user => 
      user.subscription_date >= startOfDayTimestamp && 
      user.subscription_date < endOfDayTimestamp
    ).length;
    
    // Calcular el porcentaje de crecimiento
    this.calculateGrowthPercentage();
  }

  calculateGrowthPercentage() {
    const totalUsers = this.usersData.length;
    
    if (totalUsers === 0) {
      this.newUsersGrowthPercentage = 0;
      return;
    }
    
    // Calcular el porcentaje de nuevos usuarios respecto al total
    // (nuevos usuarios / total usuarios) * 100
    this.newUsersGrowthPercentage = (this.newUsers / totalUsers) * 100;
    
    // Redondear a 1 decimal
    this.newUsersGrowthPercentage = Math.round(this.newUsersGrowthPercentage * 10) / 10;
  }

  async calculateRevenue() {
    try {
      // Cargar todos los planes
      const plans = await this.planService.getAllPlans();
      
      if (plans.length === 0) {
        this.calculatedRevenue = 0;
        return;
      }

      // Mapa para contar usuarios por plan
      const planUserCountMap: { [planId: string]: number } = {};
      
      // Inicializar contadores para cada plan
      plans.forEach(plan => {
        planUserCountMap[plan.id] = 0;
      });

      // Recorrer todos los usuarios y obtener sus subscriptions
      for (const user of this.usersData) {
        try {
          const subscription = await this.subscriptionService.getUserLatestSubscription(user.id);
          
          if (subscription && subscription.planId) {
            if (planUserCountMap.hasOwnProperty(subscription.planId)) {
              planUserCountMap[subscription.planId]++;
            }
          }
        } catch (error) {
          console.error(`Error obteniendo subscription para usuario ${user.id}:`, error);
        }
      }

      // Calcular el revenue total y contar usuarios con suscripciones pagas
      let totalRevenue = 0;
      let paidUsersCount = 0;
      
      for (const plan of plans) {
        const userCount = planUserCountMap[plan.id] || 0;
        const planPrice = parseFloat(plan.price) || 0;
        const revenueForPlan = userCount * planPrice;
        totalRevenue += revenueForPlan;
        
        // Si el plan tiene precio > 0, contar esos usuarios como suscripciones pagas
        if (planPrice > 0 && userCount > 0) {
          paidUsersCount += userCount;
        }
      }

      this.calculatedRevenue = totalRevenue;
      this.paidSubscriptions = paidUsersCount;
    } catch (error) {
      console.error('Error calculando revenue:', error);
      this.calculatedRevenue = 0;
    }
  }

  filterTop10Users() {
    this.topUsers = this.usersData
      .filter((user) => user.profit > 0)
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 10);
  }

  // ===== Export Data by Date =====

  closeExportModal() {
    this.showExportModal = false;
    this.exportStartDate = '';
    this.exportEndDate = '';
    this.exportError = '';
    this.showDateDropdown = false;
  }

  onExportDateChange() {
    // No hard validation for end-only; UX requires start first
    if (!this.exportStartDate && this.exportEndDate) {
      // reset end if start not picked yet
      this.exportEndDate = '';
    }
    this.exportError = '';
  }

  prevMonth() {
    const d = new Date(this.calYear, this.calMonth - 1, 1);
    this.calYear = d.getFullYear();
    this.calMonth = d.getMonth();
    this.buildCalendar(this.calYear, this.calMonth);
  }

  nextMonth() {
    const d = new Date(this.calYear, this.calMonth + 1, 1);
    this.calYear = d.getFullYear();
    this.calMonth = d.getMonth();
    this.buildCalendar(this.calYear, this.calMonth);
  }

  onDayPick(day: Date) {
    const iso = (d: Date) => this.formatLocalDate(d);
    if (!this.exportStartDate) {
      this.exportStartDate = iso(day);
      this.exportEndDate = '';
      return;
    }
    const start = this.parseLocalDate(this.exportStartDate);
    if (!this.exportEndDate) {
      if (day < start) {
        // If clicked before start, move start to that day
        this.exportStartDate = iso(day);
      } else {
        this.exportEndDate = iso(day);
      }
      return;
    }
    // If both set, start a new selection
    this.exportStartDate = iso(day);
    this.exportEndDate = '';
  }

  isSelected(day: Date): boolean {
    if (!this.exportStartDate && !this.exportEndDate) return false;
    const time = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
    const start = this.exportStartDate
      ? this.parseLocalDate(this.exportStartDate).setHours(0, 0, 0, 0)
      : Number.NaN;
    const end = this.exportEndDate
      ? this.parseLocalDate(this.exportEndDate).setHours(23, 59, 59, 999)
      : start;
    return time >= start && time <= end;
  }

  exportDataAsCSV() {
    // Determine range
    let startTs: number | null = null;
    let endTs: number | null = null;

    if (this.exportStartDate) {
      const start = this.parseLocalDate(this.exportStartDate);
      // start of day
      startTs = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
      if (this.exportEndDate) {
        const end = this.parseLocalDate(this.exportEndDate);
        // end of day (inclusive)
        endTs = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999).getTime();
      } else {
        // If only start provided, range is only that day
        endTs = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59, 59, 999).getTime();
      }
    }

    // Filter users by subscription_date (fallback to lastUpdated if needed)
    const filtered = this.usersData.filter(u => {
      const ts = (u.subscription_date ?? u.lastUpdated) || 0;
      if (startTs !== null && endTs !== null) {
        return ts >= startTs && ts <= endTs;
      }
      return true; // no dates -> export all
    });

    const rows: string[] = [];
    // Header
    rows.push([
      'User ID', 'First Name', 'Last Name', 'Email', 'Status', 'Strategies', 'Trading Accounts', '% Strat Followed', 'Net PnL', 'Profit', 'Best Trade', 'Subscription Date'
    ].join(','));

    // Data
    for (const u of filtered) {
      const subDate = u.subscription_date ? new Date(u.subscription_date).toISOString() : '';
      rows.push([
        `${u.id ?? ''}`,
        this.escapeCsv(u.firstName ?? ''),
        this.escapeCsv(u.lastName ?? ''),
        this.escapeCsv(u.email ?? ''),
        `${u.status ?? ''}`,
        `${u.strategies ?? 0}`,
        `${u.trading_accounts ?? 0}`,
        `${u.strategy_followed ?? 0}`,
        `${u.netPnl ?? 0}`,
        `${u.profit ?? 0}`,
        `${u.best_trade ?? 0}`,
        subDate,
      ].join(','));
    }

    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const filename = this.exportStartDate || this.exportEndDate ? `export_${Date.now()}.csv` : 'export_all.csv';
    link.setAttribute('download', filename);
    link.click();
    URL.revokeObjectURL(url);

    this.closeExportModal();
  }

  private escapeCsv(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return '"' + value.replace(/\"/g, '\"\"') + '"';
    }
    return value;
  }

  private formatLocalDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private parseLocalDate(s: string): Date {
    // Expecting YYYY-MM-DD
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }
}
