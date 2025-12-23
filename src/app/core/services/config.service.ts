import { Injectable } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, inject } from '@angular/core';

/**
 * Application configuration interface.
 */
export interface AppConfig {
  apiUrl: string;
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
    measurementId?: string;
  };
  tradeLocker: {
    baseUrl: string;
  };
  features: {
    enableAnalytics: boolean;
    enableErrorTracking: boolean;
    enableLogging: boolean;
  };
  environment: 'development' | 'production' | 'staging';
}

/**
 * Centralized configuration service.
 *
 * This service provides access to application configuration including
 * API URLs, Firebase settings, feature flags, and environment information.
 *
 * Features:
 * - Environment-based configuration
 * - Firebase configuration
 * - Feature flags
 * - API endpoints
 *
 * Usage:
 * ```typescript
 * const apiUrl = this.config.apiUrl;
 * const firebaseConfig = this.config.firebaseConfig;
 * ```
 *
 * @service
 * @injectable
 * @providedIn root
 */
@Injectable({ providedIn: 'root' })
export class ConfigService {
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  private config: AppConfig = {
    apiUrl: this.getEnvVar('API_URL') || 'http://localhost:3000/api',
    firebase: {
      apiKey: this.getEnvVar('FIREBASE_API_KEY') || '',
      authDomain: this.getEnvVar('FIREBASE_AUTH_DOMAIN') || '',
      projectId: this.getEnvVar('FIREBASE_PROJECT_ID') || '',
      storageBucket: this.getEnvVar('FIREBASE_STORAGE_BUCKET') || '',
      messagingSenderId: this.getEnvVar('FIREBASE_MESSAGING_SENDER_ID') || '',
      appId: this.getEnvVar('FIREBASE_APP_ID') || '',
      measurementId: this.getEnvVar('FIREBASE_MEASUREMENT_ID') || '',
    },
    tradeLocker: {
      baseUrl: 'https://demo.tradelocker.com/backend-api',
    },
    features: {
      enableAnalytics: this.isProduction,
      enableErrorTracking: this.isProduction,
      enableLogging: !this.isProduction,
    },
    environment: this.getEnvironment(),
  };

  /**
   * Get API base URL.
   */
  get apiUrl(): string {
    return this.config.apiUrl;
  }

  /**
   * Get Firebase configuration.
   */
  get firebaseConfig(): AppConfig['firebase'] {
    return this.config.firebase;
  }

  /**
   * Get TradeLocker API base URL.
   */
  get tradeLockerBaseUrl(): string {
    return this.config.tradeLocker.baseUrl;
  }

  /**
   * Check if running in production environment.
   */
  get isProduction(): boolean {
    return this.config.environment === 'production';
  }

  /**
   * Check if running in development environment.
   */
  get isDevelopment(): boolean {
    return this.config.environment === 'development';
  }

  /**
   * Get feature flags.
   */
  get features(): AppConfig['features'] {
    return this.config.features;
  }

  /**
   * Get current environment.
   */
  get environment(): string {
    return this.config.environment;
  }

  /**
   * Get full configuration object.
   */
  getConfig(): AppConfig {
    return { ...this.config };
  }

  /**
   * Get environment variable (works in browser and server).
   */
  private getEnvVar(key: string): string | undefined {
    if (this.isBrowser) {
      // In browser, check window or process.env (if available)
      return (window as any)?.__ENV__?.[key] || undefined;
    } else {
      // In server, use process.env
      return process.env[key];
    }
  }

  /**
   * Determine current environment.
   */
  private getEnvironment(): 'development' | 'production' | 'staging' {
    if (this.isBrowser) {
      const hostname = window.location.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'development';
      }
      if (hostname.includes('staging')) {
        return 'staging';
      }
      return 'production';
    }
    
    // Server-side: check NODE_ENV
    const nodeEnv = process.env['NODE_ENV'];
    if (nodeEnv === 'production') {
      return 'production';
    }
    if (nodeEnv === 'staging') {
      return 'staging';
    }
    return 'development';
  }
}
