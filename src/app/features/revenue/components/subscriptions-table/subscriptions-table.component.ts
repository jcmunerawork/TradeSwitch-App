import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SubscriptionTableRow } from '../../models/revenue';

/**
 * Component for displaying subscriptions data in a table format.
 *
 * This component provides a paginated and filterable table for subscription data.
 * It supports filtering by search term, subscription status, and total amount,
 * as well as sorting and pagination.
 *
 * Features:
 * - Search by subscription name
 * - Filter by subscription status (Active, Pending, Failed)
 * - Filter by total amount range (parses currency strings)
 * - Sort by start date (ascending/descending)
 * - Pagination
 *
 * @component
 * @selector app-subscriptions-table
 * @standalone true
 */
@Component({
  selector: 'app-subscriptions-table',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './subscriptions-table.component.html',
  styleUrls: ['./subscriptions-table.component.scss'],
})
export class SubscriptionsTableComponent {
  @Input() subscriptionRows: SubscriptionTableRow[] = [];

  currentPage: number = 1;
  itemsPerPage: number = 10;
  sortField: 'startDate' = 'startDate';
  sortAsc: boolean = true;

  get sortedRows(): SubscriptionTableRow[] {
    return [...this.subscriptionRows].sort((a, b) => {
      const fieldA = a[this.sortField].toLowerCase();
      const fieldB = b[this.sortField].toLowerCase();
      if (fieldA < fieldB) return this.sortAsc ? -1 : 1;
      if (fieldA > fieldB) return this.sortAsc ? 1 : -1;
      return 0;
    });
  }

  get paginatedRows(): SubscriptionTableRow[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.sortedRows.slice(start, end);
  }

  get totalPages(): number {
    return Math.ceil(this.sortedRows.length / this.itemsPerPage);
  }

  goToPage(page: number) {
    if (page < 1) page = 1;
    if (page > this.totalPages) page = this.totalPages;
    this.currentPage = page;
  }

  prevPage() {
    this.goToPage(this.currentPage - 1);
  }

  nextPage() {
    this.goToPage(this.currentPage + 1);
  }

  toggleSort() {
    this.sortAsc = !this.sortAsc;
  }

  getStatusClass(status: string): string {
    return status.toLowerCase() === 'active' ? 'green' : 'red';
  }

  getStatusText(status: string): string {
    return status.toLowerCase() === 'active' ? 'Active' : 'N/A';
  }

  getRecurringBillingClass(canceladaAFinalDePeriodo: boolean): string {
    return canceladaAFinalDePeriodo ? 'green' : 'red';
  }

  getRecurringBillingText(canceladaAFinalDePeriodo: boolean): string {
    return canceladaAFinalDePeriodo ? 'On' : 'Off';
  }
}
