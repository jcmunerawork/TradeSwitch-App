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

  currentPage: number = 1;
  itemsPerPage: number = 10;

  get paginatedUsers(): User[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.users.slice(start, end);
  }

  get totalPages(): number {
    return Math.ceil(this.users.length / this.itemsPerPage);
  }

  statusClass(status: string) {
    return status;
  }

  returnClass(returnValue: number) {
    return returnValue >= 0 ? 'green' : 'red';
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

  getUserDate(date: number): Date {
    return new Date(date);
  }

  emitUser(user: User) {
    this.userSelected.emit(user);
  }
}
