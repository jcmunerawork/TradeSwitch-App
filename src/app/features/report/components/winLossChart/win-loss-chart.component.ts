import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { NgApexchartsModule } from 'ng-apexcharts';
import { GroupedTrade } from '../../models/report.model';

@Component({
  selector: 'app-win-loss-chart',
  templateUrl: './win-loss-chart.component.html',
  styleUrls: ['./win-loss-chart.component.scss'],
  standalone: true,
  imports: [CommonModule, NgApexchartsModule],
})
export class WinLossChartComponent implements OnInit, OnChanges {
  @Input() values!: GroupedTrade[];

  public chartOptions: any;
  public winLossData: {
    winValue: number;
    lossValue: number;
    winPercentage: number;
    lossPercentage: number;
  } = {
    winValue: 0,
    lossValue: 0,
    winPercentage: 0,
    lossPercentage: 0,
  };

  ngOnInit() {
    this.winLossData = this.calculateWinLossData();
    this.chartOptions = this.getChartOptions();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['values'] && this.values) {
      this.winLossData = this.calculateWinLossData();
      this.chartOptions = this.getChartOptions();
    }
  }

  getChartOptions(): any {
    // Si no hay datos, mostrar círculo gris sin texto interno
    if (!this.values || this.values.length === 0) {
      return {
        chart: {
          type: 'donut',
          height: 200,
          width: 200,
          toolbar: { show: false },
          foreColor: '#fff',
          fontFamily: 'Inter, Arial, sans-serif',
          background: 'transparent',
        },
        series: [1], // Un solo valor para crear el círculo
        labels: ['No Data'],
        colors: ['#6B7280'], // Color gris
        dataLabels: {
          enabled: false
        },
        plotOptions: {
          pie: {
            donut: {
              size: '70%',
              labels: {
                show: false // No mostrar texto dentro del círculo
              }
            }
          }
        },
        legend: {
          show: false
        },
        tooltip: {
          enabled: false
        },
        stroke: {
          show: false
        }
      };
    }

    // Si hay datos, mostrar el gráfico normal
    return {
      chart: {
        type: 'donut',
        height: 200,
        width: 200,
        toolbar: { show: false },
        foreColor: '#fff',
        fontFamily: 'Inter, Arial, sans-serif',
        background: 'transparent',
      },
      series: [this.winLossData.lossValue, this.winLossData.winValue],
      labels: ['Loss', 'Win'],
      colors: ['#EC221F', '#9BF526'],
      dataLabels: {
        enabled: false
      },
      plotOptions: {
        pie: {
          donut: {
            size: '70%',
            labels: {
              show: false
            }
          }
        }
      },
      legend: {
        show: false
      },
      tooltip: {
        enabled: true,
        custom: function ({ series, seriesIndex, dataPointIndex, w }: any) {
          const value = series[seriesIndex];
          const percentage = w.globals.seriesPercent[seriesIndex];
          const isLoss = seriesIndex === 0;
          const color = isLoss ? '#EC221F' : '#9BF526';
          
          return `
            <div class="custom-tooltip" style="
              background: rgba(255, 255, 255, 0.95);
              border: 1px solid #e0e0e0;
              border-radius: 8px;
              padding: 12px;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
              color: #333;
              font-family: Inter, Arial, sans-serif;
              min-width: 80px;
              text-align: center;
              font-weight: 600;
            ">
              <div style="
                font-size: 16px;
                font-weight: 700;
                color: #333;
                margin-bottom: 4px;
              ">${value.toFixed(2)}</div>
              <div style="
                font-size: 12px;
                font-weight: 500;
                color: ${color};
              ">${percentage.toFixed(1)}%</div>
            </div>
          `;
        }
      },
      stroke: {
        show: false
      }
    };
  }

  calculateWinLossData() {
    if (!this.values || this.values.length === 0) {
      return { winValue: 0, lossValue: 0, winPercentage: 0, lossPercentage: 0 };
    }

    let totalWinTrades = 0;
    let totalLossTrades = 0;
    let winAmount = 0;
    let lossAmount = 0;

    this.values.forEach(trade => {
      const pnl = trade.pnl || 0;
      if (pnl > 0) {
        totalWinTrades++;
        winAmount += pnl;
      } else if (pnl < 0) {
        totalLossTrades++;
        lossAmount += Math.abs(pnl);
      }
    });

    // Calcular promedio real de trades ganados y perdidos
    const winValue = totalWinTrades > 0 ? winAmount / totalWinTrades : 0;
    const lossValue = totalLossTrades > 0 ? lossAmount / totalLossTrades : 0;
    
    const totalTrades = totalWinTrades + totalLossTrades;
    const winPercentage = totalTrades > 0 ? (totalWinTrades / totalTrades) * 100 : 0;
    const lossPercentage = totalTrades > 0 ? (totalLossTrades / totalTrades) * 100 : 0;

    return {
      winValue: Math.round(winValue * 100) / 100,
      lossValue: Math.round(lossValue * 100) / 100,
      winPercentage: Math.round(winPercentage * 10) / 10,
      lossPercentage: Math.round(lossPercentage * 10) / 10
    };
  }

  getWinLossData() {
    return this.calculateWinLossData();
  }
}
