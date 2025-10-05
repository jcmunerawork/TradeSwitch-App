import { CommonModule } from '@angular/common';
import {
  Component,
  Inject,
  Input,
  OnInit,
  OnChanges,
  Output,
  PLATFORM_ID,
  EventEmitter,
  SimpleChanges,
  HostListener,
} from '@angular/core';
import { GroupedTrade, GroupedTradeFinal } from '../../models/report.model';
import { NgApexchartsModule } from 'ng-apexcharts';
import { getMonthlyPnL } from '../../utils/normalization-utils';
import { FormsModule } from '@angular/forms';
import { NumberFormatterService } from '../../../../shared/utils/number-formatter.service';

@Component({
  selector: 'app-PnL-Graph',
  templateUrl: './pnlGraph.component.html',
  styleUrls: ['./pnlGraph.component.scss'],
  standalone: true,
  imports: [CommonModule, NgApexchartsModule, FormsModule],
})
export class PnlGraphComponent implements OnInit, OnChanges {
  @Input() values!: GroupedTradeFinal[];
  @Output() onYearChange = new EventEmitter<string>();

  public chartOptions: any;
  private numberFormatter = new NumberFormatterService();

  year!: string;
  dateRanges: { label: string; value: string }[] = [];

  // Date filter properties
  showDateFilter = false;
  selectedStartDate: string = '';
  selectedEndDate: string = '';
  filteredData: GroupedTradeFinal[] = [];
  originalData: GroupedTradeFinal[] = [];

  constructor(@Inject(PLATFORM_ID) private platformId: any) {}

