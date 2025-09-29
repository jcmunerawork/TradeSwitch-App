import { Pipe, PipeTransform } from '@angular/core';
import { NumberFormatterService } from '../utils/number-formatter.service';

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
