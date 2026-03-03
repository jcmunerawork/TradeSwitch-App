/**
 * Base models for API responses and common data structures.
 */

/**
 * Base entity interface for all database entities.
 */
export interface BaseEntity {
  id: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Data source types for API responses
 */
export type ApiDataSource = 'tradelocker' | 'firebase' | 'stripe' | 'cache' | 'local';

/**
 * Original error information when a source fails
 */
export interface ApiOriginalError {
  source: ApiDataSource;
  code: string;
  message: string;
  statusCode?: number;
}

/**
 * Warning information when fallback data is used
 */
export interface ApiWarning {
  failedSource: ApiDataSource;
  actualSource: ApiDataSource;
  message: string;
  originalError?: ApiOriginalError;
}

/**
 * Error information in API responses
 */
export interface ApiError {
  message: string;
  source?: ApiDataSource;
  code?: string;
  statusCode?: number;
  details?: any;
  retryInfo?: ApiRetryInfo;
}

/**
 * Retry status types from backend automatic retry system
 */
export type ApiRetryStatus = 
  | 'success_first_attempt'    // Success on first try, no retries needed
  | 'success_after_retry'      // Success after one or more retries
  | 'failed_after_retry'       // Failed after exhausting all retries
  | 'failed_non_retryable'     // Failed with non-retryable error (no retries attempted)
  | 'circuit_open'             // Circuit breaker is open, calls are short-circuited
  | 'rate_limited_local';      // Local backend rate limiting (before calling provider)

/**
 * Retry information from backend automatic retry system
 */
export interface ApiRetryInfo {
  attempted: boolean;              // Whether retries were attempted
  totalAttempts: number;           // Total number of attempts (1 = no retries)
  retriedAt: number[];             // Timestamps of each retry attempt
  finalStatus: ApiRetryStatus;     // Final status of the operation
  nextRetryAvailable: boolean;     // Whether frontend can trigger manual retry
  suggestedRetryDelayMs?: number;  // Suggested delay for frontend manual retry
}

/**
 * Standard API response wrapper with source and warning support.
 */
export interface ApiResponse<T> {
  data: T;
  status: number;
  message?: string;
  errors?: string[];
  source?: ApiDataSource;
  warning?: ApiWarning;
}

/**
 * Enhanced backend API response with fallback and retry support.
 * Used for responses that may include data from alternative sources
 * and information about automatic retry attempts.
 */
export interface EnhancedApiResponse<T> {
  success: boolean;
  data?: T;
  source?: ApiDataSource;
  message?: string;
  warning?: ApiWarning;
  error?: ApiError;
  timestamp?: string;
  retryInfo?: ApiRetryInfo;
}

/**
 * Paginated API response.
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Error response from API.
 */
export interface ApiErrorResponse {
  status: number;
  message: string;
  errors?: string[];
  code?: string;
  source?: ApiDataSource;
}
