import { Component, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

import { FormsModule } from '@angular/forms';
import {
  SubscriptionFilter,
  SubscriptionStatus,
  SubscriptionTableRow,
} from '../../models/revenue';

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

  showFilter = false;
  currentPage: number = 1;
  itemsPerPage: number = 10;
  sortField: 'startDate' = 'startDate';
  sortAsc: boolean = true;

  subscriptionStatus = SubscriptionStatus;

  filter: SubscriptionFilter = {};

  private _searchTerm = '';
  get searchTerm(): string {
    return this._searchTerm;
  }
  set searchTerm(val: string) {
    this._searchTerm = val;
    this.goToPage(1);
  }

  get filteredRows(): SubscriptionTableRow[] {
    let result = this.filterOrderRows(this.subscriptionRows, this.filter);

    result = result.sort((a, b) => {
      const fieldA = a[this.sortField].toLowerCase();
      const fieldB = b[this.sortField].toLowerCase();
      if (fieldA < fieldB) return this.sortAsc ? -1 : 1;
      if (fieldA > fieldB) return this.sortAsc ? 1 : -1;
      return 0;
    });

    return result;
  }

  get paginatedRows(): SubscriptionTableRow[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.filteredRows.slice(start, end);
  }

  get totalPages(): number {
    return Math.ceil(this.filteredRows.length / this.itemsPerPage);
  }

  statusClass(status: string) {
    return status;
  }

  openFilter() {
    this.showFilter = !this.showFilter;
  }

  closeFilter() {
    this.showFilter = false;
  }

  apply() {
    this.showFilter = false;

    this.applyFilters();
  }

  applyFilters() {
    this.goToPage(1);
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

  filterOrderRows(
    rows: SubscriptionTableRow[],
    filter: SubscriptionFilter
  ): SubscriptionTableRow[] {
    const lowerSearch = filter.searchTerm?.toLowerCase() ?? '';

    return rows.filter((row) => {
      const matchesSearch =
        lowerSearch === '' ||
        row.subscription.toLowerCase().includes(lowerSearch);

      const matchesStatus =
        filter.status === undefined ||
        filter.status === null ||
        filter.status === ('' as SubscriptionStatus) ||
        row.status === filter.status;

      const matchesMinTotal =
        filter.minTotal === undefined ||
        filter.minTotal === null ||
        parseFloat(row.total.replace('$', '').split('/')[0]) >= filter.minTotal;

      const matchesMaxTotal =
        filter.maxTotal === undefined ||
        filter.maxTotal === null ||
        parseFloat(row.total.replace('$', '').split('/')[0]) <= filter.maxTotal;

      if (this.showFilter) {
        return matchesSearch;
      }

      return (
        matchesSearch && matchesStatus && matchesMinTotal && matchesMaxTotal
      );
    });
  }
}
