import { CommonModule } from '@angular/common';
import { Component, Input, Injectable } from '@angular/core';
import { NumberFormatterService } from '../../../../shared/utils/number-formatter.service';

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

  private numberFormatter = new NumberFormatterService();

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
        } else {
          return this.numberFormatter.formatNumber(this.value);
        }
    }
  }

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
