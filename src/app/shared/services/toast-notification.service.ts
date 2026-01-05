import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ToastNotification } from '../components/toast-notification/toast-notification.component';

/**
 * Service for managing toast notifications.
 * 
 * This service provides a centralized way to show toast notifications
 * in the bottom right corner of the screen. It manages a queue of
 * notifications and allows components to subscribe to notification changes.
 * 
 * Features:
 * - Show notifications with different types (error, warning, success, info)
 * - Auto-dismiss after duration
 * - Queue multiple notifications
 * - Observable stream for notification state
 * 
 * Usage:
 * ```typescript
 * this.toastService.showError('Error message');
 * this.toastService.showSuccess('Success message');
 * ```
 * 
 * @service
 * @injectable
 * @providedIn root
 */
@Injectable({
  providedIn: 'root'
})
export class ToastNotificationService {
  private notificationsSubject = new BehaviorSubject<ToastNotification[]>([]);
  public notifications$: Observable<ToastNotification[]> = this.notificationsSubject.asObservable();

  /**
   * Show a toast notification
   */
  show(notification: Omit<ToastNotification, 'id'>): void {
    const id = this.generateId();
    const newNotification: ToastNotification = {
      id,
      duration: notification.duration || 5000,
      ...notification
    };

    const currentNotifications = this.notificationsSubject.value;
    this.notificationsSubject.next([...currentNotifications, newNotification]);

    // Auto-remove after duration
    if (newNotification.duration && newNotification.duration > 0) {
      setTimeout(() => {
        this.remove(id);
      }, newNotification.duration);
    }
  }

  /**
   * Show an error notification
   */
  showError(message: string, duration?: number): void {
    this.show({
      message,
      type: 'error',
      duration: duration || 5000
    });
  }

  /**
   * Show a warning notification
   */
  showWarning(message: string, duration?: number): void {
    this.show({
      message,
      type: 'warning',
      duration: duration || 5000
    });
  }

  /**
   * Show a success notification
   */
  showSuccess(message: string, duration?: number): void {
    this.show({
      message,
      type: 'success',
      duration: duration || 3000
    });
  }

  /**
   * Show an info notification
   */
  showInfo(message: string, duration?: number): void {
    this.show({
      message,
      type: 'info',
      duration: duration || 4000
    });
  }

  /**
   * Remove a notification by ID
   */
  remove(id: string): void {
    const currentNotifications = this.notificationsSubject.value;
    this.notificationsSubject.next(
      currentNotifications.filter(n => n.id !== id)
    );
  }

  /**
   * Clear all notifications
   */
  clear(): void {
    this.notificationsSubject.next([]);
  }

  /**
   * Extract error message from backend error response
   */
  extractErrorMessage(error: any): string {
    // If it's HttpErrorResponse, the error is in error.error
    if (error?.error?.error?.message) {
      // Backend format: error.error.error.message
      return error.error.error.message;
    } else if (error?.error?.message) {
      // Alternative format
      return error.error.message;
    } else if (error?.message) {
      // Generic message
      return error.message;
    } else if (typeof error === 'string') {
      return error;
    }
    return 'An error occurred';
  }

  /**
   * Extract error details from backend error response
   */
  extractErrorDetails(error: any): string[] | null {
    if (error?.error?.error?.details && Array.isArray(error.error.error.details)) {
      return error.error.error.details;
    }
    return null;
  }

  /**
   * Show error from backend response
   */
  showBackendError(error: any, defaultMessage: string = 'An error occurred'): void {
    const errorMessage = this.extractErrorMessage(error);
    const errorDetails = this.extractErrorDetails(error);

    if (errorDetails && errorDetails.length > 0) {
      // If there are multiple errors, show them all
      const message = errorDetails.join('\n');
      this.showError(message || errorMessage || defaultMessage, 7000);
    } else {
      this.showError(errorMessage || defaultMessage);
    }
  }

  /**
   * Generate unique ID for notification
   */
  private generateId(): string {
    return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

