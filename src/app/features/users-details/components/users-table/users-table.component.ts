import { Component, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

import { FormsModule } from '@angular/forms';
import { User } from '../../../overview/models/overview';
import { EventEmitter } from '@angular/core';
import { Timestamp } from 'firebase/firestore';

@Component({
  selector: 'app-users-table',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users-table.component.html',
  styleUrls: ['./users-table.component.scss'],
})
export class UsersTableComponent {
  @Input() users: User[] = [];
  @Output() userSelected = new EventEmitter<User>();

  initialMinStrat = 0;
  initialMaxStrat = 100;
  showFilter = false;
  currentPage: number = 1;
  itemsPerPage: number = 10;
  sortField: 'firstName' | 'lastName' = 'firstName';
  sortAsc: boolean = true;

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

    let result = this.users.filter((user) => {
      const matchesSearch = `${user.firstName} ${user.lastName}`
        .toLowerCase()
        .includes(lower);

      let matchesMinStrat = user.strategy_followed >= this.initialMinStrat;
      let matchesMaxStrat = user.strategy_followed <= this.initialMaxStrat;

      if (user.strategy_followed === undefined) {
        matchesMinStrat = true;
        matchesMaxStrat = true;
      }

      if (this.showFilter) {
        return matchesSearch;
      }

      return matchesSearch && matchesMinStrat && matchesMaxStrat;
    });

    result = result.sort((a, b) => {
      const fieldA = a[this.sortField].toLowerCase();
      const fieldB = b[this.sortField].toLowerCase();
      if (fieldA < fieldB) return this.sortAsc ? -1 : 1;
      if (fieldA > fieldB) return this.sortAsc ? 1 : -1;
      return 0;
    });

    return result;
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

  emitUser(user: User) {
    this.userSelected.emit(user);
  }
}