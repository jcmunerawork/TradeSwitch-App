/**
 * Modelos base para respuestas de API y estructuras comunes.
 *
 * Define interfaces para entidades, respuestas estándar, paginación y errores
 * devueltos por el backend.
 */

/**
 * Entidad base con id y timestamps para documentos de base de datos.
 */
export interface BaseEntity {
  id: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Envoltorio estándar de respuesta de API con datos tipados.
 */
export interface ApiResponse<T> {
  data: T;
  status: number;
  message?: string;
  errors?: string[];
}

/**
 * Respuesta de API con lista paginada y metadatos de paginación.
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
 * Estructura de error devuelta por la API.
 */
export interface ApiErrorResponse {
  status: number;
  message: string;
  errors?: string[];
  code?: string;
}
