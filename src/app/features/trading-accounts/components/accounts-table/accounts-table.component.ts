import { Component, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

import { FormsModule } from '@angular/forms';
import { User } from '../../../overview/models/overview';
import { EventEmitter } from '@angular/core';
import { Timestamp } from 'firebase/firestore';
import { AccountData } from '../../../auth/models/userModel';
import { ShowConfirmationComponent } from '../show-confirmation/show-confirmation.component';
import { Router } from '@angular/router';

@Component({
  selector: 'app-accounts-table',
  standalone: true,
  imports: [CommonModule, FormsModule, ShowConfirmationComponent],
  templateUrl: './accounts-table.component.html',
  styleUrls: ['./accounts-table.component.scss'],
})
export class AccountsTableComponent {
  @Input() accounts: AccountData[] = [];
  @Output() delete = new EventEmitter<AccountData>();

  initialMinBalance = 0;
  initialMaxBalance = 1000000;
  showFilter = false;
  currentPage: number = 1;
  itemsPerPage: number = 10;
  sortField: 'createdAt' = 'createdAt';
  sortAsc: boolean = true;
  showConfirmation = false;

  constructor(private router: Router) {}

  private _searchTerm = '';
  accountToDelete!: AccountData;
  get searchTerm(): string {
    return this._searchTerm;
  }
  set searchTerm(val: string) {
    this._searchTerm = val;
    this.goToPage(1);
  }

  get filteredUsers(): AccountData[] {
    const lower = this._searchTerm.trim().toLowerCase();

    let result = this.accounts.filter((account) => {
      const matchesSearch = `${account.accountName}`
        .toLowerCase()
        .includes(lower);

      let matchesMinBalance = (account.balance ?? 0) >= this.initialMinBalance;
      let matchesMaxBalance = (account.balance ?? 0) <= this.initialMaxBalance;

      if (account.balance === undefined) {
        matchesMinBalance = true;
        matchesMaxBalance = true;
      }

      if (this.showFilter) {
        return matchesSearch;
      }
      return matchesSearch && matchesMinBalance && matchesMaxBalance;
    });

    result = result.sort((a, b) => {
      const fieldA =
        a[this.sortField] instanceof Timestamp
          ? (a[this.sortField] as Timestamp).toDate().getTime()
          : String(a[this.sortField]).toLowerCase();
      const fieldB =
        b[this.sortField] instanceof Timestamp
          ? (b[this.sortField] as Timestamp).toDate().getTime()
          : String(b[this.sortField]).toLowerCase();

      if (fieldA < fieldB) return this.sortAsc ? -1 : 1;
      if (fieldA > fieldB) return this.sortAsc ? 1 : -1;
      return 0;
    });

    return result;
  }

  get paginatedAccounts(): AccountData[] {
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

  getUserDate(date: number): Date {
    return new Date(date);
  }

  deleteAccount(account: AccountData) {
    this.showConfirmation = true;
    this.accountToDelete = account;
  }

  confirmDelete() {
    this.delete.emit(this.accountToDelete);
    this.accountToDelete = {} as AccountData;
    this.showConfirmation = false;
  }

  cancelDelete() {
    this.showConfirmation = false;
    this.accountToDelete = {} as AccountData;
  }

}
