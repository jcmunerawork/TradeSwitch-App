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
 * Standard API response wrapper.
 */
export interface ApiResponse<T> {
  data: T;
  status: number;
  message?: string;
  errors?: string[];
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
}