  ngOnInit() {
    this.year = new Date().getFullYear().toString();
    this.generateYearRangesPast(3);
    this.initializeData();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['values'] && this.values) {
      this.initializeData();
    }
  }

  private initializeData() {
    if (this.values && this.values.length > 0) {
      this.originalData = [...this.values];
      this.filteredData = [...this.values];
      this.chartOptions = this.getChartOptions(this.filteredData);
    } else {
      // Mostrar gráfica vacía cuando no hay datos
      this.originalData = [];
      this.filteredData = [];
      this.chartOptions = this.getEmptyChartOptions();
    }
  }

  generateYearRangesPast(yearsBack: number) {
    const now = new Date();
    const currentYear = now.getFullYear();
    this.dateRanges = [];

    // Generate 2 years before current and 5 years after
    for (let i = 2; i >= 0; i--) {
      const year = currentYear - i;
      this.dateRanges.push({
        label: `Jan ${year} - Dec ${year}`,
        value: `${year}`,
      });
    }
    
    for (let i = 1; i <= 5; i++) {
      const year = currentYear + i;
      this.dateRanges.push({
        label: `Jan ${year} - Dec ${year}`,
        value: `${year}`,
      });
    }
  }

  getChartOptions(trades: GroupedTradeFinal[]): any {
    const yearValue = this.year;
    
    // Si hay filtro de fechas activo, no aplicar filtro de año
    let filteredTrades = trades;
    if (!this.selectedStartDate && !this.selectedEndDate) {
      filteredTrades = this.applyYearFilter(trades);
    }
    
    // Use monthly chart by default
    const chartConfig = this.getMonthlyChartConfig(filteredTrades, yearValue);
    
    return {
      chart: {
        type: 'area',
        height: 350,
        toolbar: { show: false },
        foreColor: '#fff',
        fontFamily: 'Inter, Arial, sans-serif',
        background: 'transparent',
      },
      series: [
        {
          name: 'PnL',
          data: chartConfig.data,
        },
      ],
      xaxis: {
        categories: chartConfig.categories,
        labels: {
          style: { colors: '#d8d8d8' },
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: {
        labels: {
          style: { colors: '#d8d8d8' },
        },
      },
      grid: {
        borderColor: '#333',
        strokeDashArray: 4,
        xaxis: {
          lines: {
            show: true,
          },
        },
      },
      dataLabels: { enabled: false },
      stroke: {
        curve: 'straight',
        width: 1,
        colors: ['#EAF2F8'],
      },
      fill: {
        type: 'gradient',
        gradient: {
          shade: 'dark',
          type: 'vertical',
          gradientToColors: ['#3967D7'],
          opacityFrom: 0.4,
          opacityTo: 0,
        },
      },
      tooltip: {
        theme: 'dark',
        x: { show: true },
        custom: ({ series, seriesIndex, dataPointIndex, w }: any) => {
          const value = series[seriesIndex][dataPointIndex];
          const category = w.globals.categoryLabels[dataPointIndex];

          const prevValue =
            dataPointIndex > 0 ? series[seriesIndex][dataPointIndex - 1] : null;
          let percentDiff: number | null = 0;
          let direction = null;
          let cardClass = '';
          let validatorClass = '';

          if (prevValue !== null && prevValue !== 0) {
            percentDiff = ((value - prevValue) / Math.abs(prevValue)) * 100;
            direction = percentDiff > 0 ? 'up' : 'down';
            if (direction === 'up') {
              cardClass = 'positive-container';
              validatorClass = 'positive-validator';
            } else {
              cardClass = 'negative-container';
              validatorClass = 'negative-validator';
            }
          } else {
            percentDiff = null;
            direction = null;
          }

          const formattedValue = this.getFormatedValue(value);
          const formattedPercent = this.numberFormatter.formatPercentageValue(percentDiff);
          
          return `<div class=" ${cardClass} regularText color-background d-flex flex-col toolTip-container items-start">
          <p class="smallText color-text-gray">${category}, ${yearValue}</p>
          <div class="d-flex text-container items-center ">
                    <p class= "subtitle">
                    ${formattedValue}
          </p>
          ${
            percentDiff != null
              ? `<span class="smallText py-4 px-6 d-flex justify-center items-center ${validatorClass}">${formattedPercent}% <span class="${
                  direction === 'up'
                    ? 'icon-status-arrow-up'
                    : 'icon-status-arrow'
                } ml-3"></span></span>`
              : ''
          }
          </div>

        
          </div>`;
        },
        position: function (data: any, opts: any) {
          return {
            left: data.point.x,
            top: data.point.y - 160,
          };
        },
      },
    };
  }

  applyYearFilter(trades: GroupedTradeFinal[]): GroupedTradeFinal[] {
    if (!trades || trades.length === 0) return [];
    
    let filteredTrades = [...trades];

    // Filter by year
    const yearValue = parseInt(this.year);
    filteredTrades = filteredTrades.filter(trade => {
      const tradeDate = new Date(Number(trade.lastModified));
      return tradeDate.getFullYear() === yearValue;
    });

    return filteredTrades;
  }

  applyDateRangeFilter(trades: GroupedTradeFinal[], startDate: string, endDate: string): GroupedTradeFinal[] {
    if (!startDate && !endDate) {
      return trades;
    }

    const start = startDate ? new Date(startDate) : new Date(0);
    const end = endDate ? new Date(endDate) : new Date();

    // Si solo hay fecha de inicio, usar fin del día
    if (startDate && !endDate) {
      end.setHours(23, 59, 59, 999);
    }
    // Si solo hay fecha de fin, usar inicio del día
    if (!startDate && endDate) {
      start.setHours(0, 0, 0, 0);
    }

    return trades.filter(trade => {
      const tradeDate = new Date(Number(trade.lastModified));
      return tradeDate >= start && tradeDate <= end;
    });
  }


  getMonthlyChartConfig(trades: GroupedTradeFinal[], yearValue: string) {
    const monthlyMap: { [label: string]: number } = {};
    
    // Si hay filtro de fechas activo, generar categorías dinámicas
    if (this.selectedStartDate || this.selectedEndDate) {
      return this.getDateRangeChartConfig(trades);
    }
    
    trades.forEach(trade => {
      const date = new Date(Number(trade.lastModified));
      const tradeYear = date.getFullYear();
      const yearValueNum = parseInt(yearValue);
      
      // Only process trades from the selected year
      if (tradeYear === yearValueNum) {
        const label = this.capitalizeFirstLetter(
          date.toLocaleString('en', { month: 'short' })
        );
        const sum = (monthlyMap[label] ?? 0) + (trade.pnl ?? 0);
        monthlyMap[label] = sum < 1 ? Math.round(sum * 100) / 100 : Math.round(sum);
        
      }
    });

    const monthOrder = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    
    const data = monthOrder.map(m => monthlyMap[m] ?? 0);
    const categories = monthOrder;
    return { data, categories };
  }

  getDateRangeChartConfig(trades: GroupedTradeFinal[]) {
    const dateMap: { [key: string]: number } = {};
    
    // Determinar el rango de fechas
    let startDate: Date;
    let endDate: Date;
    
    if (this.selectedStartDate && this.selectedEndDate) {
      startDate = new Date(this.selectedStartDate);
      endDate = new Date(this.selectedEndDate);
    } else if (this.selectedStartDate) {
      startDate = new Date(this.selectedStartDate);
      endDate = new Date();
    } else if (this.selectedEndDate) {
      startDate = new Date(0);
      endDate = new Date(this.selectedEndDate);
    } else {
      // Fallback a año completo
      const year = new Date().getFullYear();
      startDate = new Date(year, 0, 1);
      endDate = new Date(year, 11, 31);
    }
    
    // Procesar trades en el rango
    trades.forEach(trade => {
      const tradeDate = new Date(Number(trade.lastModified));
      if (tradeDate >= startDate && tradeDate <= endDate) {
        const label = this.formatDateForChart(tradeDate);
        const sum = (dateMap[label] ?? 0) + (trade.pnl ?? 0);
        dateMap[label] = sum < 1 ? Math.round(sum * 100) / 100 : Math.round(sum);
      }
    });
    
    // Generar categorías dinámicas basadas en el rango
    const categories = this.generateDateRangeCategories(startDate, endDate);
    const data = categories.map(cat => dateMap[cat] ?? 0);
    
    return { data, categories };
  }

  formatDateForChart(date: Date): string {
    const month = date.toLocaleString('en', { month: 'short' });
    const day = date.getDate();
    return `${month} ${day}`;
  }

  generateDateRangeCategories(startDate: Date, endDate: Date): string[] {
    const categories: string[] = [];
    const current = new Date(startDate);
    
    // Si el rango es menor a 30 días, mostrar por días
    const diffTime = endDate.getTime() - startDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 30) {
      // Mostrar por días
      while (current <= endDate) {
        categories.push(this.formatDateForChart(new Date(current)));
        current.setDate(current.getDate() + 1);
      }
    } else if (diffDays <= 90) {
      // Mostrar por semanas
      while (current <= endDate) {
        const weekEnd = new Date(current);
        weekEnd.setDate(weekEnd.getDate() + 6);
        if (weekEnd > endDate) weekEnd.setTime(endDate.getTime());
        
        const startStr = this.formatDateForChart(new Date(current));
        const endStr = this.formatDateForChart(weekEnd);
        categories.push(`${startStr} - ${endStr}`);
        
        current.setDate(current.getDate() + 7);
      }
    } else {
      // Mostrar por meses
      while (current <= endDate) {
        const month = current.toLocaleString('en', { month: 'short' });
        const year = current.getFullYear();
        categories.push(`${month} ${year}`);
        
        current.setMonth(current.getMonth() + 1);
      }
    }
    
    return categories;
  }

  capitalizeFirstLetter(str: string): string {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  onYearSelected(year: string) {
    this.year = year;
    this.onYearChange.emit(year);
    this.updateChart();
  }

  get getTotalProfit(): number {
    // Apply the same filters as the chart
    let filteredTrades = this.filteredData;
    if (!this.selectedStartDate && !this.selectedEndDate) {
      filteredTrades = this.applyYearFilter(this.filteredData);
    }
    
    const totalProfit = filteredTrades.reduce(
      (acc, trade) => acc + (trade.pnl ?? 0),
      0
    );
    const result = Math.round(totalProfit * 100) / 100;
    return result;
  }

  // Date filter methods
  toggleDateFilter() {
    this.showDateFilter = !this.showDateFilter;
  }

  closeDateFilter() {
    this.showDateFilter = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    const target = event.target as HTMLElement;
    const filterSection = target.closest('.filter-section');
    if (!filterSection && this.showDateFilter) {
      this.closeDateFilter();
    }
  }

  onStartDateSelected(date: string) {
    this.selectedStartDate = date;
  }

  onEndDateSelected(date: string) {
    this.selectedEndDate = date;
  }

  applyDateFilter() {
    if (this.selectedStartDate || this.selectedEndDate) {
      this.filteredData = this.applyDateRangeFilter(this.originalData, this.selectedStartDate, this.selectedEndDate);
      // Actualizar el año basado en las fechas seleccionadas
      this.updateYearFromDateRange();
    } else {
      this.filteredData = [...this.originalData];
    }
    this.updateChart();
    this.closeDateFilter();
  }

  updateYearFromDateRange() {
    if (this.selectedStartDate) {
      const startDate = new Date(this.selectedStartDate);
      this.year = startDate.getFullYear().toString();
    } else if (this.selectedEndDate) {
      const endDate = new Date(this.selectedEndDate);
      this.year = endDate.getFullYear().toString();
    }
  }

  clearDateFilter() {
    this.selectedStartDate = '';
    this.selectedEndDate = '';
    this.filteredData = [...this.originalData];
    this.updateChart();
  }

  updateChart() {
    this.chartOptions = this.getChartOptions(this.filteredData);
  }

  getAvailableYears(): string[] {
    if (!this.values || this.values.length === 0) return [];
    
    const years = new Set<number>();
    this.values.forEach(trade => {
      const date = new Date(Number(trade.lastModified));
      years.add(date.getFullYear());
    });
    
    return Array.from(years).sort((a, b) => b - a).map(year => year.toString());
  }

  getEmptyChartOptions(): any {
    const currentYear = new Date().getFullYear();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    return {
      chart: {
        type: 'area',
        height: 350,
        toolbar: { show: false },
        foreColor: '#fff',
        fontFamily: 'Inter, Arial, sans-serif',
        background: 'transparent',
      },
      series: [
        {
          name: 'PnL',
          data: new Array(12).fill(0), // Array de 12 ceros para los 12 meses
        },
      ],
      xaxis: {
        categories: months,
        labels: {
          style: { colors: '#d8d8d8' },
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: {
        labels: {
          style: { colors: '#d8d8d8' },
        },
      },
      grid: {
        borderColor: '#333',
        strokeDashArray: 4,
        xaxis: {
          lines: {
            show: true,
          },
        },
      },
      dataLabels: { enabled: false },
      stroke: {
        curve: 'straight',
        width: 1,
        colors: ['#EAF2F8'],
      },
      fill: {
        type: 'gradient',
        gradient: {
          shade: 'dark',
          type: 'vertical',
          gradientToColors: ['#3967D7'],
          opacityFrom: 0.4,
          opacityTo: 0,
        },
      },
      tooltip: {
        theme: 'dark',
        x: { show: true },
        custom: function ({ series, seriesIndex, dataPointIndex, w }: any) {
          const month = months[dataPointIndex];
          return `
            <div style="padding: 8px 12px; background: #1a1a1a; border: 1px solid #333; border-radius: 6px;">
              <div style="color: #d8d8d8; font-size: 12px;">${month} ${currentYear}</div>
              <div style="color: #fff; font-size: 14px; font-weight: 600;">PnL: $0.00</div>
            </div>
          `;
        },
      },
      noData: {
        text: 'No data available',
        align: 'center',
        verticalAlign: 'middle',
        style: {
          color: '#d8d8d8',
          fontSize: '14px',
          fontFamily: 'Inter, Arial, sans-serif'
        }
      }
    };
  }

  getFormatedValue(value: number): string {

    return this.numberFormatter.formatCurrencyValue(value);

  }
}
