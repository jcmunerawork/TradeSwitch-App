import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, Inject, Input, OnInit, PLATFORM_ID } from '@angular/core';
import { GroupedTrade } from '../../models/report.model';
import { ChartType } from 'chart.js';
import { NgApexchartsModule } from 'ng-apexcharts';
import { getMonthlyPnL } from '../../utils/normalization-utils';

@Component({
  selector: 'app-PnL-Graph',
  templateUrl: './pnlGraph.component.html',
  styleUrls: ['./pnlGraph.component.scss'],
  standalone: true,
  imports: [CommonModule, NgApexchartsModule],
})
export class PnlGraphComponent {
  @Input() values!: GroupedTrade[];

  public chartOptions: any;

  public lineChartLabels: string[] = [];
  public lineChartData: number[] = [];
  public lineChartType: ChartType = 'line';
  year!: string;

  constructor(@Inject(PLATFORM_ID) private platformId: any) {}

  ngOnChanges() {
    this.year = '2025';
    this.chartOptions = this.getChartOptions(this.values);
  }

  getChartOptions(trades: GroupedTrade[]): any {
    const yearValue = this.year;
    const monthlyMap: { [label: string]: number } = {};
    trades.forEach((trade) => {
      const date = new Date(Number(trade.updatedAt));
      const label = this.capitalizeFirstLetter(
        date.toLocaleString('en', { month: 'short' })
      );
      const sum = (monthlyMap[label] ?? 0) + (trade.pnl ?? 0);
      monthlyMap[label] =
        sum < 1 ? Math.round(sum * 100) / 100 : Math.round(sum);
    });

    const monthOrder = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const xaxisLabels = monthOrder;

    const data = xaxisLabels.map((m) => monthlyMap[m] ?? 0);

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
          data: data,
        },
      ],
      xaxis: {
        categories: xaxisLabels,
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
          const month = w.globals.categoryLabels[dataPointIndex];

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
          <p class="smallText color-text-gray">${month}, ${yearValue}</p>
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

  capitalizeFirstLetter(str: string): string {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  get getTotalProfit(): number {
    const totalProfit = this.values.reduce(
      (acc, trade) => acc + (trade.pnl ?? 0),
      0
    );
    const result = Math.round(totalProfit * 100) / 100;
    return result;
  }
}
