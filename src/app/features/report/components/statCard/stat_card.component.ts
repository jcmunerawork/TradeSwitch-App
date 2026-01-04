import { CommonModule } from '@angular/common';
import { Component, Input, Injectable } from '@angular/core';
import { NumberFormatterService } from '../../../../shared/utils/number-formatter.service';

/**
 * Component for displaying a statistical card with formatted values.
 *
 * This component displays a title and value with automatic formatting based on the format type
 * or by auto-detecting the format from the title. It also applies color coding for certain metrics.
 *
 * Format types:
 * - 'currency': Formats as currency (e.g., $1,234.56)
 * - 'percentage': Formats as percentage (e.g., 45.5%)
 * - 'number': Formats as number or integer based on title
 *
 * Color coding:
 * - Net P&L: Green for positive, red for negative
 * - Profit Factor: Green if >= 1.0, red if < 1.0
 * - Trade Win %: Green if >= 50%, red if < 50%
 * - Avg Win/Loss: Green if >= 1.0, red if < 1.0
 *
 * @component
 * @selector app-stat-card
 * @standalone true
 */
@Component({
  selector: 'app-stat-card',
  templateUrl: './stat_card.component.html',
  styleUrls: ['./stat_card.component.scss'],
  standalone: true,
  imports: [CommonModule],
})
@Injectable()
export class statCardComponent {
  @Input() title!: string;
  @Input() value?: string | number;
  @Input() formatType?: 'currency' | 'percentage' | 'number';
  @Input() loading: boolean = false;

  private numberFormatter = new NumberFormatterService();

  /**
   * Gets the formatted value based on format type or auto-detection.
   *
   * If formatType is specified, uses that format. Otherwise, auto-detects format
   * from the title (e.g., titles containing "P&L" or "profit" use currency format).
   *
   * Related to:
   * - NumberFormatterService: Handles actual formatting
   *
   * @returns Formatted value string
   * @memberof statCardComponent
   */
  getFormattedValue(): string {
    if (this.value === null || this.value === undefined) {
      return '0';
    }

    switch (this.formatType) {
      case 'currency':
        return this.numberFormatter.formatCurrency(this.value);
      case 'percentage':
        return this.numberFormatter.formatPercentage(this.value);
      case 'number':
        // Check if this is a count (like total trades, active positions) that should be an integer
        if (this.title.toLowerCase().includes('total') && 
            this.title.toLowerCase().includes('trade')) {
          return this.numberFormatter.formatInteger(this.value);
        }
        if (this.title.toLowerCase().includes('active') && 
            this.title.toLowerCase().includes('position')) {
          return this.numberFormatter.formatInteger(this.value);
        }
        if (this.title.toLowerCase().includes('users')) {
          return this.numberFormatter.formatInteger(this.value);
        }
        if (this.title.toLowerCase().includes('subscriptions')) {
          return this.numberFormatter.formatInteger(this.value);
        }
        return this.numberFormatter.formatNumber(this.value);
      default:
        // Auto-detect format based on title
        if (this.title.toLowerCase().includes('p&l') || 
            this.title.toLowerCase().includes('revenue') ||
            this.title.toLowerCase().includes('sales') ||
            this.title.toLowerCase().includes('profit') ||
            this.title.toLowerCase().includes('balance')) {
          return this.numberFormatter.formatCurrency(this.value);
        } else if (this.title.toLowerCase().includes('%') || 
                   this.title.toLowerCase().includes('percent') ||
                   this.title.toLowerCase().includes('win rate')) {
          return this.numberFormatter.formatPercentage(this.value);
        } else if (this.title.toLowerCase().includes('total') && 
                   this.title.toLowerCase().includes('trade')) {
          return this.numberFormatter.formatInteger(this.value);
        } else if (this.title.toLowerCase().includes('active') && 
                   this.title.toLowerCase().includes('position')) {
          return this.numberFormatter.formatInteger(this.value);
        } else if (this.title.toLowerCase().includes('users')) {
          return this.numberFormatter.formatInteger(this.value);
        } else if (this.title.toLowerCase().includes('subscriptions')) {
          return this.numberFormatter.formatInteger(this.value);
        } else {
          return this.numberFormatter.formatNumber(this.value);
        }
    }
  }

  /**
   * Gets the CSS color class for the value based on the metric type and value.
   *
   * Applies color coding for specific metrics:
   * - Net P&L: Green (positive) or red (negative)
   * - Profit Factor: Green (>= 1.0) or red (< 1.0)
   * - Trade Win %: Green (>= 50%) or red (< 50%)
   * - Avg Win/Loss: Green (>= 1.0) or red (< 1.0)
   * - Other metrics: Default background color
   *
   * @returns CSS class name for value color
   * @memberof statCardComponent
   */
  getValueColorClass(): string {
    if (this.value === null || this.value === undefined) {
      return 'color-background';
    }

    const numericValue = Number(this.value);
    
    // Solo aplicar colores a métricas específicas
    
    // Para Net P&L: rojo si es negativo, verde si es positivo
    if (this.title.toLowerCase().includes('p&l')) {
      return numericValue < 0 ? 'color-error' : 'color-success';
    }
    
    // Para Profit Factor: rojo si es menor a 1.0, verde si es mayor a 1.0
    if (this.title.toLowerCase().includes('profit') && 
        this.title.toLowerCase().includes('factor')) {
      return numericValue < 1.0 ? 'color-error' : 'color-success';
    }
    
    // Para Trade Win %: rojo si es menor a 50%, verde si es mayor a 50%
    if (this.title.toLowerCase().includes('win') && 
        this.title.toLowerCase().includes('%')) {
      return numericValue < 50 ? 'color-error' : 'color-success';
    }
    
    // Para Avg Win/Loss: rojo si es menor a 1.0, verde si es mayor a 1.0
    if (this.title.toLowerCase().includes('avg') && 
        this.title.toLowerCase().includes('win')) {
      return numericValue < 1.0 ? 'color-error' : 'color-success';
    }
    
    // Para Balance, Total trades, Active positions: siempre blanco
    return 'color-background';
  }
}
