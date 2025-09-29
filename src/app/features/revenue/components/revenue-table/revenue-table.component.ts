import { Component, Input, Output, Injectable } from '@angular/core';
import { CommonModule } from '@angular/common';

import { FormsModule } from '@angular/forms';
import { RevenueFilter, RevenueTableRow } from '../../models/revenue';
import { NumberFormatterService } from '../../../../shared/utils/number-formatter.service';

@Component({
  selector: 'app-revenue-table',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './revenue-table.component.html',
  styleUrls: ['./revenue-table.component.scss'],
})
@Injectable()
export class RevenueTableComponent {
  @Input() revenueRows: RevenueTableRow[] = [];

  showFilter = false;
  currentPage: number = 1;
  itemsPerPage: number = 10;
  sortField: 'date' = 'date';
  sortAsc: boolean = true;

  filter: RevenueFilter = {};

  private numberFormatter = new NumberFormatterService();

  private _searchTerm = '';
  get searchTerm(): string {
    return this._searchTerm;
  }
  set searchTerm(val: string) {
    this._searchTerm = val;
    this.goToPage(1);
  }

  get filteredRows(): RevenueTableRow[] {
    let result = this.filterRevenueRows(this.revenueRows, this.filter);

    result = result.sort((a, b) => {
      const fieldA = a[this.sortField].toLowerCase();
      const fieldB = b[this.sortField].toLowerCase();
      if (fieldA < fieldB) return this.sortAsc ? -1 : 1;
      if (fieldA > fieldB) return this.sortAsc ? 1 : -1;
      return 0;
    });

    return result;
  }

  get paginatedRows(): RevenueTableRow[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.filteredRows.slice(start, end);
  }

  get totalPages(): number {
    return Math.ceil(this.filteredRows.length / this.itemsPerPage);
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

  filterRevenueRows(
    rows: RevenueTableRow[],
    filter: RevenueFilter
  ): RevenueTableRow[] {
    const lowerSearch = filter.searchTerm?.toLowerCase() ?? '';

    return rows.filter((row) => {
      const matchesSearch =
        lowerSearch === '' || row.date.toLowerCase().includes(lowerSearch);

      const matchesMinOrders =
        filter.minOrders === undefined ||
        filter.minOrders === null ||
        row.orders >= filter.minOrders;
      const matchesMaxOrders =
        filter.maxOrders === undefined ||
        filter.maxOrders === null ||
        row.orders <= filter.maxOrders;

      const matchesMinGrossRevenue =
        filter.minGrossRevenue === undefined ||
        filter.minGrossRevenue === null ||
        row.grossRevenue >= filter.minGrossRevenue;
      const matchesMaxGrossRevenue =
        filter.maxGrossRevenue === undefined ||
        filter.maxGrossRevenue === null ||
        row.grossRevenue <= filter.maxGrossRevenue;

      const matchesMinTotalSales =
        filter.minTotalSales === undefined ||
        filter.minTotalSales === null ||
        row.totalSales >= filter.minTotalSales;
      const matchesMaxTotalSales =
        filter.maxTotalSales === undefined ||
        filter.maxTotalSales === null ||
        row.totalSales <= filter.maxTotalSales;

      if (this.showFilter) {
        return matchesSearch;
      }

      return (
        matchesSearch &&
        matchesMinOrders &&
        matchesMaxOrders &&
        matchesMinGrossRevenue &&
        matchesMaxGrossRevenue &&
        matchesMinTotalSales &&
        matchesMaxTotalSales
      );
    });
  }

  formatCurrency(value: number | null | undefined): string {
    return this.numberFormatter.formatCurrency(value);
  }
}
