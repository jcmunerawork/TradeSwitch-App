import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  Component,
  Inject,
  Input,
  OnInit,
  Output,
  PLATFORM_ID,
  EventEmitter,
} from '@angular/core';
import { GroupedTrade } from '../../models/report.model';
import { ChartType } from 'chart.js';
import { NgApexchartsModule } from 'ng-apexcharts';
import { getMonthlyPnL } from '../../utils/normalization-utils';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-PnL-Graph',
  templateUrl: './pnlGraph.component.html',
  styleUrls: ['./pnlGraph.component.scss'],
  standalone: true,
  imports: [CommonModule, NgApexchartsModule, FormsModule],
})
export class PnlGraphComponent {
  @Input() values!: GroupedTrade[];
  @Output() onYearChange = new EventEmitter<string>();

  public chartOptions: any;

  year!: string;
  dateRanges: { label: string; value: string }[] = [];

  // Filter properties
  showFilterDropdown = false;
  selectedFilters: string[] = [];
  availableFilters = [
    { id: 'by-day', label: 'By Day', active: false },
    { id: 'by-week', label: 'By Week', active: false },
    { id: 'by-month', label: 'By Month', active: false },
    { id: 'compare-feature', label: 'Compare feature', active: false }
  ];
  compareYears = {
    year1: '2023',
    year2: '2024'
  };

  constructor(@Inject(PLATFORM_ID) private platformId: any) {}

  ngOnInit() {
    this.year = new Date().getFullYear().toString();
    this.initializeCompareYears();
  }

  initializeCompareYears() {
    const availableYears = this.getAvailableYears();
    if (availableYears.length >= 2) {
      this.compareYears.year1 = availableYears[0];
      this.compareYears.year2 = availableYears[1];
    } else if (availableYears.length === 1) {
      this.compareYears.year1 = availableYears[0];
      this.compareYears.year2 = availableYears[0];
    }
  }

