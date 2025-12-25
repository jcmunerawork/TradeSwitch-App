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

/**
 * Main overview component for displaying dashboard statistics and user data.
 * 
 * This component provides a comprehensive dashboard view that includes:
 * - User statistics and metrics
 * - Revenue calculations based on subscriptions
 * - Top 10 users by profit
 * - Subscription data overview
 * - CSV export functionality with date range selection
 * 
 * Related to:
 * - OverviewService: Fetches user and subscription data
 * - AppContextService: Manages global overview data state
 * - PlanService: Gets plan information for revenue calculation
 * - SubscriptionService: Gets user subscription data
 * - TradeSwitchTableComponent: Displays user table with filtering
 * - TopListComponent: Displays top users list
 * 
 * @component
 * @selector app-overview
 * @standalone true
 */
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
  /** Top 10 users sorted by profit */
  topUsers: User[] = [];
  
  /**
   * Constructor for Overview component.
   * 
   * @param store - NgRx Store (injected but not currently used)
   * @param overviewSvc - Service for fetching overview data
   * @param appContext - Application context service for global state management
   * @param planService - Service for fetching plan information
   * @param subscriptionService - Service for fetching subscription data
   */
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

  // Loading granular por sección
  private loadingStates = {
    users: false,
    cards: false,
    revenue: false,
    subscriptions: false,
  };

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

  /**
   * Builds a calendar grid for the export date picker.
   * 
   * Creates a 6-week grid (42 days) starting from the Sunday of the week
   * containing the first day of the specified month. Each day is marked
   * with whether it belongs to the current month.
   * 
   * @private
   * @param year - Year for the calendar
   * @param month - Month for the calendar (0-11, where 0 is January)
   * @memberof Overview
   */
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

  /**
   * Gets the formatted month and year label for the calendar.
   * 
   * @returns Formatted string like "January 2024"
   * @memberof Overview
   */
  get monthLabel(): string {
    const m = new Date(this.calYear, this.calMonth, 1);
    return m.toLocaleString(undefined, { month: 'long', year: 'numeric' });
  }

  /**
   * Opens the export modal and initializes the calendar to current month.
   * 
   * Resets export error and builds the calendar for the current date.
   * 
   * @memberof Overview
   */
  openExportModal() {
    this.showExportModal = true;
    this.exportError = '';
    const today = new Date();
    this.calYear = today.getFullYear();
    this.calMonth = today.getMonth();
    this.buildCalendar(this.calYear, this.calMonth);
  }

  /**
   * Initializes the component on load.
   * 
   * Subscribes to context data and loads all configuration data
   * including users, revenue, and subscription information.
   * 
   * @memberof Overview
   */
  ngOnInit(): void {
    this.subscribeToContextData();
    this.loadConfig();
  }

  /**
   * Subscribes to overview data from the application context.
   * 
   * Listens to changes in overview data (users and subscriptions)
   * and updates local component state when data changes.
   * 
   * Related to:
   * - AppContextService.overviewData$: Observable of overview data
   * 
   * @private
   * @memberof Overview
   */
  private subscribeToContextData() {
    // Suscribirse a los datos de overview desde el contexto
    this.appContext.overviewData$.subscribe(data => {
      this.usersData = data.allUsers;
      // Convertir subscriptions a overviewSubscriptionData si es necesario
      this.subscriptionsData = data.subscriptions as any;
    });

    // No usamos el loading global del contexto aquí; control fino local
  }

  /**
   * Loads all configuration data for the overview dashboard.
   * 
   * Performs the following operations in sequence:
   * 1. Resets all loading states
   * 2. Loads user data
   * 3. Calculates revenue
   * 4. Loads subscription overview data
   * 5. Checks if all data is loaded to hide loading indicator
   * 
   * Related to:
   * - getUsersData(): Fetches and processes user data
   * - calculateRevenue(): Calculates total revenue from subscriptions
   * - getOverviewSubscriptionData(): Fetches subscription statistics
   * - checkAllLoaded(): Verifies all data is loaded
   * 
   * @async
   * @memberof Overview
   */
  async loadConfig() {
    this.loading = true;
    this.loadingStates = { users: false, cards: false, revenue: false, subscriptions: false };
    await this.getUsersData();
    await this.calculateRevenue();
    this.getOverviewSubscriptionData();
    this.checkAllLoaded();
  }

  /**
   * Fetches user data from Firebase and processes it.
   * 
   * Retrieves all users, filters out admin users, calculates new users
   * for today, and filters top 10 users by profit. Updates loading
   * states when complete.
   * 
   * Related to:
   * - OverviewService.getUsersData(): Fetches users from Firebase
   * - calculateNewUsers(): Calculates new users registered today
   * - filterTop10Users(): Filters and sorts top users by profit
   * 
   * @async
   * @memberof Overview
   */
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
          this.loadingStates.users = true;
          this.loadingStates.cards = true; // top users y métricas listas
          this.checkAllLoaded();
        } else {
          this.loadingStates.users = true;
          this.loadingStates.cards = true;
          this.checkAllLoaded();
          console.warn('No config');
        }
      })
      .catch((err) => {
        this.loadingStates.users = true;
        this.loadingStates.cards = true;
        this.checkAllLoaded();
      });
  }

  /**
   * Fetches overview subscription data from Firebase.
   * 
   * Retrieves subscription statistics including monthly revenue
   * and user counts. Updates loading state when complete.
   * 
   * Related to:
   * - OverviewService.getOverviewSubscriptionData(): Fetches subscription data
   * 
   * @memberof Overview
   */
  getOverviewSubscriptionData() {
    this.overviewSvc
      .getOverviewSubscriptionData()
      .then((docSnap) => {
        if (docSnap && !docSnap.empty && docSnap.docs.length > 0) {
          const data = docSnap.docs[0].data() as overviewSubscriptionData;
          this.subscriptionsData = data;
          this.loadingStates.subscriptions = true;
          this.checkAllLoaded();
        } else {
          console.warn('No config');
          this.loadingStates.subscriptions = true;
          this.checkAllLoaded();
        }
      })
      .catch((err) => {
        this.loadingStates.subscriptions = true;
        this.checkAllLoaded();

        console.error('Error to get the config', err);
      });
  }

  /**
   * Calculates the number of new users registered today.
   * 
   * Filters users by subscription_date to find users registered
   * between start and end of current day. Then calculates growth
   * percentage.
   * 
   * Related to:
   * - calculateGrowthPercentage(): Calculates percentage of new users
   * 
   * @memberof Overview
   */
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

  /**
   * Calculates the growth percentage of new users.
   * 
   * Computes the percentage of new users relative to total users.
   * Rounds to 1 decimal place. Returns 0 if there are no users.
   * 
   * Formula: (newUsers / totalUsers) * 100
   * 
   * @memberof Overview
   */
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

  /**
   * Calculates total revenue from user subscriptions.
   * 
   * This method:
   * 1. Loads all available plans
   * 2. Counts users per plan by checking their latest subscription
   * 3. Calculates revenue for each plan (userCount * planPrice)
   * 4. Sums total revenue across all plans
   * 5. Counts users with paid subscriptions (plans with price > 0)
   * 
   * Related to:
   * - PlanService.getAllPlans(): Gets all subscription plans
   * - SubscriptionService.getUserLatestSubscription(): Gets user's current plan
   * 
   * @async
   * @memberof Overview
   */
  async calculateRevenue() {
    try {
      // Cargar todos los planes
      const plans = await this.planService.getAllPlans();
      
      if (plans.length === 0) {
        this.calculatedRevenue = 0;
        this.loadingStates.revenue = true;
        this.checkAllLoaded();
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
      this.loadingStates.revenue = true;
      this.checkAllLoaded();
    } catch (error) {
      console.error('Error calculando revenue:', error);
      this.calculatedRevenue = 0;
      this.loadingStates.revenue = true;
      this.checkAllLoaded();
    }
  }

  /**
   * Filters and sorts users to get top 10 by profit.
   * 
   * Filters users with profit > 0, sorts them in descending order
   * by profit, and takes the first 10 users.
   * 
   * @memberof Overview
   */
  filterTop10Users() {
    this.topUsers = this.usersData
      .filter((user) => user.profit > 0)
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 10);
  }

  /**
   * Checks if all data sections have finished loading.
   * 
   * Verifies that users, cards, revenue, and subscriptions data
   * are all loaded. If all are loaded, hides the main loading indicator.
   * 
   * @private
   * @memberof Overview
   */
  private checkAllLoaded() {
    const allLoaded = this.loadingStates.users && this.loadingStates.cards && this.loadingStates.revenue && this.loadingStates.subscriptions;
    if (allLoaded) {
      this.loading = false;
    }
  }

  // ===== Export Data by Date =====

  /**
   * Closes the export modal and resets all export-related state.
   * 
   * Clears export dates, errors, and hides the date dropdown.
   * 
   * @memberof Overview
   */
  closeExportModal() {
    this.showExportModal = false;
    this.exportStartDate = '';
    this.exportEndDate = '';
    this.exportError = '';
    this.showDateDropdown = false;
  }

  /**
   * Handles date change in export modal.
   * 
   * Resets end date if start date is not selected yet (UX requirement).
   * Clears any export errors.
   * 
   * @memberof Overview
   */
  onExportDateChange() {
    // No hard validation for end-only; UX requires start first
    if (!this.exportStartDate && this.exportEndDate) {
      // reset end if start not picked yet
      this.exportEndDate = '';
    }
    this.exportError = '';
  }

  /**
   * Navigates to the previous month in the calendar.
   * 
   * Updates calendar year and month, then rebuilds the calendar grid.
   * 
   * @memberof Overview
   */
  prevMonth() {
    const d = new Date(this.calYear, this.calMonth - 1, 1);
    this.calYear = d.getFullYear();
    this.calMonth = d.getMonth();
    this.buildCalendar(this.calYear, this.calMonth);
  }

  /**
   * Navigates to the next month in the calendar.
   * 
   * Updates calendar year and month, then rebuilds the calendar grid.
   * 
   * @memberof Overview
   */
  nextMonth() {
    const d = new Date(this.calYear, this.calMonth + 1, 1);
    this.calYear = d.getFullYear();
    this.calMonth = d.getMonth();
    this.buildCalendar(this.calYear, this.calMonth);
  }

  /**
   * Handles day selection in the calendar for date range picker.
   * 
   * Implements a two-click date range selection:
   * - First click: Sets start date
   * - Second click: Sets end date (if after start) or moves start (if before)
   * - Third click: Starts new selection
   * 
   * @param day - Selected date from calendar
   * @memberof Overview
   */
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

  /**
   * Checks if a calendar day is within the selected date range.
   * 
   * Returns true if the day falls between start and end dates
   * (inclusive). Handles cases where only start date is selected.
   * 
   * @param day - Date to check
   * @returns true if day is in selected range, false otherwise
   * @memberof Overview
   */
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

  /**
   * Exports user data to CSV file with optional date filtering.
   * 
   * This method:
   * 1. Determines date range from selected dates (or exports all if no dates)
   * 2. Filters users by subscription_date within the range
   * 3. Generates CSV content with headers and user data
   * 4. Creates a downloadable blob and triggers download
   * 5. Closes the export modal
   * 
   * CSV includes: User ID, Name, Email, Status, Strategies, Trading Accounts,
   * Strategy Followed %, Net PnL, Profit, Best Trade, Subscription Date
   * 
   * Related to:
   * - parseLocalDate(): Parses date strings
   * - escapeCsv(): Escapes special characters in CSV values
   * - closeExportModal(): Closes modal after export
   * 
   * @memberof Overview
   */
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

    if (filtered.length === 0) {
      this.exportError = 'No users found for the selected date range.';
      return;
    }

    const rows: string[] = [];
    // Header - matching the table columns and additional useful data
    rows.push([
      'User ID',
      'First Name',
      'Last Name',
      'Email',
      'Phone Number',
      'Status',
      '% Strategy Followed',
      'Strategies',
      'Trading Accounts',
      'Net P&L',
      'Profit',
      'Best Trade',
      'Number of Trades',
      'Total Spend',
      'Subscription Date',
      'Last Updated'
    ].join(','));

    // Data
    for (const u of filtered) {
      // Calculate status like in the table component
      const displayStatus = this.getDisplayStatus(u);
      
      // Format subscription date
      const subDate = u.subscription_date 
        ? new Date(u.subscription_date).toISOString().split('T')[0] 
        : '';
      
      // Format last updated date
      const lastUpdatedDate = u.lastUpdated 
        ? new Date(u.lastUpdated).toISOString().split('T')[0] 
        : '';

      rows.push([
        `${u.id ?? ''}`,
        this.escapeCsv(u.firstName ?? ''),
        this.escapeCsv(u.lastName ?? ''),
        this.escapeCsv(u.email ?? ''),
        this.escapeCsv(u.phoneNumber ?? ''),
        displayStatus,
        u.strategy_followed !== undefined ? `${u.strategy_followed}` : '',
        `${u.strategies ?? 0}`,
        `${u.trading_accounts ?? 0}`,
        `${u.netPnl ?? 0}`,
        `${u.profit ?? 0}`,
        `${u.best_trade ?? 0}`,
        `${u.number_trades ?? 0}`,
        `${u.total_spend ?? 0}`,
        subDate,
        lastUpdatedDate,
      ].join(','));
    }

    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateRange = this.exportStartDate && this.exportEndDate 
      ? `${this.exportStartDate}_to_${this.exportEndDate}`
      : this.exportStartDate 
        ? this.exportStartDate
        : 'all';
    const filename = `users_export_${dateRange}_${Date.now()}.csv`;
    link.setAttribute('download', filename);
    link.click();
    URL.revokeObjectURL(url);

    this.closeExportModal();
  }

  /**
   * Determines status class for a user.
   * 
   * Returns 'banned' if user is banned, 'created' if all values are zero,
   * or 'active' if user has activity.
   * 
   * @param user - User object to determine status for
   * @returns Status class string ('banned', 'created', or 'active')
   * @memberof Overview
   */
  private statusClass(user: User): string {
    // Si el status es banned, retornar banned
    if (String(user.status) === 'banned') {
      return 'banned';
    }
    
    // Verificar si todos los valores están en 0
    const allValuesZero = 
      (user.trading_accounts ?? 0) === 0 &&
      (user.strategies ?? 0) === 0 &&
      (user.strategy_followed ?? 0) === 0 &&
      (user.netPnl ?? 0) === 0 &&
      (user.profit ?? 0) === 0 &&
      (user.number_trades ?? 0) === 0 &&
      (user.total_spend ?? 0) === 0;
    
    // Si todos los valores están en 0, retornar created
    if (allValuesZero) {
      return 'created';
    }
    
    // Si no todos están en 0, retornar active
    return 'active';
  }

  /**
   * Gets display status string with capitalized first letter.
   * 
   * @param user - User object to get status for
   * @returns Capitalized status string (e.g., "Active", "Created", "Banned")
   * @memberof Overview
   */
  private getDisplayStatus(user: User): string {
    const status = this.statusClass(user);
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  /**
   * Escapes special characters in CSV values.
   * 
   * Wraps value in quotes if it contains comma, quote, or newline.
   * Doubles any quotes within the value.
   * 
   * @private
   * @param value - String value to escape
   * @returns Escaped CSV value
   * @memberof Overview
   */
  private escapeCsv(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return '"' + value.replace(/\"/g, '\"\"') + '"';
    }
    return value;
  }

  /**
   * Formats a Date object to YYYY-MM-DD string format.
   * 
   * @private
   * @param d - Date to format
   * @returns Formatted date string (YYYY-MM-DD)
   * @memberof Overview
   */
  private formatLocalDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /**
   * Parses a YYYY-MM-DD string to a Date object.
   * 
   * @private
   * @param s - Date string in YYYY-MM-DD format
   * @returns Parsed Date object
   * @memberof Overview
   */
  private parseLocalDate(s: string): Date {
    // Expecting YYYY-MM-DD
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }
}
