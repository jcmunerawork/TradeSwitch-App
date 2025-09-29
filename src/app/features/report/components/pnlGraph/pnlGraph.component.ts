import { CommonModule, isPlatformBrowser } from '@angular/common';
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
} from '@angular/core';
import { GroupedTrade } from '../../models/report.model';
import { ChartType } from 'chart.js';
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
  @Input() values!: GroupedTrade[];
  @Output() onYearChange = new EventEmitter<string>();

  public chartOptions: any;
  private numberFormatter = new NumberFormatterService();

  year!: string;
  dateRanges: { label: string; value: string }[] = [];

  // Date filter properties
  showDateFilter = false;
  selectedDate: string = '';
  filteredData: GroupedTrade[] = [];
  originalData: GroupedTrade[] = [];

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

  getChartOptions(trades: GroupedTrade[]): any {
    const yearValue = this.year;
    const filteredTrades = this.applyYearFilter(trades);
    
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

          const formattedValue = this.numberFormatter.formatCurrency(value);
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

  applyYearFilter(trades: GroupedTrade[]): GroupedTrade[] {
    if (!trades || trades.length === 0) return [];
    
    let filteredTrades = [...trades];

    // Filter by year
    const yearValue = parseInt(this.year);
    filteredTrades = filteredTrades.filter(trade => {
      const tradeDate = new Date(Number(trade.updatedAt));
      return tradeDate.getFullYear() === yearValue;
    });

    return filteredTrades;
  }

  applyDateFilter(trades: GroupedTrade[], selectedDate: string): GroupedTrade[] {
    if (!selectedDate || selectedDate === '') {
      return trades;
    }

    const filterDate = new Date(selectedDate);
    const startOfDay = new Date(filterDate.getFullYear(), filterDate.getMonth(), filterDate.getDate());
    const endOfDay = new Date(filterDate.getFullYear(), filterDate.getMonth(), filterDate.getDate() + 1);

    return trades.filter(trade => {
      const tradeDate = new Date(Number(trade.updatedAt));
      return tradeDate >= startOfDay && tradeDate < endOfDay;
    });
  }


  getMonthlyChartConfig(trades: GroupedTrade[], yearValue: string) {
    const monthlyMap: { [label: string]: number } = {};
    
    trades.forEach(trade => {
      const date = new Date(Number(trade.updatedAt));
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
    const yearFiltered = this.applyYearFilter(this.filteredData);
    const totalProfit = yearFiltered.reduce(
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

  onDateSelected(date: string) {
    this.selectedDate = date;
    this.applyFilters();
  }

  clearDateFilter() {
    this.selectedDate = '';
    this.filteredData = [...this.originalData];
    this.updateChart();
  }

  applyFilters() {
    if (this.selectedDate) {
      this.filteredData = this.applyDateFilter(this.originalData, this.selectedDate);
    } else {
      this.filteredData = [...this.originalData];
    }
    this.updateChart();
  }

  updateChart() {
    this.chartOptions = this.getChartOptions(this.filteredData);
  }

  getAvailableYears(): string[] {
    if (!this.values || this.values.length === 0) return [];
    
    const years = new Set<number>();
    this.values.forEach(trade => {
      const date = new Date(Number(trade.updatedAt));
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
}
