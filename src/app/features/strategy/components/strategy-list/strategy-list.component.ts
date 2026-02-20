import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfigurationOverview } from '../../models/strategy.model';
import { StrategyCardComponent, StrategyCardData } from '../../../../shared/components';

/**
 * Lista de "Other Strategies": grid de cards y empty states (añadir más, upgrade plan, sin resultados de búsqueda).
 * Presentacional; el padre pasa datos y reacciona a los eventos.
 */
@Component({
  selector: 'app-strategy-list',
  standalone: true,
  imports: [CommonModule, StrategyCardComponent],
  templateUrl: './strategy-list.component.html',
  styleUrl: './strategy-list.component.scss',
})
export class StrategyListComponent {
  @Input() filteredStrategies: ConfigurationOverview[] = [];
  @Input() strategyCardsData: StrategyCardData[] = [];
  @Input() canCreateMultipleStrategies = false;
  @Input() hasActiveStrategy = false;
  @Input() userStrategiesLength = 0;
  @Input() isAddStrategyDisabled = false;
  @Input() searchTerm = '';
  /** Función del padre para formatear fechas (ej. strategy.updated_at) */
  @Input() formatDateFn: (date: Date) => string = () => '';

  @Output() edit = new EventEmitter<string>();
  @Output() favorite = new EventEmitter<string>();
  @Output() moreOptions = new EventEmitter<string>();
  @Output() customize = new EventEmitter<string>();
  @Output() editStrategy = new EventEmitter<string>();
  @Output() duplicate = new EventEmitter<string>();
  @Output() delete = new EventEmitter<string>();
  @Output() addStrategy = new EventEmitter<void>();
  @Output() upgradePlan = new EventEmitter<void>();
  @Output() clearSearch = new EventEmitter<void>();

  getStrategyId(strategy: ConfigurationOverview): string {
    return strategy?.id || '';
  }

  getCardDataByStrategyId(strategyId: string): StrategyCardData | undefined {
    return this.strategyCardsData?.find(card => card.id === strategyId);
  }

  /** Convierte updated_at (Firestore timestamp o similar) a Date para formatear */
  toDate(value: any): Date {
    if (!value) return new Date();
    if (value instanceof Date) return value;
    if (typeof value?.toDate === 'function') return value.toDate();
    if (value.seconds != null) return new Date(value.seconds * 1000 + (value.nanoseconds || 0) / 1e6);
    if (typeof value === 'string' || typeof value === 'number') return new Date(value);
    return new Date();
  }

  fallbackCardData(strategy: ConfigurationOverview): StrategyCardData {
    const id = this.getStrategyId(strategy);
    return {
      id,
      name: strategy.name,
      status: false,
      lastModified: this.formatDateFn(this.toDate(strategy.updated_at)),
      rules: 0,
      days_active: strategy.days_active ?? 0,
      winRate: 0,
      isFavorite: false,
      created_at: strategy.created_at,
      updated_at: strategy.updated_at,
      userId: strategy.userId ?? '',
      configurationId: strategy.configurationId ?? '',
    };
  }
}
