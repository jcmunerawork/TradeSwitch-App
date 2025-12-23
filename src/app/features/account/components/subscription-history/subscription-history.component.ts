import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { User } from '../../../overview/models/overview';
import { selectUser } from '../../../auth/store/user.selectios';
import { SubscriptionService } from '../../../../shared/services/subscription-service';
import { PlanService } from '../../../../shared/services/planService';
import { Subscription } from '../../../../shared/services/subscription-service';
import { Plan } from '../../../../shared/services/planService';
import { UserStatus } from '../../../overview/models/overview';

/**
 * Component to display user subscription history.
 * 
 * This component allows the user to:
 * - View subscription history
 * - Filter subscriptions by plan, date and search term
 * - Paginate results
 * - View details of each subscription (plan, status, date, amount)
 * 
 * Related to:
 * - AccountComponent: Displayed in "Subscription History" tab (currently commented)
 * - SubscriptionService: Gets user subscriptions
 * - PlanService: Gets plan information to display names
 * - Store (NgRx): Gets current user
 * 
 * Features:
 * - Search by subscription ID
 * - Filters by plan and date range
 * - Result pagination
 * - Date and currency formatting
 * - Mapping subscription statuses to CSS classes and readable text
 * 
 * NOTE: This component is currently commented in AccountComponent template.
 * 
 * @component
 * @selector app-subscription-history
 * @standalone true
 */
@Component({
  selector: 'app-subscription-history',
  imports: [CommonModule, FormsModule],
  templateUrl: './subscription-history.component.html',
  styleUrl: './subscription-history.component.scss',
  standalone: true,
})
export class SubscriptionHistoryComponent implements OnInit {
  user: User | null = null;
  subscriptions: Subscription[] = [];
  filteredSubscriptions: Subscription[] = [];
  plans: Plan[] = [];
  plansMap: { [key: string]: Plan } = {};
  
  // Pagination
  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 0;
  
  // Filters
  searchTerm = '';
  showFilter = false;
  selectedPlan = '';
  dateFrom = '';
  dateTo = '';
  
  planNames: string[] = [];
  
  // Loading state
  isLoading = false;

  // Inyectar servicios
  private subscriptionService = inject(SubscriptionService);
  private planService = inject(PlanService);

  constructor(private store: Store) {}

  async ngOnInit(): Promise<void> {
    this.getUserData();
    await this.loadPlans();
  }

  /**
   * Gets current user data from NgRx store.
   * 
   * Subscribes to selectUser selector and when user is obtained,
   * loads user subscriptions.
   * 
   * Related to:
   * - Store.select(selectUser): NgRx selector to get user
   * - loadPayments(): Loads subscriptions when user exists
   * 
   * @private
   * @memberof SubscriptionHistoryComponent
   */
  private getUserData(): void {
    this.store.select(selectUser).subscribe({
      next: (userData) => {
        this.user = userData.user;
        if (this.user) {
          this.loadPayments();
        }
      },
      error: (err) => {
        console.error('Error fetching user data', err);
      },
    });
  }

  /**
   * Loads all available plans from PlanService.
   * 
   * This method:
   * 1. Gets all plans from PlanService
   * 2. Creates an array of plan names for filters
   * 3. Creates a plan map (by ID) for quick lookup
   * 
   * Related to:
   * - PlanService.getAllPlans(): Gets all plans
   * - getPlanName(): Uses plansMap to get plan names
   * 
   * @private
   * @async
   * @memberof SubscriptionHistoryComponent
   */
  private async loadPlans(): Promise<void> {
    try {      
      this.plans = await this.planService.getAllPlans();
      this.planNames = this.plans.map(plan => plan.name);
      
      // Crear mapa de planes para búsqueda rápida por ID
      this.plansMap = {};
      this.plans.forEach(plan => {
        this.plansMap[plan.id] = plan;
      });
    } catch (error) {
      console.error('Error loading plans:', error);
    }
  }

