import { inject, Injectable } from '@angular/core';
import { ToastNotificationService } from '../services/toast-notification.service';
import { BackendApiResponse } from '../../core/services/backend-api.service';

/**
 * Utility service for handling API responses with fallback support.
 * 
 * This service processes backend responses and automatically shows
 * appropriate toast notifications when:
 * - Data comes from a fallback source (warning)
 * - An error occurred
 * - Operation was successful
 * 
 * Usage:
 * ```typescript
 * const response = await this.backendApi.getTradeLockerBalance(...);
 * this.apiResponseHandler.handle(response, {
 *   successMessage: 'Balance updated',
 *   showSuccessToast: false // optional, default false
 * });
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class ApiResponseHandler {
  private toastService = inject(ToastNotificationService);

  /**
   * Handle a backend API response and show appropriate toasts.
   * 
   * @param response - The backend API response
   * @param options - Configuration options
   * @returns The response data if successful, undefined otherwise
   */
  handle<T>(
    response: BackendApiResponse<T>,
    options: HandleOptions = {}
  ): T | undefined {
    const {
      successMessage,
      showSuccessToast = false,
      showWarningToast = true,
      warningDuration = 6000,
      successDuration = 3000
    } = options;

    if (!response.success) {
      if (response.error) {
        this.toastService.showBackendError(response);
      }
      return undefined;
    }

    if (response.warning && showWarningToast) {
      this.toastService.showFallbackWarning(response.warning);
    }

    if (showSuccessToast && successMessage && response.source) {
      this.toastService.showDataSyncSuccess(successMessage, response.source);
    }

    return response.data;
  }

  /**
   * Check if response has a warning (data from fallback source)
   */
  hasWarning<T>(response: BackendApiResponse<T>): boolean {
    return !!response.warning;
  }

  /**
   * Check if response data comes from the expected source
   */
  isFromSource<T>(response: BackendApiResponse<T>, expectedSource: string): boolean {
    return response.source === expectedSource;
  }

  /**
   * Get a user-friendly message about the data source
   */
  getSourceMessage<T>(response: BackendApiResponse<T>): string | null {
    if (!response.warning) {
      return null;
    }

    const sourceLabels: Record<string, string> = {
      tradelocker: 'TradeLocker',
      firebase: 'saved data',
      stripe: 'Stripe',
      cache: 'cache'
    };

    const actualSource = sourceLabels[response.warning.actualSource] || response.warning.actualSource;
    return `Data retrieved from ${actualSource}`;
  }
}

export interface HandleOptions {
  successMessage?: string;
  showSuccessToast?: boolean;
  showWarningToast?: boolean;
  warningDuration?: number;
  successDuration?: number;
}
