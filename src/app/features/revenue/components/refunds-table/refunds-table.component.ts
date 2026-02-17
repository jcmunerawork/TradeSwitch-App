import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RefundTableRow } from '../../models/revenue';
import { NumberFormatterService } from '../../../../shared/utils/number-formatter.service';

@Component({
  selector: 'app-refunds-table',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './refunds-table.component.html',
  styleUrls: ['./refunds-table.component.scss'],
})
export class RefundsTableComponent {
  @Input() refundRows: RefundTableRow[] = [];

  currentPage: number = 1;
  itemsPerPage: number = 10;
  sortField: 'created' = 'created';
  sortAsc: boolean = true;

  private numberFormatter = new NumberFormatterService();

  get sortedRows(): RefundTableRow[] {
    return [...this.refundRows].sort((a, b) => {
      const fieldA = a[this.sortField].toLowerCase();
      const fieldB = b[this.sortField].toLowerCase();
      if (fieldA < fieldB) return this.sortAsc ? -1 : 1;
      if (fieldA > fieldB) return this.sortAsc ? 1 : -1;
      return 0;
    });
  }

  get paginatedRows(): RefundTableRow[] {
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

  formatCurrency(value: number | null | undefined): string {
    return this.numberFormatter.formatCurrency(value);
  }

  getStatusClass(status: string): string {
    const lowerStatus = status.toLowerCase();
    if (lowerStatus === 'succeeded') return 'green';
    if (lowerStatus === 'pending' || lowerStatus === 'requires action') return 'yellow';
    if (lowerStatus === 'failed' || lowerStatus === 'canceled') return 'red';
    return '';
  }
}

