import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BackendDatePipe } from '../../pipes/backend-date.pipe';

/**
 * Componente para mostrar fechas que vienen del backend en formato dd/mm/yyyy.
 * Todas las fechas traídas del back (ISO 2026-03-04T22:22:34.113Z) deben mostrarse con este componente.
 * Las fechas calculadas en el front se dejan tal cual.
 */
@Component({
  selector: 'app-backend-date',
  standalone: true,
  imports: [CommonModule, BackendDatePipe],
  template: `{{ value | backendDate:format }}`,
})
export class BackendDateComponent {
  /** Fecha del backend: string ISO, number (timestamp), Date u objeto con toDate()/seconds */
  @Input() value: unknown;
  /** 'date' = dd/mm/yyyy, 'datetime' = dd/mm/yyyy HH:mm */
  @Input() format: 'date' | 'datetime' = 'date';
}
