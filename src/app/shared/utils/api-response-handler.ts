import { inject, Injectable } from '@angular/core';
import { ToastNotificationService } from '../services/toast-notification.service';
import { BackendApiResponse } from '../../core/services/backend-api.service';
import { ApiDataSource } from '../../core/models/api-response.model';

/**
 * UI severity levels derived from backend retry system and fallbacks.
 */
export type UiSeverity = 'ok' | 'warning' | 'error' | 'blocked';

/**
 * Minimal UI state derived from a backend API response.
 * Centraliza la lógica de:
 * - severidad
 * - mensaje para el usuario
 * - política de reintento
 */
export interface ApiUiState {
  severity: UiSeverity;
  userMessage: string;
  canRetry: boolean;
  retryAfterMs?: number;
}

/**
 * Utilidad para formatear un delay en ms a texto legible (segundos/minutos).
 */
function formatDelayMs(ms?: number): string {
  if (!ms || ms <= 0) {
    return '';
  }

  const seconds = Math.round(ms / 1000);
  if (seconds < 60) {
    return `${seconds} segundos`;
  }

  const minutes = Math.round(seconds / 60);
  return `${minutes} minuto${minutes !== 1 ? 's' : ''}`;
}

/**
 * Mapea un `BackendApiResponse` a un estado de UI genérico.
 * 
 * Implementa las reglas descritas en el sistema de reintentos del backend:
 * - Distingue entre éxito normal, éxito tras reintentos y éxito con fallback/cache/local.
 * - Clasifica errores temporales vs permanentes.
 * - Trata de forma específica CIRCUIT_OPEN y RATE_LIMIT_LOCAL.
 * - Expone `canRetry` y `retryAfterMs` para controlar botones/contadores de reintento.
 */
export function mapBackendResponseToUiState<T>(
  response: BackendApiResponse<T>
): ApiUiState {
  // Éxitos
  if (response.success) {
    const retryInfo = response.retryInfo;
    const source = response.source as ApiDataSource | undefined;

    // 1.3 / 1.5: éxito desde cache o local con warning (fallback)
    if (response.warning && source) {
      if (source === 'cache') {
        return {
          severity: 'warning',
          userMessage:
            response.warning.message ||
            'Mostrando datos cacheados porque TradeLocker está teniendo problemas. Puede que no estén al día.',
          canRetry: false,
        };
      }

      if (source === 'local') {
        return {
          severity: 'warning',
          userMessage:
            response.warning.message ||
            'Could not get real-time data. Showing a controlled empty list.',
          canRetry: false,
        };
      }

      // Otros fallbacks (por si en el futuro hay más)
      return {
        severity: 'warning',
        userMessage:
          response.warning.message ||
          'Se están usando datos de una fuente alternativa debido a problemas temporales.',
        canRetry: false,
      };
    }

    // 1.2: éxito desde TradeLocker después de reintentos
    if (
      retryInfo &&
      retryInfo.attempted &&
      retryInfo.totalAttempts > 1 &&
      retryInfo.finalStatus === 'success_after_retry'
    ) {
      return {
        severity: 'warning',
        userMessage:
          'Datos obtenidos tras reconectar con el broker. Puede haber habido un problema temporal.',
        canRetry: false,
      };
    }

    // 1.1 / 1.4: éxito directo (TradeLocker/Firebase/otros) sin reintentos relevantes
    return {
      severity: 'ok',
      userMessage: response.message || '',
      canRetry: false,
    };
  }

  // Errores
  const error = response.error;
  const retryInfo = response.retryInfo || (error as any)?.retryInfo;

  const code = error?.code || '';
  const statusCode = error?.statusCode;
  const finalStatus = retryInfo?.finalStatus;
  const retryAvailable = retryInfo?.nextRetryAvailable === true;
  const retryAfterMs = retryAvailable ? retryInfo?.suggestedRetryDelayMs : undefined;

  // 2.3: Circuit breaker abierto
  if (code === 'CIRCUIT_OPEN' || finalStatus === 'circuit_open') {
    const delayText = formatDelayMs(retryAfterMs ?? 60000);
    return {
      severity: 'blocked',
      userMessage:
        delayText
          ? `El broker está temporalmente bloqueado por demasiados errores. Espera ${delayText} antes de volver a intentarlo.`
          : 'El broker está temporalmente bloqueado por demasiados errores. Espera un momento antes de volver a intentarlo.',
      canRetry: retryAvailable,
      retryAfterMs,
    };
  }

  // 2.4: Rate limiting local
  if (code === 'RATE_LIMIT_LOCAL' || finalStatus === 'rate_limited_local') {
    const delayText = formatDelayMs(retryAfterMs ?? 60000);
    return {
      severity: 'blocked',
      userMessage:
        delayText
          ? `Has hecho demasiadas peticiones en poco tiempo. Espera ${delayText} antes de volver a intentarlo.`
          : 'Has hecho demasiadas peticiones en poco tiempo. Espera unos segundos antes de volver a intentarlo.',
      canRetry: retryAvailable,
      retryAfterMs,
    };
  }

  const isTradeLockerError =
    code.startsWith('TRADELOCKER_') || error?.source === 'tradelocker';
  const isFirebaseError =
    code.startsWith('FIREBASE_') || error?.source === 'firebase';
  const isValidationError = code === 'VALIDATION_ERROR';

  // 2.2 / 2.5: Error tras agotar reintentos (fallo temporal no recuperado, incl. rate limit externo)
  if (finalStatus === 'failed_after_retry') {
    let baseMessage =
      'No hemos podido completar la operación tras varios intentos.';

    if (isTradeLockerError) {
      baseMessage = 'No hemos podido conectar con TradeLocker tras varios intentos.';

      if (statusCode === 429) {
        baseMessage +=
          ' El broker está aplicando un límite de peticiones (rate limit).';
      }
    }

    const delayText = retryAvailable ? formatDelayMs(retryAfterMs) : '';
    const retryText = retryAvailable
      ? delayText
        ? ` Intenta de nuevo en ${delayText}.`
        : ' Intenta de nuevo pasados unos segundos.'
      : '';

    return {
      severity: 'error',
      userMessage: baseMessage + retryText,
      canRetry: retryAvailable,
      retryAfterMs,
    };
  }

  // 2.1: Error no reintentable (permanente)
  if (finalStatus === 'failed_non_retryable') {
    let baseMessage = 'No se ha podido completar la operación.';

    if (isValidationError) {
      baseMessage =
        'Hay un problema con los datos enviados. Corrige los datos del formulario o contacta con soporte.';
    } else if (isTradeLockerError || isFirebaseError) {
      baseMessage =
        'Hay un problema permanente con las credenciales o permisos. Revisa la configuración o contacta con soporte.';
    }

    const detail = error?.message ? ` Detalle: ${error.message}` : '';

    return {
      severity: 'error',
      userMessage: baseMessage + detail,
      canRetry: retryAvailable,
      retryAfterMs,
    };
  }

  // Caso genérico de error (por defecto, sin info clara de reintentos)
  return {
    severity: 'error',
    userMessage:
      error?.message || 'No se ha podido completar la operación. Inténtalo de nuevo más tarde.',
    canRetry: retryAvailable,
    retryAfterMs,
  };
}

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
