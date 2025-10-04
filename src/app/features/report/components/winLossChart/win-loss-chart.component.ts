import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { NgApexchartsModule } from 'ng-apexcharts';
import { GroupedTradeFinal } from '../../models/report.model';
import { NumberFormatterService } from '../../../../shared/utils/number-formatter.service';

@Component({
  selector: 'app-win-loss-chart',
  templateUrl: './win-loss-chart.component.html',
  styleUrls: ['./win-loss-chart.component.scss'],
  standalone: true,
  imports: [CommonModule, NgApexchartsModule],
})
export class WinLossChartComponent implements OnInit, OnChanges {
  @Input() values!: GroupedTradeFinal[];

  public chartOptions: any;
  private numberFormatter = new NumberFormatterService();
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

  private getDonutSize(): string {
    if (typeof window !== 'undefined') {
      if (window.innerWidth <= 480) {
        return '80%'; // Más delgado en pantallas muy pequeñas
      } else if (window.innerWidth <= 768) {
        return '75%'; // Delgado en tablets
      } else if (window.innerWidth <= 1024) {
        return '70%'; // Moderadamente delgado en pantallas medianas
      }
    }
    return '80%'; // Tamaño normal en desktop
  }

  private getChartSize(): number {
    // El tamaño ahora se controla completamente por CSS
    // Retornamos un valor que será ignorado por ApexCharts
    return 100;
  }

  ngOnInit() {
    this.winLossData = this.calculateWinLossData();
    this.chartOptions = this.getChartOptions();
    
    // Listener para redimensionar el gráfico
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => {
        this.chartOptions = this.getChartOptions();
      });
    }
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
          height: '100%',
          width: '100%',
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
              size: this.getDonutSize(),
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
    
    return {
      chart: {
        type: 'donut',
        height: '100%',
        width: '100%',
        toolbar: { show: false },
        foreColor: '#fff',
        fontFamily: 'Inter, Arial, sans-serif',
        background: 'transparent',
      },
      series: [this.winLossData.winPercentage, this.winLossData.lossPercentage],
      labels: ['Win', 'Loss'],
      colors: ['#9BF526', '#EC221F'],
      dataLabels: {
        enabled: false
      },
      plotOptions: {
        pie: {
          donut: {
            size: this.getDonutSize(),
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
        custom: ({ series, seriesIndex, dataPointIndex, w }: any) => {
          const percentage = w.globals.seriesPercent[seriesIndex];
          const isWin = seriesIndex === 0; // Ahora el índice 0 es Win
          const color = isWin ? '#9BF526' : '#EC221F';
          
          // Usar los valores monetarios reales en lugar del porcentaje
          const moneyValue = isWin ? this.winLossData.winValue : this.winLossData.lossValue;
          const formattedValue = this.numberFormatter.formatCurrency(moneyValue);
          const formattedPercentage = this.numberFormatter.formatPercentageValue(percentage);
          
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
              ">${formattedValue}</div>
              <div style="
                font-size: 12px;
                font-weight: 500;
                color: ${color};
              ">${formattedPercentage}%</div>
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
      const pnl = trade.pnl ?? 0;
      if (pnl > 0) {
        totalWinTrades++;
        winAmount += pnl;
      } else if (pnl < 0) {
        totalLossTrades++;
        lossAmount += Math.abs(pnl);
      }
    });

    // Calcular solo winValue (plata real ganada) y winPercentage
    const winValue = winAmount; // Plata real ganada
    const totalTrades = totalWinTrades + totalLossTrades;
    const winPercentage = totalTrades > 0 ? (totalWinTrades / totalTrades) * 100 : 0;
    
    // Calcular lossValue y lossPercentage como lo que falta para completar
    const lossValue = lossAmount; // Plata real perdida
    const lossPercentage = 100 - winPercentage; // Lo que falta para llegar al 100%

    const result = {
      winValue: Math.round(winValue * 100) / 100,
      lossValue: Math.round(lossValue * 100) / 100,
      winPercentage: Math.round(winPercentage * 10) / 10,
      lossPercentage: Math.round(lossPercentage * 10) / 10
    };

    return result;
  }

  getWinLossData() {
    return this.calculateWinLossData();
  }

  formatCurrency(value: number): string {
    return this.numberFormatter.formatCurrency(value);
  }

  formatPercentage(value: number): string {
    return this.numberFormatter.formatPercentage(value);
  }
}
