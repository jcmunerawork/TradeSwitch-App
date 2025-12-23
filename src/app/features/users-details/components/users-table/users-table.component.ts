import { Component, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

import { FormsModule } from '@angular/forms';
import { User } from '../../../overview/models/overview';
import { EventEmitter } from '@angular/core';
import { Timestamp } from 'firebase/firestore';
import { CreateUserRolePopupComponent } from '../create-user-role-popup/create-user-role-popup.component';

/**
 * Component for displaying a filterable and sortable table of users.
 *
 * This component displays users in a paginated table with search, filtering,
 * and sorting capabilities. It also includes functionality to create new users
 * (both regular users and admins) through a popup component.
 *
 * Features:
 * - Search users by name (first name + last name)
 * - Filter by strategy followed percentage range
 * - Sort by first name or last name (ascending/descending)
 * - Pagination with configurable items per page
 * - Status classification (banned, created, active)
 * - Create new user popup (user or admin role)
 * - User selection for detailed view
 *
 * Status Classification:
 * - "banned": User status is explicitly banned
 * - "created": All user metrics are zero (newly created account)
 * - "active": User has activity (non-zero metrics)
 *
 * Relations:
 * - CreateUserRolePopupComponent: Modal for creating new users
 * - UsersDetails: Parent component that receives selected users
 *
 * @component
 * @selector app-users-table
 * @standalone true
 */
@Component({
  selector: 'app-users-table',
  standalone: true,
  imports: [CommonModule, FormsModule, CreateUserRolePopupComponent],
  templateUrl: './users-table.component.html',
  styleUrls: ['./users-table.component.scss'],
})
export class UsersTableComponent {
  @Input() users: User[] = [];
  @Output() userSelected = new EventEmitter<User>();
  @Output() userCreated = new EventEmitter<void>();

  initialMinStrat = 0;
  initialMaxStrat = 100;
  showFilter = false;
  currentPage: number = 1;
  itemsPerPage: number = 10;
  sortField: 'firstName' | 'lastName' = 'firstName';
  sortAsc: boolean = true;

  showCreateUserPopup = false;

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

  statusClass(user: User): string {
    // Si el status es banned, retornar banned
    if (String(user.status) === 'banned') {
      return 'banned';
    }
    
    // Verificar si todos los valores están en 0
    const allValuesZero = 
      (user.trading_accounts ?? 0) === 0 &&
      (user.strategies ?? 0) === 0 &&
      (user.strategy_followed ?? 0) === 0 &&
      (user.netPnl ?? 0) === 0 &&
      (user.profit ?? 0) === 0 &&
      (user.number_trades ?? 0) === 0 &&
      (user.total_spend ?? 0) === 0;
    
    // Si todos los valores están en 0, retornar created
    if (allValuesZero) {
      return 'created';
    }
    
    // Si no todos están en 0, retornar active
    return 'active';
  }
  
  getDisplayStatus(user: User): string {
    const status = this.statusClass(user);
    return status.charAt(0).toUpperCase() + status.slice(1);
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

  resetFilters() {
    this.initialMinStrat = 0;
    this.initialMaxStrat = 100;
    this.applyFilters();
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

  onOpenCreateUser() {
    this.showCreateUserPopup = true;
  }

  onCloseCreateUser() {
    this.showCreateUserPopup = false;
  }

  onSelectRole(role: 'user' | 'admin') {
    // No cerrar el popup aquí; el componente interno cambia a step 'form'.
  }

  onPopupCreated() {
    this.userCreated.emit();
  }
}