  ngOnChanges() {
    this.generateYearRangesPast(3);
    this.initializeCompareYears();
    this.chartOptions = this.getChartOptions(this.values);
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
    const filteredTrades = this.applyFilters(trades);
    
    // Determine chart type and data based on active filters
    const chartConfig = this.getChartConfig(filteredTrades, yearValue);
    
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
        custom: function ({ series, seriesIndex, dataPointIndex, w }: any) {
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

          return `<div class=" ${cardClass} regularText color-background d-flex flex-col toolTip-container items-start">
          <p class="smallText color-text-gray">${category}, ${yearValue}</p>
          <div class="d-flex text-container items-center ">
                    <p class= "subtitle">
                    $${value}
          </p>
          ${
            percentDiff != null
              ? `<span class="smallText py-4 px-6 d-flex justify-center items-center ${validatorClass}">${percentDiff}% <span class="${
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

  applyFilters(trades: GroupedTrade[]): GroupedTrade[] {
    if (!trades || trades.length === 0) return [];
    
    let filteredTrades = [...trades];

    // Filter by year
    const yearValue = parseInt(this.year);
    filteredTrades = filteredTrades.filter(trade => {
      const tradeDate = new Date(Number(trade.updatedAt));
      return tradeDate.getFullYear() === yearValue;
    });

    // Return filtered trades - the chart config will handle the grouping
    return filteredTrades;
  }

  groupTradesByWeek(trades: GroupedTrade[]): GroupedTrade[] {
    const weeklyMap = new Map<string, GroupedTrade>();
    
    trades.forEach(trade => {
      const date = new Date(Number(trade.updatedAt));
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
      
      const weekKey = weekStart.toISOString().split('T')[0];
      
      if (weeklyMap.has(weekKey)) {
        const existingTrade = weeklyMap.get(weekKey)!;
        existingTrade.pnl = (existingTrade.pnl || 0) + (trade.pnl || 0);
      } else {
        weeklyMap.set(weekKey, {
          ...trade,
          updatedAt: weekStart.getTime().toString()
        });
      }
    });
    
    return Array.from(weeklyMap.values());
  }

  getChartConfig(trades: GroupedTrade[], yearValue: string) {
    const activeFilters = this.getActiveFilters();
    const byDayFilter = activeFilters.find(f => f.id === 'by-day');
    const byWeekFilter = activeFilters.find(f => f.id === 'by-week');
    const byMonthFilter = activeFilters.find(f => f.id === 'by-month');

    if (byDayFilter?.active) {
      return this.getDailyChartConfig(trades, yearValue);
    } else if (byWeekFilter?.active) {
      return this.getWeeklyChartConfig(trades, yearValue);
    } else {
      // Default to monthly or if by-month is active
      return this.getMonthlyChartConfig(trades, yearValue);
    }
  }

  getDailyChartConfig(trades: GroupedTrade[], yearValue: string) {
    const dailyMap: { [label: string]: number } = {};
    
    trades.forEach(trade => {
      const date = new Date(Number(trade.updatedAt));
      const dayKey = date.toISOString().split('T')[0];
      dailyMap[dayKey] = (dailyMap[dayKey] || 0) + (trade.pnl || 0);
    });

    const sortedDays = Object.keys(dailyMap).sort();
    const data = sortedDays.map(day => dailyMap[day]);
    const categories = sortedDays.map(day => {
      const date = new Date(day);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    });

    return { data, categories };
  }

  getWeeklyChartConfig(trades: GroupedTrade[], yearValue: string) {
    const weeklyMap: { [label: string]: number } = {};
    
    trades.forEach(trade => {
      const date = new Date(Number(trade.updatedAt));
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
      
      // Create a more reliable week key
      const year = weekStart.getFullYear();
      const weekNumber = this.getWeekNumber(weekStart);
      const weekKey = `Week ${weekNumber}`;
      
      weeklyMap[weekKey] = (weeklyMap[weekKey] || 0) + (trade.pnl || 0);
    });

    // Sort weeks by week number
    const sortedWeeks = Object.keys(weeklyMap).sort((a, b) => {
      const weekA = parseInt(a.replace('Week ', ''));
      const weekB = parseInt(b.replace('Week ', ''));
      return weekA - weekB;
    });
    
    const data = sortedWeeks.map(week => weeklyMap[week]);
    const categories = sortedWeeks;

    return { data, categories };
  }

  getWeekNumber(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor((date.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    return Math.ceil((days + start.getDay() + 1) / 7);
  }

  getMonthlyChartConfig(trades: GroupedTrade[], yearValue: string) {
    const monthlyMap: { [label: string]: number } = {};
    
    trades.forEach(trade => {
      const date = new Date(Number(trade.updatedAt));
      const label = this.capitalizeFirstLetter(
        date.toLocaleString('en', { month: 'short' })
      );
      const sum = (monthlyMap[label] ?? 0) + (trade.pnl ?? 0);
      monthlyMap[label] = sum < 1 ? Math.round(sum * 100) / 100 : Math.round(sum);
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
    // Apply the same year filter as the chart
    const filteredTrades = this.applyFilters(this.values);
    const totalProfit = filteredTrades.reduce(
      (acc, trade) => acc + (trade.pnl ?? 0),
      0
    );
    const result = Math.round(totalProfit * 100) / 100;
    return result;
  }

  // Filter methods
  toggleFilterDropdown() {
    this.showFilterDropdown = !this.showFilterDropdown;
  }

  onFilterChange(filterId: string) {
    const filter = this.availableFilters.find(f => f.id === filterId);
    if (filter) {
      // If it's a time-based filter (not compare-feature)
      if (filterId !== 'compare-feature') {
        // Deactivate all other time-based filters
        this.availableFilters.forEach(f => {
          if (f.id !== 'compare-feature' && f.id !== filterId) {
            f.active = false;
          }
        });
      }
      
      filter.active = !filter.active;
      
      if (filter.active) {
        if (!this.selectedFilters.includes(filterId)) {
          this.selectedFilters.push(filterId);
        }
      } else {
        this.selectedFilters = this.selectedFilters.filter(id => id !== filterId);
      }
      
      // Update chart when filter changes
      this.updateChart();
    }
  }

  removeFilter(filterId: string) {
    const filter = this.availableFilters.find(f => f.id === filterId);
    if (filter) {
      filter.active = false;
      this.selectedFilters = this.selectedFilters.filter(id => id !== filterId);
      
      // Update chart when filter is removed
      this.updateChart();
    }
  }

  onYearChange1(year: string) {
    this.compareYears.year1 = year;
  }

  onYearChange2(year: string) {
    this.compareYears.year2 = year;
  }

  getActiveFilters() {
    return this.availableFilters.filter(f => f.active);
  }

  isCompareFeatureActive() {
    return this.availableFilters.find(f => f.id === 'compare-feature')?.active || false;
  }

  updateChart() {
    this.chartOptions = this.getChartOptions(this.values);
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
}
