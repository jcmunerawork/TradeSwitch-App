import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Barra de filtros de la página de estrategias: búsqueda por nombre y botón Add Strategy.
 * Presentacional; el padre maneja el estado y las acciones.
 */
@Component({
  selector: 'app-strategy-filters',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './strategy-filters.component.html',
  styleUrl: './strategy-filters.component.scss',
})
export class StrategyFiltersComponent {
  @Input() searchTerm = '';
  @Input() isAddStrategyDisabled = false;

  @Output() searchChange = new EventEmitter<string>();
  @Output() addStrategy = new EventEmitter<void>();

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchChange.emit(value);
  }

  onAddClick(): void {
    if (!this.isAddStrategyDisabled) {
      this.addStrategy.emit();
    }
  }
}
