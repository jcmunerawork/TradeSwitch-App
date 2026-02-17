/**
 * Barrel export para los servicios del módulo core.
 *
 * Servicios disponibles:
 * - AlertService: diálogos de alerta (info, warning, error, success)
 * - BaseApiService (api.service): clase base para servicios HTTP
 * - ConfigService: configuración de app, API, Firebase y features
 * - ErrorHandlerService: normalización y mensajes de errores
 * - LoggerService: logging por niveles (debug, info, warn, error)
 */
export * from './alert.service';
export * from './api.service';
export * from './config.service';
export * from './error-handler.service';
export * from './logger.service';
