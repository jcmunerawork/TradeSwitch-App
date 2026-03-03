import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ToastNotification } from '../components/toast-notification/toast-notification.component';
import { ApiWarning, ApiDataSource, ApiRetryInfo, ApiError } from '../../core/models/api-response.model';
import { BackendApiResponse } from '../../core/services/backend-api.service';

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
 * - API response handling with source/warning/error display
 * 
 * Usage:
 * ```typescript
 * // Basic notifications
 * this.toastService.showError('Error message');
 * this.toastService.showSuccess('Success message');
 * 
 * // After loading data, show source info
 * this.toastService.showDataSyncSuccess('Trading history', 'tradelocker', 245);
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
   * @param message - The error message to display
   * @param titleOrDuration - Optional title string or duration in milliseconds
   */
  showError(message: string, titleOrDuration?: string | number): void {
    const duration = typeof titleOrDuration === 'number' ? titleOrDuration : 5000;
    this.show({
      message,
      type: 'error',
      duration
    });
  }

  /**
   * Show a warning notification
   * @param message - The warning message to display
   * @param titleOrDuration - Optional title string or duration in milliseconds
   */
  showWarning(message: string, titleOrDuration?: string | number): void {
    const duration = typeof titleOrDuration === 'number' ? titleOrDuration : 5000;
    this.show({
      message,
      type: 'warning',
      duration
    });
  }

  /**
   * Show a success notification
   * @param message - The success message to display
   * @param titleOrDuration - Optional title string or duration in milliseconds
   */
  showSuccess(message: string, titleOrDuration?: string | number): void {
    const duration = typeof titleOrDuration === 'number' ? titleOrDuration : 3000;
    this.show({
      message,
      type: 'success',
      duration
    });
  }

  /**
   * Show an info notification
   * @param message - The info message to display
   * @param titleOrDuration - Optional title string or duration in milliseconds
   */
  showInfo(message: string, titleOrDuration?: string | number): void {
    const duration = typeof titleOrDuration === 'number' ? titleOrDuration : 4000;
    this.show({
      message,
      type: 'info',
      duration
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
   * Extract error message from backend error response.
   * Filter format: { success: false, error: { message, statusCode }, timestamp }
   * Body is at error.error (HttpErrorResponse) or error (thrown body).
   */
  extractErrorMessage(error: any): string {
    const body = error?.error ?? error;
    if (body?.error?.message) return body.error.message;
    if (body?.message) return body.message;
    if (error?.message) return error.message;
    if (typeof error === 'string') return error;
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
   * Show success toast after data has been loaded.
   * Call this from components AFTER data is displayed to the user.
   * 
   * @param context - What data was loaded (e.g., "Trading history", "Balance", "Accounts")
   * @param source - Data source (e.g., "tradelocker", "firebase")
   * @param responseTimeMs - Optional response time in milliseconds
   * @param retryInfo - Optional retry information from backend
   */
  showDataSyncSuccess(
    context: string,
    source: ApiDataSource,
    responseTimeMs?: number,
    retryInfo?: ApiRetryInfo
  ): void {
    const sourceLabel = this.getSourceLabel(source);
    const timeText = responseTimeMs ? ` in ${this.formatResponseTime(responseTimeMs)}` : '';
    
    let message: string;
    if (retryInfo?.attempted && retryInfo.totalAttempts > 1) {
      message = `${context} synced from ${sourceLabel} API${timeText} (${retryInfo.totalAttempts} attempts)`;
    } else {
      message = `${context} synced from ${sourceLabel} API${timeText}`;
    }

    this.showSuccess(message, 3000);
  }

  /**
   * Show warning toast when data comes from a fallback source.
   * Call this from components when backend returns a warning.
   */
  showFallbackWarning(warning: ApiWarning, responseTimeMs?: number): void {
    const message = this.buildFallbackMessage(warning, responseTimeMs);
    this.showWarning(message, 6000);
  }

  /**
   * Show error toast from API error response.
   * Call this from components when backend returns an error.
   */
  showApiError(error: ApiError, context?: string): void {
    const sourceLabel = error.source ? this.getSourceLabel(error.source) : 'server';
    const contextText = context ? ` fetching ${context}` : '';
    const errorDetail = error.code ? this.getErrorDetail(error.code, error.message) : error.message;
    
    const message = `Error from ${sourceLabel}${contextText}: ${errorDetail}`;
    this.showError(message, 6000);
  }

  /**
   * Handle a complete API response and show appropriate toast.
   * Call this from components AFTER data is displayed.
   * 
   * @param response - The backend API response
   * @param context - What data was loaded (e.g., "Trading history")
   * @param responseTimeMs - Optional response time in milliseconds
   */
  handleApiResponse<T>(
    response: BackendApiResponse<T>,
    context: string,
    responseTimeMs?: number
  ): void {
    if (!response.success && response.error) {
      this.showApiError(response.error, context);
      return;
    }

    if (response.warning) {
      this.showFallbackWarning(response.warning, responseTimeMs);
      return;
    }

    if (response.source) {
      this.showDataSyncSuccess(context, response.source, responseTimeMs, response.retryInfo);
    }
  }

  /**
   * Get human-readable label for data source
   */
  getSourceLabel(source: ApiDataSource): string {
    const labels: Record<ApiDataSource, string> = {
      tradelocker: 'TradeLocker',
      firebase: 'local cache',
      stripe: 'Stripe',
      cache: 'cache',
      local: 'local data'
    };
    return labels[source] || source;
  }

  /**
   * Format response time for display
   */
  formatResponseTime(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    return `${(ms / 1000).toFixed(1)}s`;
  }

  /**
   * Build fallback warning message in English
   */
  private buildFallbackMessage(warning: ApiWarning, responseTimeMs?: number): string {
    const failedSource = this.getSourceLabel(warning.failedSource);
    const actualSource = this.getSourceLabel(warning.actualSource);
    const timeText = responseTimeMs ? ` (${this.formatResponseTime(responseTimeMs)})` : '';
    
    let baseMessage = `${failedSource} API unavailable. Showing cached data from ${actualSource}${timeText}.`;
    
    if (warning.originalError) {
      const errorDetail = this.getErrorDetail(warning.originalError.code, warning.originalError.message);
      if (errorDetail) {
        baseMessage += ` ${errorDetail}`;
      }
    }
    
    return baseMessage;
  }

  /**
   * Get user-friendly error detail message in English
   */
  private getErrorDetail(code: string, originalMessage: string): string {
    const errorMessages: Record<string, string> = {
      'TRADELOCKER_API_ERROR': 'Connection error with TradeLocker.',
      'TRADELOCKER_RATE_LIMIT': 'Too many requests to TradeLocker. Please try again later.',
      'TRADELOCKER_UNAUTHORIZED': 'TradeLocker session expired.',
      'TRADELOCKER_NOT_FOUND': 'Account not found in TradeLocker.',
      'FIREBASE_NOT_FOUND': 'Data not found in the system.',
      'FIREBASE_ERROR': 'Error accessing saved data.',
      'NETWORK_ERROR': 'Connection error. Please check your internet.',
      'TIMEOUT': 'Request timed out. Please try again.'
    };

    if (errorMessages[code]) {
      return errorMessages[code];
    }

    if (originalMessage.includes('Too Many Requests') || originalMessage.includes('429')) {
      return 'Too many requests. Showing data from last sync.';
    }

    if (originalMessage.includes('Unauthorized') || originalMessage.includes('401')) {
      return 'Session expired. Showing data from last sync.';
    }

    return '';
  }

  /**
   * Generate unique ID for notification
   */
  private generateId(): string {
    return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

