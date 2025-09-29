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

  private async loadPayments(): Promise<void> {
    if (!this.user) return;
    
    this.isLoading = true;
    try {
      this.subscriptions = await this.subscriptionService.getAllSubscriptionsByUserId(this.user.id);
      this.filteredSubscriptions = [...this.subscriptions];
      this.calculatePagination();
    } catch (error) {
      console.error('Error loading subscriptions:', error);
    } finally {
      this.isLoading = false;
    }
  }

  private calculatePagination(): void {
    this.totalPages = Math.ceil(this.filteredSubscriptions.length / this.itemsPerPage);
    if (this.currentPage > this.totalPages) {
      this.currentPage = 1;
    }
  }

  get paginatedSubscriptions(): Subscription[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return this.filteredSubscriptions.slice(startIndex, endIndex);
  }

  // Search functionality
  onSearchChange(): void {
    this.applyFilters();
  }

  // Filter functionality
  openFilter(): void {
    this.showFilter = !this.showFilter;
  }

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

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedPlan = '';
    this.dateFrom = '';
    this.dateTo = '';
    this.applyFilters();
  }

  // Pagination methods
  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  // Utility methods
  getPlanName(planId: string): string {
    const plan = this.plansMap[planId];
    return plan ? plan.name : 'Unknown Plan';
  }



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

  formatCurrency(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amount);
  }
}
