import { CommonModule } from '@angular/common';
import { Component, Inject, Input, PLATFORM_ID } from '@angular/core';
import { NgApexchartsModule } from 'ng-apexcharts';
import { FormsModule } from '@angular/forms';
import { DailyRevenueData, MonthlyRevenueData } from '../../models/revenue';

@Component({
  selector: 'app-revenue-graph',
  templateUrl: './revenue-graph.component.html',
  styleUrls: ['./revenue-graph.component.scss'],
  standalone: true,
  imports: [CommonModule, NgApexchartsModule, FormsModule],
})
export class RevenueGraphComponent {
  @Input() dailyData!: DailyRevenueData[];
  @Input() monthlyData!: MonthlyRevenueData[];

  actualYear: number = new Date().getFullYear();

  filterType: 'day' | 'month' | 'year' = 'day';

  chartType: 'bar' | 'area' = 'bar';

  public chartOptions: any;

  constructor(@Inject(PLATFORM_ID) private platformId: any) {}

  ngOnInit() {}

  get filterTypeLabel(): string {
    switch (this.filterType) {
      case 'day':
        return 'By day';
      case 'month':
        return 'By month';
      case 'year':
        return 'By year';
    }
  }

  setChartType(type: 'bar' | 'area') {
    this.chartType = type;
    this.changeChartData();
  }

  setFilterType(type: 'day' | 'month' | 'year') {
    this.filterType = type;
    this.changeChartData();
  }

  onFilterTypeChange(event: any) {
    this.filterType = event.target.value;
    this.changeChartData();
  }

  ngOnChanges() {
    if (this.dailyData) {
      this.chartOptions = this.getChartOptions(this.dailyData, this.chartType);
    }
  }

  changeChartData() {
    if (this.filterType === 'day') {
      this.chartOptions = this.getChartOptions(this.dailyData, this.chartType);
    } else if (this.filterType === 'month') {
      this.chartOptions = this.getChartOptions(
        this.monthlyData,
        this.chartType
      );
    }
  }

  getChartOptions(
    data: DailyRevenueData[] | MonthlyRevenueData[],
    chartType: 'bar' | 'area'
  ): any {
    const isDailyData = 'date' in data[0];
    let categories: string[] = [];

    if (isDailyData) {
      categories = data
        .map((d) => new Date((d as DailyRevenueData).date).getDate().toString())
        .sort((a, b) => parseInt(a) - parseInt(b));
    } else {
      categories = (data as MonthlyRevenueData[]).map((d) => {
        const dateObj = new Date(d.year, d.month - 1);
        return dateObj.toLocaleString('en-US', {
          month: 'short',
          year: 'numeric',
        });
      });
    }

    let sortedData = data.slice();
    if (isDailyData) {
      sortedData = sortedData.sort(
        (a, b) =>
          new Date((a as DailyRevenueData).date).getDate() -
          new Date((b as DailyRevenueData).date).getDate()
      );
    } else {
      sortedData = sortedData.sort((a, b) =>
        (a as MonthlyRevenueData).year === (b as MonthlyRevenueData).year
          ? (a as MonthlyRevenueData).month - (b as MonthlyRevenueData).month
          : (a as MonthlyRevenueData).year - (b as MonthlyRevenueData).year
      );
    }

    const chartData = sortedData.map((d) => d.grossRevenue);
    const actualYear = this.actualYear;

    if (chartType === 'area') {
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
            name: 'months',
            data: chartData,
          },
        ],
        xaxis: {
          categories: categories,
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
            opacityFrom: 0.9,
            opacityTo: 0,
          },
        },
        tooltip: {
          theme: 'dark',
          x: { show: true },
          custom: function ({ series, seriesIndex, dataPointIndex, w }: any) {
            const value = series[seriesIndex][dataPointIndex];

            const prevValue =
              dataPointIndex > 0
                ? series[seriesIndex][dataPointIndex - 1]
                : null;
            let percentDiff: number | null = 0;
            let direction = null;
            let cardClass = '';
            let validatorClass = '';

            if (prevValue !== null && prevValue !== 0) {
              percentDiff = Math.round(
                ((value - prevValue) / Math.abs(prevValue)) * 100
              );
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
          <p class="smallText color-text-gray">${actualYear}</p>
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

    return {
      chart: {
        type: 'bar',
        height: 350,
        toolbar: { show: false },
        foreColor: '#fff',
        background: 'transparent',
        fontFamily: 'Inter, Arial, sans-serif',
      },
      series: [
        {
          name: 'Gross Revenue',
          data: chartData,
        },
      ],
      fill: {
        colors: ['#F44336', '#E91E63', '#9C27B0'],
      },

      xaxis: {
        categories: categories,
        labels: { style: { colors: '#d8d8d8' } },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: {
        labels: { style: { colors: '#d8d8d8' } },
      },
      grid: {
        borderColor: '#333',
        strokeDashArray: 4,
        xaxis: { lines: { show: true } },
      },
      dataLabels: { enabled: false },
      tooltip: {
        theme: 'dark',
        x: { show: true },
        custom: function ({ series, seriesIndex, dataPointIndex, w }: any) {
          const value = series[seriesIndex][dataPointIndex];
          const prevValue =
            dataPointIndex > 0 ? series[seriesIndex][dataPointIndex - 1] : null;
          let percentDiff: number | null = 0;
          let direction = null;
          let cardClass = '';
          let validatorClass = '';

          if (prevValue !== null && prevValue !== 0) {
            percentDiff = Math.round(
              ((value - prevValue) / Math.abs(prevValue)) * 100
            );
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
          <p class="smallText color-text-gray">${actualYear}</p>
          <div class="d-flex text-container items-center ">
            <p class= "subtitle">$${value}</p>
            ${
              percentDiff != null
                ? `<span class="smallText py-4 px-6 d-flex justify-center items-center ${validatorClass}">
                     ${percentDiff}% <span class="${
                    direction === 'up'
                      ? 'icon-status-arrow-up'
                      : 'icon-status-arrow'
                  } ml-3"></span>
                   </span>`
                : ''
            }
          </div>
        </div>`;
        },
      },
    };
  }

  capitalizeFirstLetter(str: string): string {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  get grossRevenue(): number {
    const result = this.dailyData.reduce(
      (acc, curr) => acc + (curr.grossRevenue ?? 0),
      0
    );
    return result;
  }
}
