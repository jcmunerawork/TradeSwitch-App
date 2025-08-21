import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
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
    birthday: '',
    firstName: '',
    id: '',
    lastName: '',
    netPnl: 0,
    number_trades: 0,
    phoneNumber: '',
    profit: 0,
    status: UserStatus.PURCHASED,
    strategy_followed: 0,
    subscription_date: '',
    tokenId: '',
  };

  constructor() {}

  onlyNameInitials(user: User) {
    return user.firstName.charAt(0) + user.lastName.charAt(0);
  }
}
