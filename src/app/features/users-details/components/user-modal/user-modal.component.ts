import { Component, Input, Output, EventEmitter } from '@angular/core';
import { User } from '../../../overview/models/overview';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Timestamp } from 'firebase/firestore';

@Component({
  selector: 'app-user-modal',
  templateUrl: './user-modal.component.html',
  styleUrls: ['./user-modal.component.scss'],
  imports: [FormsModule, CommonModule],
  standalone: true,
})
export class UserModalComponent {
  @Input() user!: User;
  @Output() close = new EventEmitter<void>();
  @Output() ban = new EventEmitter<{ username: string; reason: string }>();
  @Output() unban = new EventEmitter<string>();
  @Output() setPassword = new EventEmitter<string>();
  @Output() sendResetLink = new EventEmitter<string>();
  @Output() logoutEverywhere = new EventEmitter<string>();

  today = new Date();

  usernameToBan = '';
  banReason = '';

  get aov(): string {
    return this.user.total_spend && this.user.number_trades
      ? (this.user.total_spend / this.user.number_trades).toFixed(2)
      : '0.00';
  }

  onlyNameInitials(user: User) {
    return user.firstName.charAt(0) + user.lastName.charAt(0);
  }
  getUserDate(date: Timestamp): Date {
    return date.toDate();
  }
}
