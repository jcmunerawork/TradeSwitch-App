import { Component, Input, Injectable } from '@angular/core';
import { CommonModule } from '@angular/common';
import { User, UserStatus } from '../../models/overview';
import { FormsModule } from '@angular/forms';
import { NumberFormatterService } from '../../../../shared/utils/number-formatter.service';

@Component({
  selector: 'app-trade-switch-table',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tradeSwitchTable.component.html',
  styleUrls: ['./tradeSwitchTable.component.scss'],
})
@Injectable()
export class TradeSwitchTableComponent {
  @Input() users: User[] = [];
  initialStatus: UserStatus = undefined as unknown as UserStatus;
  initialMinStrat = 0;
  initialMaxStrat = 100;
  showFilter = false;
  currentPage: number = 1;
  itemsPerPage: number = 10;

  private numberFormatter = new NumberFormatterService();

  private _searchTerm = '';
  get searchTerm(): string {
    return this._searchTerm;
  }
  set searchTerm(val: string) {
    this._searchTerm = val;
    this.goToPage(1);
  }

  get filteredUsers(): User[] {
    const lower = this._searchTerm.trim().toLowerCase();

    return this.users.filter((user) => {
      const matchesSearch = `${user.firstName.split(' ')[0]} ${
        user.lastName.split(' ')[0]
      }`
        .toLowerCase()
        .includes(lower);
      const matchesStatus =
        !this.initialStatus || user.status === this.initialStatus;

      let matchesMinStrat = user.strategy_followed >= this.initialMinStrat;
      let matchesMaxStrat = user.strategy_followed <= this.initialMaxStrat;

      if (user.strategy_followed === undefined) {
        matchesMinStrat = true;
        matchesMaxStrat = true;
      }

      if (this.showFilter) {
        return matchesSearch;
      }

      return (
        matchesSearch && matchesStatus && matchesMinStrat && matchesMaxStrat
      );
    });
  }

  get paginatedUsers(): User[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.filteredUsers.slice(start, end);
  }

  get totalPages(): number {
    return Math.ceil(this.filteredUsers.length / this.itemsPerPage);
  }

  statusClass(status: string) {
    return status;
  }

  returnClass(returnValue: number) {
    return returnValue >= 0 ? 'green' : 'red';
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

  onlyNameInitials(user: User) {
    return user.firstName.charAt(0) + user.lastName.charAt(0);
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

  formatCurrency(value: number | null | undefined): string {
    return this.numberFormatter.formatCurrency(value);
  }
}
