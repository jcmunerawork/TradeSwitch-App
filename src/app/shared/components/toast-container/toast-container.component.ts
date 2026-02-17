import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ToastNotificationService } from '../../services/toast-notification.service';
import { ToastNotificationComponent } from '../toast-notification/toast-notification.component';

/**
 * Container component for displaying multiple toast notifications.
 * 
 * This component subscribes to the ToastNotificationService and displays
 * all active notifications in a stack in the bottom right corner.
 * 
 * Usage:
 * Add this component to your root app component or any page where you
 * want to show toast notifications.
 * 
 * @component
 * @selector app-toast-container
 * @standalone true
 */
@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule, ToastNotificationComponent],
  template: `
    <div class="toast-container">
      @for (notification of notifications; track notification.id) {
        <app-toast-notification
          [notification]="notification"
          [visible]="true"
          (close)="onClose(notification.id)">
        </app-toast-notification>
      }
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 12px;
      pointer-events: none;
    }

    app-toast-notification {
      pointer-events: auto;
    }

    @media (max-width: 768px) {
      .toast-container {
        bottom: 16px;
        right: 16px;
        left: 16px;
        gap: 8px;
      }
    }
  `]
})
export class ToastContainerComponent implements OnInit, OnDestroy {
  notifications: any[] = [];
  private subscription: Subscription = new Subscription();

  constructor(private toastService: ToastNotificationService) {}

  ngOnInit(): void {
    this.subscription = this.toastService.notifications$.subscribe(notifications => {
      this.notifications = notifications;
    });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  onClose(id: string): void {
    this.toastService.remove(id);
  }
}

