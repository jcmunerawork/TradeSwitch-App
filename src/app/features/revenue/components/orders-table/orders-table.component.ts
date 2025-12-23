import { Component, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

import { FormsModule } from '@angular/forms';
import {
  OrderFilter,
  OrderStatus,
  OrderTableRow,
  RevenueFilter,
  RevenueTableRow,
} from '../../models/revenue';

/**
 * Component for displaying orders data in a table format.
 *
 * This component provides a paginated and filterable table for order data.
 * It supports filtering by search term, order status, and total amount,
 * as well as sorting and pagination.
 *
 * Features:
 * - Search by order ID or user name
 * - Filter by order status (Completed, Pending, Cancelled, Failed)
 * - Filter by total amount range
 * - Sort by date (ascending/descending)
 * - Pagination
 *
 * @component
 * @selector app-orders-table
 * @standalone true
 */
@Component({
  selector: 'app-orders-table',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './orders-table.component.html',
  styleUrls: ['./orders-table.component.scss'],
})
export class OrdersTableComponent {
  @Input() orderRows: OrderTableRow[] = [];

  showFilter = false;
  currentPage: number = 1;
  itemsPerPage: number = 10;
  sortField: 'date' = 'date';
  sortAsc: boolean = true;

  orderStatus = OrderStatus;

  filter: OrderFilter = {};

  private _searchTerm = '';
  get searchTerm(): string {
    return this._searchTerm;
  }
  set searchTerm(val: string) {
    this._searchTerm = val;
    this.goToPage(1);
  }

  get filteredRows(): OrderTableRow[] {
    let result = this.filterOrderRows(this.orderRows, this.filter);

    result = result.sort((a, b) => {
      const fieldA = a[this.sortField].toLowerCase();
      const fieldB = b[this.sortField].toLowerCase();
      if (fieldA < fieldB) return this.sortAsc ? -1 : 1;
      if (fieldA > fieldB) return this.sortAsc ? 1 : -1;
      return 0;
    });

    return result;
  }

  get paginatedRows(): OrderTableRow[] {
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

  filterOrderRows(rows: OrderTableRow[], filter: OrderFilter): OrderTableRow[] {
    const lowerSearch = filter.searchTerm?.toLowerCase() ?? '';

    return rows.filter((row) => {
      const matchesSearch =
        lowerSearch === '' ||
        `${row.orderId} ${row.user}`.toLowerCase().includes(lowerSearch);

      const matchesStatus =
        filter.status === undefined ||
        filter.status === null ||
        filter.status === ('' as OrderStatus) ||
        row.status === filter.status;

      const matchesMinTotal =
        filter.minTotal === undefined ||
        filter.minTotal === null ||
        row.total >= filter.minTotal;
      const matchesMaxTotal =
        filter.maxTotal === undefined ||
        filter.maxTotal === null ||
        row.total <= filter.maxTotal;

      if (this.showFilter) {
        return matchesSearch;
      }

      return (
        matchesSearch && matchesStatus && matchesMinTotal && matchesMaxTotal
      );
    });
  }
}
