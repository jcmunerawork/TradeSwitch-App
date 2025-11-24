import { Pipe, PipeTransform } from '@angular/core';
import { NumberFormatterService } from '../utils/number-formatter.service';

/**
 * Pipe for formatting numbers as currency.
 *
 * This pipe transforms numeric values into formatted currency strings using
 * the NumberFormatterService. It handles null/undefined values gracefully
 * and formats values as USD currency with proper separators.
 *
 * Features:
 * - Formats numbers as currency (USD)
 * - Handles null/undefined values (returns '$0.00')
 * - Handles string inputs (converts to number)
 * - Uses NumberFormatterService for consistent formatting
 *
 * Usage:
 * {{ value | currencyFormat }}
 *
 * Relations:
 * - NumberFormatterService: Provides the actual formatting logic
 *
 * @pipe
 * @name currencyFormat
 * @standalone true
 */
@Pipe({
  name: 'currencyFormat',
  standalone: true
})
export class CurrencyFormatPipe implements PipeTransform {
  
  constructor(private numberFormatter: NumberFormatterService) {}

  transform(value: number | string | null | undefined): string {
    return this.numberFormatter.formatCurrency(value);
  }
}
