import { Pipe, PipeTransform } from '@angular/core';
import { NumberFormatterService } from '../utils/number-formatter.service';

/**
 * Pipe for formatting numbers as percentages.
 *
 * This pipe transforms numeric values into formatted percentage strings with
 * the % symbol. It uses the NumberFormatterService for consistent formatting
 * and handles the conversion from decimal to percentage format.
 *
 * Features:
 * - Formats numbers as percentages with % symbol
 * - Handles null/undefined values (returns '0.00%')
 * - Handles string inputs (converts to number)
 * - Converts decimal values to percentage (e.g., 0.5 → 50.00%)
 *
 * Usage:
 * {{ value | percentageFormat }}
 *
 * Relations:
 * - NumberFormatterService: Provides the actual formatting logic
 *
 * @pipe
 * @name percentageFormat
 * @standalone true
 */
@Pipe({
  name: 'percentageFormat',
  standalone: true
})
export class PercentageFormatPipe implements PipeTransform {
  
  constructor(private numberFormatter: NumberFormatterService) {}

  transform(value: number | string | null | undefined): string {
    return this.numberFormatter.formatPercentage(value);
  }
}
