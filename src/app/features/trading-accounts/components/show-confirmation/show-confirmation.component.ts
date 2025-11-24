import { Component, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

import { FormsModule } from '@angular/forms';
import { User } from '../../../overview/models/overview';
import { EventEmitter } from '@angular/core';
import { Timestamp } from 'firebase/firestore';
import { AccountData } from '../../../auth/models/userModel';

/**
 * Component for displaying account deletion confirmation modal.
 *
 * This component requires the user to type the account name exactly
 * to confirm deletion, providing an extra safety measure against accidental deletions.
 *
 * Features:
 * - Account name input validation
 * - Confirm and cancel actions
 * - Event emitters for parent component handling
 *
 * Relations:
 * - AccountsTableComponent: Uses this component for deletion confirmation
 *
 * @component
 * @selector app-show-confirmation
 * @standalone true
 */
@Component({
  selector: 'app-show-confirmation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './show-confirmation.component.html',
  styleUrls: ['./show-confirmation.component.scss'],
})
export class ShowConfirmationComponent {
  @Input() account: AccountData | null = null;
  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  accountNameInput: string = '';

  get accountName(): string {
    return this.account?.accountName ?? '';
  }

  onConfirm() {
    if (this.accountNameInput.trim() === this.accountName) {
      this.confirm.emit();
    }
  }

  onCancel() {
    this.cancel.emit();
  }
}
