/**
 * Clases de error personalizadas para el manejo de errores en la aplicación.
 *
 * Jerarquía: AppError (base) → ValidationError, NetworkError, AuthenticationError, AuthorizationError.
 * Permiten tipar y tratar errores por código y mensaje de forma consistente.
 */

/**
 * Error base de la aplicación. Incluye código para identificar el tipo de error.
 */
export class AppError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Error de validación (formularios o datos). Opcionalmente incluye lista de campos afectados.
 */
export class ValidationError extends AppError {
  constructor(message: string, public fields: string[] = []) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Error de red o conexión (fallos HTTP, sin conexión, etc.).
 */
export class NetworkError extends AppError {
  constructor(message: string = 'Network connection failed') {
    super(message, 'NETWORK_ERROR');
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

/**
 * Error de autenticación (credenciales, sesión expirada, etc.).
 */
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 'AUTH_ERROR');
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * Error de autorización (permisos insuficientes para la acción).
 */
export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}
