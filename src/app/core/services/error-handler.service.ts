import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { LoggerService } from './logger.service';
import { 
  AppError, 
  NetworkError, 
  AuthenticationError, 
  AuthorizationError,
  ValidationError 
} from '../models/errors.model';

/**
 * Centralized error handling service.
 *
 * This service provides a unified way to handle and transform errors
 * throughout the application, converting HTTP errors to user-friendly messages
 * and application-specific error types.
 *
 * Features:
 * - HTTP error to user message conversion
 * - Error logging integration
 * - Custom error type creation
 * - Error context tracking
 *
 * Relations:
 * - LoggerService: Logs errors for debugging
 * - AlertService: Can be used to show user-friendly messages
 *
 * @service
 * @injectable
 * @providedIn root
 */
@Injectable({ providedIn: 'root' })
export class ErrorHandlerService {
  constructor(private logger: LoggerService) {}

  /**
   * Get a user-friendly error message from any error type.
   */
  getErrorMessage(error: HttpErrorResponse | Error | AppError | unknown): string {
    if (error instanceof AppError) {
      return error.message;
    }

    if (error instanceof HttpErrorResponse) {
      return this.getHttpErrorMessage(error);
    }

    if (error instanceof Error) {
      return error.message || 'An unexpected error occurred';
    }

    return 'An unexpected error occurred. Please try again.';
  }

  /**
   * Convert HTTP error response to user-friendly message.
   */
  private getHttpErrorMessage(error: HttpErrorResponse): string {
    // Check for custom error message from server
    if (error.error?.message) {
      return error.error.message;
    }

    // Check for validation errors
    if (error.error?.errors && Array.isArray(error.error.errors)) {
      return error.error.errors.join(', ');
    }

    // Map HTTP status codes to user-friendly messages
    switch (error.status) {
      case 0:
        return 'Network error. Please check your internet connection and try again.';
      case 400:
        return 'Invalid request. Please check your input and try again.';
      case 401:
        return 'Your session has expired. Please log in again.';
      case 403:
        return 'Access denied. You don\'t have permission to perform this action.';
      case 404:
        return 'The requested resource was not found.';
      case 409:
        return 'A conflict occurred. The resource may have been modified by another user.';
      case 422:
        return 'Validation error. Please check your input.';
      case 429:
        return 'Too many requests. Please wait a moment and try again.';
      case 500:
        return 'Server error. Our team has been notified. Please try again later.';
      case 502:
      case 503:
        return 'Service temporarily unavailable. Please try again later.';
      case 504:
        return 'Request timeout. Please try again.';
      default:
        return error.message || 'An error occurred. Please try again.';
    }
  }

  /**
   * Log error with context information.
   */
  logError(error: Error | HttpErrorResponse | AppError, context?: string): void {
    const errorInfo = {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      status: error instanceof HttpErrorResponse ? error.status : undefined,
      url: error instanceof HttpErrorResponse ? error.url : undefined,
      context,
      timestamp: new Date().toISOString(),
    };

    this.logger.error('Error occurred', context, errorInfo);

    // Send to error tracking service (Sentry, etc.)
    // Example: Sentry.captureException(error, { contexts: { custom: errorInfo } });
  }

  /**
   * Create an AppError from an HTTP error response.
   */
  createAppError(error: HttpErrorResponse): AppError {
    const message = this.getHttpErrorMessage(error);

    switch (error.status) {
      case 401:
        return new AuthenticationError(message);
      case 403:
        return new AuthorizationError(message);
      case 400:
      case 422:
        return new ValidationError(message, error.error?.errors || []);
      case 0:
        return new NetworkError(message);
      default:
        return new AppError(message, `HTTP_${error.status}`);
    }
  }

  /**
   * Handle error and return appropriate error type.
   */
  handleError(error: unknown, context?: string): AppError {
    if (error instanceof AppError) {
      this.logError(error, context);
      return error;
    }

    if (error instanceof HttpErrorResponse) {
      const appError = this.createAppError(error);
      this.logError(error, context);
      return appError;
    }

    if (error instanceof Error) {
      this.logError(error, context);
      return new AppError(error.message, 'UNKNOWN_ERROR');
    }

    const message = 'An unexpected error occurred';
    this.logger.error(message, context, error);
    return new AppError(message, 'UNKNOWN_ERROR');
  }
}
