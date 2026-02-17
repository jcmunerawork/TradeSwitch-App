/**
 * Barrel export para los guards del módulo core.
 *
 * Exporta los guards de autenticación, redirección y limitaciones de plan
 * para su uso en las rutas de la aplicación.
 *
 * Guards disponibles:
 * - authGuard: Protege rutas que requieren usuario autenticado
 * - redirectGuard: Redirige tras login según rol (admin/estrategia)
 * - PlanLimitationsGuard: Verifica límites del plan (cuentas, estrategias)
 */
export * from './auth.guard';
export * from './redirect.guard';
export * from './plan-limitations.guard';
