import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Component for displaying alert dialogs.
 *
 * This component provides a reusable alert dialog that can display different
 * types of messages (info, warning, error, success) with customizable title,
 * message, and button text.
 *
 * Features:
 * - Multiple alert types (info, warning, error, success)
 * - Customizable title and message
 * - Customizable button text
 * - Visibility control
 * - Close and confirm events
 *
 * Usage:
 * <app-alert-popup
 *   [visible]="showAlert"
 *   [title]="alertTitle"
 *   [message]="alertMessage"
 *   [type]="'error'"
 *   [buttonText]="'OK'"
 *   (close)="onCloseAlert()">
 * </app-alert-popup>
 *
 * Relations:
 * - AlertService: Often used together to show alerts
 *
 * @component
 * @selector app-alert-popup
 * @standalone true
 */
@Component({
  selector: 'app-alert-popup',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './alert-popup.component.html',
  styleUrl: './alert-popup.component.scss'
})
export class AlertPopupComponent {
  @Input() visible: boolean = false;
  @Input() title: string = 'Alert';
  @Input() message: string = '';
  @Input() buttonText: string = 'OK';
  @Input() type: 'info' | 'warning' | 'error' | 'success' = 'info';
  
  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<void>();

  onClose(): void {
    this.close.emit();
  }

  onConfirm(): void {
    this.confirm.emit();
    this.close.emit();
  }
}
