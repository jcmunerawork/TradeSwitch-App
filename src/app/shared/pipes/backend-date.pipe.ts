import { Pipe, PipeTransform } from '@angular/core';

/**
 * Convierte un valor a Date para formatear.
 * Acepta: string ISO (2026-03-04T22:22:34.113Z), number (timestamp ms/s), Date, o objeto con toDate()/seconds.
 */
function toDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const ms = value < 10000000000 ? value * 1000 : value;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'string') {
    if (!value.trim()) return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'object' && value !== null) {
    const o = value as Record<string, unknown>;
    if (typeof o['toDate'] === 'function') {
      try {
        const d = (o['toDate'] as () => Date)();
        return d && !isNaN(d.getTime()) ? d : null;
      } catch {
        return null;
      }
    }
    if (typeof o['seconds'] === 'number') {
      const d = new Date((o['seconds'] as number) * 1000);
      return isNaN(d.getTime()) ? null : d;
    }
  }
  return null;
}

/**
 * Pipe para mostrar fechas que vienen del backend (formato ISO 2026-03-04T22:22:34.113Z) en dd/mm/yyyy.
 * Usar en todo lugar donde se muestren fechas traídas del back.
 * Las fechas calculadas en el front se pueden seguir mostrando como estén.
 *
 * Uso:
 *   {{ fechaDelBackend | backendDate }}           → 04/03/2026
 *   {{ fechaDelBackend | backendDate:'datetime' }} → 04/03/2026 22:22
 */
@Pipe({
  name: 'backendDate',
  standalone: true
})
export class BackendDatePipe implements PipeTransform {
  transform(value: unknown, format?: 'date' | 'datetime'): string {
    const date = toDate(value);
    if (!date) return '';

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const out = `${day}/${month}/${year}`;

    if (format === 'datetime') {
      const h = String(date.getHours()).padStart(2, '0');
      const m = String(date.getMinutes()).padStart(2, '0');
      return `${out} ${h}:${m}`;
    }
    return out;
  }
}
