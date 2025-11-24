import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { User, UserStatus } from '../../models/overview';

/**
 * Component for displaying a single user in the top users list.
 * 
 * This component displays user information in a card format,
 * showing user initials, name, and profit. It's used in the
 * overview dashboard to show the top 10 users by profit.
 * 
 * Related to:
 * - OverviewComponent: Passes user data as Input
 * 
 * @component
 * @selector app-top-list
 * @standalone true
 */
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

  /**
   * Gets user initials from first and last name.
   * 
   * Takes the first character of firstName and lastName,
   * converts them to uppercase, and concatenates them.
   * 
   * @param user - User object containing firstName and lastName
   * @returns Two-letter initials string (e.g., "JD" for John Doe)
   * @memberof TopListComponent
   */
  onlyNameInitials(user: User) {
    return (
      user.firstName.charAt(0).toUpperCase() +
      user.lastName.charAt(0).toUpperCase()
    );
  }

  /**
   * Formats profit value for display.
   * 
   * Formats profit with appropriate currency symbol and scaling:
   * - $0 for zero
   * - $X.XX for values less than 1000
   * - $X.XK for values 1000 or greater (e.g., $5.2K for 5200)
   * 
   * @param profit - Profit value to format
   * @returns Formatted profit string
   * @memberof TopListComponent
   */
  formatProfit(profit: number): string {
    if (profit === 0) return '$0';
    if (Math.abs(profit) < 1000) {
      return `$${profit.toFixed(2)}`;
    }
    const k = profit / 1000;
    return `$${k.toFixed(1)}K`;
  }
}
