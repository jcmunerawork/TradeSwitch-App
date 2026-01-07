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

/**
 * Component for displaying PnL (Profit and Loss) chart.
 *
 * This component displays an area chart showing cumulative PnL over time.
 * It supports filtering by year or custom date range, and displays monthly
 * or dynamic date-based aggregations depending on the selected range.
 *
 * Features:
 * - Area chart visualization using ApexCharts
 * - Year-based filtering (past 2 years, current year, next 5 years)
 * - Custom date range filtering
 * - Monthly aggregation for year view
 * - Dynamic aggregation (daily/weekly/monthly) for date ranges
 * - Total profit calculation for filtered data
 * - Interactive tooltips with percentage changes
 *
 * Relations:
 * - NgApexchartsModule: Chart rendering
 * - NumberFormatterService: Value formatting
 *
 * @component
 * @selector app-PnL-Graph
 * @standalone true
 */
@Component({
  selector: 'app-PnL-Graph',
  templateUrl: './pnlGraph.component.html',
  styleUrls: ['./pnlGraph.component.scss'],
  standalone: true,
  imports: [CommonModule, NgApexchartsModule, FormsModule],
})
export class PnlGraphComponent implements OnInit, OnChanges {
  @Input() values!: GroupedTradeFinal[];
  @Input() totalProfit: number = 0; // Profit desde stats.netPnl del report component (solo referencia)
  @Output() onDataFiltered = new EventEmitter<GroupedTradeFinal[]>();

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
      this.emitFilteredData();
    } else {
      this.originalData = [];
      this.filteredData = [];
      this.chartOptions = this.getEmptyChartOptions();
      this.onDataFiltered.emit([]);
    }
  }

  private emitFilteredData() {
    let dataToEmit = this.filteredData;
    if (this.selectedStartDate || this.selectedEndDate) {
      dataToEmit = this.applyDateRangeFilter(this.filteredData, this.selectedStartDate, this.selectedEndDate);
    }
    this.onDataFiltered.emit(dataToEmit);
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
    
    let filteredTrades = trades;
    if (this.selectedStartDate || this.selectedEndDate) {
      filteredTrades = this.applyDateRangeFilter(trades, this.selectedStartDate, this.selectedEndDate);
    }
    
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
    
    const yearValue = parseInt(this.year);
    return trades.filter(trade => {
      const tradeDate = this.getTradeDate(trade);
      return tradeDate.getFullYear() === yearValue;
    });
  }

  private getTradeDate(trade: GroupedTradeFinal): Date {
    if (trade.lastModified) {
      const date = new Date(Number(trade.lastModified));
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    if (trade.createdDate) {
      const date = new Date(Number(trade.createdDate));
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    return new Date();
  }

  applyDateRangeFilter(trades: GroupedTradeFinal[], startDate: string, endDate: string): GroupedTradeFinal[] {
    if (!startDate && !endDate) {
      return trades;
    }

    const start = startDate ? new Date(startDate) : new Date(0);
    const end = endDate ? new Date(endDate) : new Date();

    if (startDate && !endDate) {
      end.setHours(23, 59, 59, 999);
    }
    if (!startDate && endDate) {
      start.setHours(0, 0, 0, 0);
    }

    return trades.filter(trade => {
      const tradeDate = this.getTradeDate(trade);
      return tradeDate >= start && tradeDate <= end;
    });
  }


  getMonthlyChartConfig(trades: GroupedTradeFinal[], yearValue: string) {
    if (this.selectedStartDate || this.selectedEndDate) {
      return this.getDateRangeChartConfig(trades);
    }
    
    if (!trades || trades.length === 0) {
      const monthOrder = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
      ];
      return { data: monthOrder.map(() => 0), categories: monthOrder };
    }
    
    const sortedTrades = [...trades].sort((a, b) => {
      const dateA = this.getTradeDate(a).getTime();
      const dateB = this.getTradeDate(b).getTime();
      return dateA - dateB;
    });
    
    const monthlyMap: { [key: string]: number } = {};
    let cumulativePnL = 0;
    
    sortedTrades.forEach(trade => {
      const date = this.getTradeDate(trade);
      const year = date.getFullYear();
      const month = date.getMonth();
      const key = `${year}-${month}`;
      
      cumulativePnL += (trade.pnl ?? 0);
      monthlyMap[key] = Math.round(cumulativePnL * 100) / 100;
    });
    
    const allMonths: { date: Date; label: string; value: number }[] = [];
    const firstTradeDate = this.getTradeDate(sortedTrades[0]);
    const lastTradeDate = this.getTradeDate(sortedTrades[sortedTrades.length - 1]);
    const current = new Date(firstTradeDate.getFullYear(), firstTradeDate.getMonth(), 1);
    const end = new Date(lastTradeDate.getFullYear(), lastTradeDate.getMonth(), 1);
    
    while (current <= end) {
      const key = `${current.getFullYear()}-${current.getMonth()}`;
      const monthLabel = this.capitalizeFirstLetter(
        current.toLocaleString('en', { month: 'short' })
      );
      const yearLabel = current.getFullYear();
      
      let value = monthlyMap[key];
      if (value === undefined) {
        const previousMonth = new Date(current);
        previousMonth.setMonth(previousMonth.getMonth() - 1);
        const prevKey = `${previousMonth.getFullYear()}-${previousMonth.getMonth()}`;
        value = monthlyMap[prevKey] ?? 0;
      }
      
      allMonths.push({
        date: new Date(current),
        label: `${monthLabel} ${yearLabel}`,
        value: value
      });
      
      current.setMonth(current.getMonth() + 1);
    }
    
    const categories = allMonths.map(m => m.label);
    const data = allMonths.map(m => m.value);
    
    return { data, categories };
  }

  getDateRangeChartConfig(trades: GroupedTradeFinal[]) {
    if (!trades || trades.length === 0) {
      return { data: [], categories: [] };
    }
    
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
      const year = new Date().getFullYear();
      startDate = new Date(year, 0, 1);
      endDate = new Date(year, 11, 31);
    }
    
    const filteredTrades = trades.filter(trade => {
      const tradeDate = this.getTradeDate(trade);
      return tradeDate >= startDate && tradeDate <= endDate;
    });
    
    const sortedTrades = filteredTrades.sort((a, b) => {
      const dateA = this.getTradeDate(a).getTime();
      const dateB = this.getTradeDate(b).getTime();
      return dateA - dateB;
    });
    
    const categories = this.generateDateRangeCategories(startDate, endDate);
    const periodMap: { [key: string]: number } = {};
    let cumulativePnL = 0;
    
    sortedTrades.forEach(trade => {
      const tradeDate = this.getTradeDate(trade);
      cumulativePnL += (trade.pnl ?? 0);
      
      let periodKey = '';
      if (categories.length <= 30) {
        periodKey = this.formatDateForChart(tradeDate);
      } else if (categories.length <= 90) {
        const weekStart = this.getWeekStart(tradeDate);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        periodKey = `${this.formatDateForChart(weekStart)} - ${this.formatDateForChart(weekEnd)}`;
      } else {
        const month = tradeDate.toLocaleString('en', { month: 'short' });
        const year = tradeDate.getFullYear();
        periodKey = `${month} ${year}`;
      }
      
      periodMap[periodKey] = Math.round(cumulativePnL * 100) / 100;
    });
    
    const data: number[] = [];
    let lastValue = 0;
    categories.forEach((cat) => {
      const value = periodMap[cat];
      if (value !== undefined) {
        lastValue = value;
        data.push(value);
      } else {
        data.push(lastValue);
      }
    });
    
    return { data, categories };
  }

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
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
    this.updateChart();
    this.emitFilteredData();
  }

  get getTotalProfit(): number {
    if (this.selectedStartDate || this.selectedEndDate) {
      let endDate: Date;
      
      if (this.selectedEndDate) {
        endDate = new Date(this.selectedEndDate);
        endDate.setHours(23, 59, 59, 999);
      } else if (this.selectedStartDate) {
        endDate = new Date();
      } else {
        endDate = new Date();
      }
      
      const tradesUpToEndDate = this.filteredData.filter(trade => {
        const tradeDate = this.getTradeDate(trade);
        return tradeDate <= endDate;
      });
      
      const totalProfit = tradesUpToEndDate.reduce(
        (acc, trade) => acc + (trade.pnl ?? 0),
        0
      );
      return Math.round(totalProfit * 100) / 100;
    }
    
    const totalProfit = this.filteredData.reduce(
      (acc, trade) => acc + (trade.pnl ?? 0),
      0
    );
    return Math.round(totalProfit * 100) / 100;
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
      this.updateYearFromDateRange();
    } else {
      this.filteredData = [...this.originalData];
    }
    this.updateChart();
    this.closeDateFilter();
    this.emitFilteredData();
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
    
    const currentYear = new Date().getFullYear().toString();
    if (this.year !== currentYear) {
      this.year = currentYear;
    }
    
    this.updateChart();
    this.onDataFiltered.emit([]);
  }

  updateChart() {
    this.chartOptions = this.getChartOptions(this.filteredData);
  }

  getAvailableYears(): string[] {
    if (!this.values || this.values.length === 0) return [];
    
    const years = new Set<number>();
    this.values.forEach(trade => {
      const date = this.getTradeDate(trade);
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
