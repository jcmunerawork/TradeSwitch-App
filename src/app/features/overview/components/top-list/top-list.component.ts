import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { User, UserStatus } from '../../models/overview';

@Component({
  selector: 'app-top-list',
  templateUrl: './top-list.component.html',
  styleUrls: ['./top-list.component.scss'],
  standalone: true,
  imports: [CommonModule],
})
export class TopListComponent {
  @Input() user: User = {
    best_trade: 0,
    birthday: new Date(),
    firstName: '',
    id: '',
    lastName: '',
    netPnl: 0,
    number_trades: 0,
    phoneNumber: '',
    profit: 0,
    status: UserStatus.CREATED,
    strategy_followed: 0,
    subscription_date: 0,
    tokenId: '',
    email: '',
    total_spend: 0,
    isAdmin: false,
    lastUpdated: 0,
    trading_accounts: 0,
    strategies: 0,
  };

  constructor() {}

  onlyNameInitials(user: User) {
    return (
      user.firstName.charAt(0).toUpperCase() +
      user.lastName.charAt(0).toUpperCase()
    );
  }

  formatProfit(profit: number): string {
    if (profit === 0) return '$0';
    if (Math.abs(profit) < 1000) {
      return `$${profit.toFixed(2)}`;
    }
    const k = profit / 1000;
    return `$${k.toFixed(1)}K`;
  }
}
