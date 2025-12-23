import { Injectable } from '@angular/core';

/**
 * Log levels for structured logging.
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Log entry structure.
 */
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: string;
  data?: any;
  stack?: string;
}

/**
 * Centralized logging service for the application.
 *
 * This service provides structured logging with different log levels
 * and can be extended to send logs to external services (Sentry, etc.).
 *
 * Features:
 * - Multiple log levels (DEBUG, INFO, WARN, ERROR)
 * - Structured logging with context
 * - Console logging (can be extended for external services)
 * - Error tracking integration ready
 *
 * Usage:
 * ```typescript
 * this.logger.debug('Debug message', 'ComponentName', { data });
 * this.logger.info('Info message', 'ServiceName');
 * this.logger.warn('Warning message', 'GuardName');
 * this.logger.error('Error message', 'ServiceName', error);
 * ```
 *
 * @service
 * @injectable
 * @providedIn root
 */
@Injectable({ providedIn: 'root' })
export class LoggerService {
  private logLevel: LogLevel = LogLevel.DEBUG;

  /**
   * Set the minimum log level.
   * Only logs at or above this level will be output.
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  /**
   * Log a debug message.
   */
  debug(message: string, context?: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, context, data);
  }

  /**
   * Log an info message.
   */
  info(message: string, context?: string, data?: any): void {
    this.log(LogLevel.INFO, message, context, data);
  }

  /**
   * Log a warning message.
   */
  warn(message: string, context?: string, data?: any): void {
    this.log(LogLevel.WARN, message, context, data);
  }

  /**
   * Log an error message.
   */
  error(message: string, context?: string, error?: Error | any): void {
    const errorData = error instanceof Error 
      ? { ...error, message: error.message, stack: error.stack }
      : error;
    
    this.log(LogLevel.ERROR, message, context, errorData);
    
    // Here you can integrate with error tracking services
    // Example: Sentry.captureException(error);
  }

  /**
   * Internal log method that handles all logging.
   */
  private log(level: LogLevel, message: string, context?: string, data?: any): void {
    if (level < this.logLevel) {
      return;
    }

    const logEntry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
      data,
    };

    const logMessage = `[${LogLevel[level]}] ${context ? `[${context}]` : ''} ${message}`;

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(logMessage, data || '');
        break;
      case LogLevel.INFO:
        console.info(logMessage, data || '');
        break;
      case LogLevel.WARN:
        console.warn(logMessage, data || '');
        break;
      case LogLevel.ERROR:
        console.error(logMessage, data || '');
        if (data?.stack) {
          console.error('Stack:', data.stack);
        }
        break;
    }

    // In production, you might want to send logs to an external service
    // this.sendToExternalService(logEntry);
  }

  /**
   * Send log entry to external service (Sentry, LogRocket, etc.).
   * Override this method to implement custom logging.
   */
  private sendToExternalService(entry: LogEntry): void {
    // Implementation for external logging service
    // Example: Sentry.captureMessage(entry.message, { level: entry.level, ... });
  }
}
