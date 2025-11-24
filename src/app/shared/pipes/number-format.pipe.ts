import { Pipe, PipeTransform } from '@angular/core';
import { NumberFormatterService } from '../utils/number-formatter.service';

/**
 * Pipe for formatting numbers with thousand separators.
 *
 * This pipe transforms numeric values into formatted number strings with
 * proper thousand separators and decimal places. It uses the NumberFormatterService
 * for consistent formatting across the application.
 *
 * Features:
 * - Formats numbers with thousand separators
 * - Configurable decimal places (default: 2)
 * - Handles null/undefined values (returns '0.00')
 * - Handles string inputs (converts to number)
 *
 * Usage:
 * {{ value | numberFormat }}           // 2 decimals (default)
 * {{ value | numberFormat:0 }}         // 0 decimals
 * {{ value | numberFormat:4 }}         // 4 decimals
 *
 * Relations:
 * - NumberFormatterService: Provides the actual formatting logic
 *
 * @pipe
 * @name numberFormat
 * @standalone true
 */
@Pipe({
  name: 'numberFormat',
  standalone: true
})
export class NumberFormatPipe implements PipeTransform {
  
  constructor(private numberFormatter: NumberFormatterService) {}

  transform(value: number | string | null | undefined, decimals: number = 2): string {
    return this.numberFormatter.formatNumber(value, decimals);
  }
}
