import { Pipe, PipeTransform } from '@angular/core';
import { NumberFormatterService } from '../utils/number-formatter.service';

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
