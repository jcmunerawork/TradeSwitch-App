import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, state, style, transition, animate } from '@angular/animations';

export interface ToastNotification {
  id: string;
  message: string;
  type: 'error' | 'warning' | 'success' | 'info';
  duration?: number;
}

/**
 * Component for displaying toast notifications in the bottom right corner.
 * 
 * This component displays non-blocking notifications that appear in the
 * bottom right corner of the screen and automatically disappear after a
 * specified duration.
 * 
 * Features:
 * - Multiple notification types (error, warning, success, info)
 * - Auto-dismiss after duration
 * - Manual dismiss option
 * - Stack multiple notifications
 * - Smooth animations
 * 
 * @component
 * @selector app-toast-notification
 * @standalone true
 */
@Component({
  selector: 'app-toast-notification',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast-notification.component.html',
  styleUrl: './toast-notification.component.scss',
  animations: [
    trigger('slideInOut', [
      state('in', style({ transform: 'translateX(0)', opacity: 1 })),
      transition('void => *', [
        style({ transform: 'translateX(100%)', opacity: 0 }),
        animate('300ms ease-out')
      ]),
      transition('* => void', [
        animate('300ms ease-in', style({ transform: 'translateX(100%)', opacity: 0 }))
      ])
    ])
  ]
})
export class ToastNotificationComponent implements OnInit, OnDestroy {
  @Input() notification: ToastNotification | null = null;
  @Input() visible: boolean = false;
  @Output() close = new EventEmitter<string>();

  private timeoutId: any;

  ngOnInit(): void {
    if (this.notification && this.visible) {
      const duration = this.notification.duration || 5000; // Default 5 seconds
      if (duration > 0) {
        this.timeoutId = setTimeout(() => {
          this.onClose();
        }, duration);
      }
    }
  }

  ngOnDestroy(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
  }

  onClose(): void {
    this.visible = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
    if (this.notification) {
      this.close.emit(this.notification.id);
    }
  }
}

