import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './config.service';
import { BaseEntity, ApiResponse, PaginatedResponse } from '../models/api-response.model';

/**
 * Base API service for HTTP operations.
 *
 * This abstract class provides common HTTP methods (GET, POST, PUT, DELETE)
 * that can be extended by specific API services. It handles base URL configuration
 * and provides a consistent interface for API calls.
 *
 * Features:
 * - Abstract base class for API services
 * - Common HTTP methods (GET, POST, PUT, DELETE)
 * - Type-safe responses
 * - Configurable base URL
 *
 * Usage:
 * ```typescript
 * @Injectable({ providedIn: 'root' })
 * export class UserApiService extends BaseApiService {
 *   protected apiUrl = '/api/users';
 *
 *   getUsers(): Observable<User[]> {
 *     return this.get<User[]>('');
 *   }
 * }
 * ```
 *
 * @abstract
 * @class BaseApiService
 */
@Injectable()
export abstract class BaseApiService {
  protected http = inject(HttpClient);
  protected config = inject(ConfigService);

  /**
   * Base API URL for this service.
   * Must be defined by subclasses.
   */
  protected abstract apiUrl: string;

  /**
   * Get full URL for an endpoint.
   */
  protected getUrl(endpoint: string): string {
    const baseUrl = this.apiUrl.startsWith('http') 
      ? this.apiUrl 
      : `${this.config.apiUrl}${this.apiUrl}`;
    
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    return `${baseUrl}/${cleanEndpoint}`;
  }

  /**
   * Create default headers.
   */
  protected getHeaders(customHeaders?: Record<string, string>): HttpHeaders {
    let headers = new HttpHeaders({
      'Content-Type': 'application/json',
    });

    if (customHeaders) {
      Object.keys(customHeaders).forEach(key => {
        headers = headers.set(key, customHeaders[key]);
      });
    }

    return headers;
  }

  /**
   * GET request.
   */
  protected get<T>(
    endpoint: string,
    params?: Record<string, any>,
    options?: { headers?: Record<string, string> }
  ): Observable<T> {
    let httpParams = new HttpParams();
    
    if (params) {
      Object.keys(params).forEach(key => {
        const value = params[key];
        if (value !== null && value !== undefined) {
          httpParams = httpParams.set(key, String(value));
        }
      });
    }

    const headers = options?.headers 
      ? this.getHeaders(options.headers)
      : this.getHeaders();

    return this.http.get<T>(this.getUrl(endpoint), {
      params: httpParams,
      headers,
    });
  }

  /**
   * POST request.
   */
  protected post<T>(
    endpoint: string,
    body: any,
    options?: { headers?: Record<string, string> }
  ): Observable<T> {
    const headers = options?.headers 
      ? this.getHeaders(options.headers)
      : this.getHeaders();

    return this.http.post<T>(this.getUrl(endpoint), body, { headers });
  }

  /**
   * PUT request.
   */
  protected put<T>(
    endpoint: string,
    body: any,
    options?: { headers?: Record<string, string> }
  ): Observable<T> {
    const headers = options?.headers 
      ? this.getHeaders(options.headers)
      : this.getHeaders();

    return this.http.put<T>(this.getUrl(endpoint), body, { headers });
  }

  /**
   * PATCH request.
   */
  protected patch<T>(
    endpoint: string,
    body: any,
    options?: { headers?: Record<string, string> }
  ): Observable<T> {
    const headers = options?.headers 
      ? this.getHeaders(options.headers)
      : this.getHeaders();

    return this.http.patch<T>(this.getUrl(endpoint), body, { headers });
  }

  /**
   * DELETE request.
   */
  protected delete<T>(
    endpoint: string,
    options?: { headers?: Record<string, string> }
  ): Observable<T> {
    const headers = options?.headers 
      ? this.getHeaders(options.headers)
      : this.getHeaders();

    return this.http.delete<T>(this.getUrl(endpoint), { headers });
  }

  /**
   * GET request with pagination support.
   */
  protected getPaginated<T extends BaseEntity>(
    endpoint: string,
    page: number = 1,
    limit: number = 10,
    params?: Record<string, any>
  ): Observable<PaginatedResponse<T>> {
    const paginationParams = {
      page,
      limit,
      ...params,
    };

    return this.get<PaginatedResponse<T>>(endpoint, paginationParams);
  }
}
