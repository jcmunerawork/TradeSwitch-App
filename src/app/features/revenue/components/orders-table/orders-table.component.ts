import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrderTableRow } from '../../models/revenue';
import { BackendDatePipe } from '../../../../shared/pipes/backend-date.pipe';

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
  imports: [CommonModule, FormsModule, BackendDatePipe],
  providers: [BackendDatePipe],
  templateUrl: './orders-table.component.html',
  styleUrls: ['./orders-table.component.scss'],
})
export class OrdersTableComponent {
  @Input() orderRows: OrderTableRow[] = [];

  currentPage: number = 1;
  itemsPerPage: number = 10;
  sortField: 'date' = 'date';
  sortAsc: boolean = true;

  get sortedRows(): OrderTableRow[] {
    return [...this.orderRows].sort((a, b) => {
      const fieldA = a[this.sortField].toLowerCase();
      const fieldB = b[this.sortField].toLowerCase();
      if (fieldA < fieldB) return this.sortAsc ? -1 : 1;
      if (fieldA > fieldB) return this.sortAsc ? 1 : -1;
      return 0;
    });
  }

  get paginatedRows(): OrderTableRow[] {
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

  getPaidClass(paid: boolean): string {
    return paid ? 'green' : 'red';
  }

  getPaidText(paid: boolean): string {
    return paid ? 'Paid' : 'Not paid';
  }
}
