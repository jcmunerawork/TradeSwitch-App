import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { AlertService, AlertConfig } from '../../../core/services';
import { AlertPopupComponent } from '../../pop-ups/alert-popup/alert-popup.component';

/**
 * Global alert component that displays alerts throughout the application.
 *
 * This component subscribes to the AlertService and displays alert dialogs
 * whenever an alert is triggered anywhere in the application. It provides
 * a centralized way to show user notifications.
 *
 * Features:
 * - Subscribes to AlertService alert stream
 * - Displays alerts using AlertPopupComponent
 * - Handles alert close and confirm actions
 * - Automatic cleanup on component destroy
 *
 * Usage:
 * Should be included in the root app component template to enable global
 * alert functionality throughout the application.
 *
 * Relations:
 * - AlertService: Source of alert notifications
 * - AlertPopupComponent: Displays the actual alert UI
 *
 * @component
 * @selector app-global-alert
 * @standalone true
 */
@Component({
  selector: 'app-global-alert',
  standalone: true,
  imports: [CommonModule, AlertPopupComponent],
  template: `
    <app-alert-popup
      [visible]="alertVisible"
      [title]="alertConfig?.title || ''"
      [message]="alertConfig?.message || ''"
      [buttonText]="alertConfig?.buttonText || 'OK'"
      [type]="alertConfig?.type || 'info'"
      (close)="onClose()"
      (confirm)="onConfirm()">
    </app-alert-popup>
  `
})
export class GlobalAlertComponent implements OnInit, OnDestroy {
  alertVisible = false;
  alertConfig: AlertConfig | null = null;
  private subscription: Subscription = new Subscription();

  constructor(private alertService: AlertService) {}

  ngOnInit(): void {
    this.subscription = this.alertService.alert$.subscribe(alert => {
      this.alertVisible = alert.visible;
      this.alertConfig = alert.config;
    });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  onClose(): void {
    this.alertService.hideAlert();
  }

  onConfirm(): void {
    this.alertService.hideAlert();
  }
}
