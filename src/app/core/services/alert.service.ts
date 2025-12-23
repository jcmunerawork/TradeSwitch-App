import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * Configuration interface for alert dialogs.
 *
 * @interface AlertConfig
 */
export interface AlertConfig {
  title: string;
  message: string;
  buttonText?: string;
  type?: 'info' | 'warning' | 'error' | 'success';
}

/**
 * Service for displaying alert dialogs throughout the application.
 *
 * This service provides a centralized way to show alert messages with different
 * types (info, warning, error, success). It uses RxJS BehaviorSubject to manage
 * alert state and provides convenience methods for common alert types.
 *
 * Features:
 * - Show alerts with custom title, message, and type
 * - Convenience methods for error, warning, success, and info alerts
 * - Observable stream for alert state changes
 * - Hide alerts programmatically
 *
 * Usage:
 * Components can subscribe to `alert$` observable to display alerts, or use
 * the convenience methods that automatically show alerts.
 *
 * Relations:
 * - Used by components throughout the application for user notifications
 * - AlertPopupComponent: Displays the actual alert UI
 *
 * @service
 * @injectable
 * @providedIn root
 */
@Injectable({
  providedIn: 'root'
})
export class AlertService {
  private alertSubject = new BehaviorSubject<{ visible: boolean; config: AlertConfig | null }>({
    visible: false,
    config: null
  });

  public alert$ = this.alertSubject.asObservable();

  showAlert(config: AlertConfig): void {
    this.alertSubject.next({
      visible: true,
      config: {
        title: config.title,
        message: config.message,
        buttonText: config.buttonText || 'OK',
        type: config.type || 'info'
      }
    });
  }

  hideAlert(): void {
    this.alertSubject.next({
      visible: false,
      config: null
    });
  }

  // Métodos de conveniencia
  showError(message: string, title: string = 'Error'): void {
    this.showAlert({
      title,
      message,
      type: 'error'
    });
  }

  showWarning(message: string, title: string = 'Warning'): void {
    this.showAlert({
      title,
      message,
      type: 'warning'
    });
  }

  showSuccess(message: string, title: string = 'Success'): void {
    this.showAlert({
      title,
      message,
      type: 'success'
    });
  }

  showInfo(message: string, title: string = 'Information'): void {
    this.showAlert({
      title,
      message,
      type: 'info'
    });
  }
}