  /**
   * Loads user subscriptions from SubscriptionService.
   * 
   * Gets user's most recent subscription and displays it
   * in the list. Currently only loads one subscription (the most recent).
   * 
   * Related to:
   * - SubscriptionService.getUserLatestSubscription(): Gets most recent subscription
   * - calculatePagination(): Calculates pagination after loading
   * 
   * @private
   * @async
   * @memberof SubscriptionHistoryComponent
   */
  private async loadPayments(): Promise<void> {
    if (!this.user) return;
    
    this.isLoading = true;
    try {
      const latest = await this.subscriptionService.getUserLatestSubscription(this.user.id);
      this.subscriptions = latest ? [latest] : [];
      this.filteredSubscriptions = [...this.subscriptions];
      this.calculatePagination();
    } catch (error) {
      console.error('Error loading subscriptions:', error);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Calculates total number of pages based on filtered results.
   * 
   * If current page is greater than total pages,
   * resets to page 1.
   * 
   * @private
   * @memberof SubscriptionHistoryComponent
   */
  private calculatePagination(): void {
    this.totalPages = Math.ceil(this.filteredSubscriptions.length / this.itemsPerPage);
    if (this.currentPage > this.totalPages) {
      this.currentPage = 1;
    }
  }

  /**
   * Getter that returns paginated subscriptions for current page.
   * 
   * Calculates range of subscriptions to display based on:
   * - currentPage: Current page
   * - itemsPerPage: Number of items per page
   * 
   * @returns Array of subscriptions for current page
   * @memberof SubscriptionHistoryComponent
   */
  get paginatedSubscriptions(): Subscription[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return this.filteredSubscriptions.slice(startIndex, endIndex);
  }

  /**
   * Executes when search term changes.
   * 
   * Applies current filters (including new search term).
   * 
   * @memberof SubscriptionHistoryComponent
   */
  onSearchChange(): void {
    this.applyFilters();
  }

  /**
   * Shows or hides filter panel.
   * 
   * @memberof SubscriptionHistoryComponent
   */
  openFilter(): void {
    this.showFilter = !this.showFilter;
  }

  /**
   * Applies all active filters to subscriptions.
   * 
   * This method filters subscriptions according to:
   * - Search term: Searches in subscription ID
   * - Date from: Filters subscriptions from a specific date
   * - Date to: Filters subscriptions until a specific date
   * 
   * After filtering, recalculates pagination and resets to page 1.
   * 
   * @memberof SubscriptionHistoryComponent
   */
  applyFilters(): void {
    let filtered = [...this.subscriptions];

    // Search filter
    if (this.searchTerm) {
      filtered = filtered.filter(subscription => 
        subscription.id?.toLowerCase().includes(this.searchTerm.toLowerCase())
      );
    }

    // Date filters
    if (this.dateFrom) {
      const fromDate = new Date(this.dateFrom);
      filtered = filtered.filter(subscription => {
        const subscriptionDate = subscription.created_at.toDate();
        return subscriptionDate >= fromDate;
      });
    }

    if (this.dateTo) {
      const toDate = new Date(this.dateTo);
      toDate.setHours(23, 59, 59, 999); // End of day
      filtered = filtered.filter(subscription => {
        const subscriptionDate = subscription.created_at.toDate();
        return subscriptionDate <= toDate;
      });
    }

    this.filteredSubscriptions = filtered;
    this.calculatePagination();
    this.currentPage = 1;
  }

  /**
   * Clears all active filters.
   * 
   * Resets all filter fields (search, plan, dates)
   * and reapplies filters (showing all results).
   * 
   * @memberof SubscriptionHistoryComponent
   */
  clearFilters(): void {
    this.searchTerm = '';
    this.selectedPlan = '';
    this.dateFrom = '';
    this.dateTo = '';
    this.applyFilters();
  }

  /**
   * Navigates to previous page.
   * 
   * Only navigates if there's a previous page (currentPage > 1).
   * 
   * @memberof SubscriptionHistoryComponent
   */
  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  /**
   * Navigates to next page.
   * 
   * Only navigates if there's a next page (currentPage < totalPages).
   * 
   * @memberof SubscriptionHistoryComponent
   */
  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  /**
   * Navigates directly to a specific page.
   * 
   * Validates that page is within valid range (1 to totalPages).
   * 
   * @param page - Page number to navigate to
   * @memberof SubscriptionHistoryComponent
   */
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  /**
   * Gets plan name by its ID.
   * 
   * Searches for plan in plan map (plansMap) and returns its name.
   * If not found, returns "Unknown Plan".
   * 
   * Related to:
   * - plansMap: Plan map created in loadPlans()
   * 
   * @param planId - Plan ID
   * @returns Plan name or "Unknown Plan" if not found
   * @memberof SubscriptionHistoryComponent
   */
  getPlanName(planId: string): string {
    const plan = this.plansMap[planId];
    return plan ? plan.name : 'Unknown Plan';
  }



  /**
   * Converts subscription status to readable text for display.
   * 
   * Maps UserStatus states to more friendly text:
   * - PURCHASED → "Completed"
   * - PENDING → "Pending"
   * - PROCESSING → "Processing"
   * - CANCELLED → "Cancelled"
   * - EXPIRED → "Expired"
   * - BANNED → "Banned"
   * - ADMIN → "Admin"
   * - CREATED → "Created"
   * 
   * @param status - Subscription status (UserStatus)
   * @returns Readable status text
   * @memberof SubscriptionHistoryComponent
   */
  getStatusDisplay(status: string): string {
    const statusMap: { [key: string]: string } = {
      [UserStatus.PURCHASED]: 'Completed',
      [UserStatus.PENDING]: 'Pending',
      [UserStatus.PROCESSING]: 'Processing',
      [UserStatus.CANCELLED]: 'Cancelled',
      [UserStatus.EXPIRED]: 'Expired',
      [UserStatus.BANNED]: 'Banned',
      [UserStatus.ADMIN]: 'Admin',
      [UserStatus.CREATED]: 'Created'
    };
    return statusMap[status] || status;
  }

  /**
   * Gets CSS class corresponding to subscription status.
   * 
   * Maps UserStatus states to CSS classes for styling:
   * - PURCHASED → "completed"
   * - PENDING → "pending"
   * - PROCESSING → "processing"
   * - CANCELLED → "cancelled"
   * - EXPIRED → "expired"
   * - BANNED → "banned"
   * - ADMIN → "admin"
   * - CREATED → "created"
   * 
   * @param status - Subscription status (UserStatus)
   * @returns CSS class name
   * @memberof SubscriptionHistoryComponent
   */
  getStatusClass(status: string): string {
    const statusClassMap: { [key: string]: string } = {
      [UserStatus.PURCHASED]: 'completed',
      [UserStatus.PENDING]: 'pending',
      [UserStatus.PROCESSING]: 'processing',
      [UserStatus.CANCELLED]: 'cancelled',
      [UserStatus.EXPIRED]: 'expired',
      [UserStatus.BANNED]: 'banned',
      [UserStatus.ADMIN]: 'admin',
      [UserStatus.CREATED]: 'created'
    };
    return statusClassMap[status] || 'unknown';
  }

  /**
   * Formats a date for display in the interface.
   * 
   * Handles both Firebase Timestamp objects and Date objects.
   * Formats date in readable format (e.g.: "Jan 15, 2024, 10:30 AM").
   * 
   * @param date - Date to format (can be Firebase Timestamp or Date)
   * @returns Formatted date or "N/A" if no date
   * @memberof SubscriptionHistoryComponent
   */
  formatDate(date: any): string {
    if (!date) return 'N/A';
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Formats an amount as currency according to provided currency code.
   * 
   * Uses Intl.NumberFormat to format amount with corresponding
   * currency symbol.
   * 
   * @param amount - Amount to format
   * @param currency - Currency code (e.g.: "usd", "eur")
   * @returns Amount formatted as currency (e.g.: "$99.00")
   * @memberof SubscriptionHistoryComponent
   */
  formatCurrency(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amount);
  }
}
