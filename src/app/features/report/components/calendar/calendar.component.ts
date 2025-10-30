import { CommonModule } from '@angular/common';
import {
  Component,
  Input,
  Output,
  EventEmitter,
  SimpleChanges,
} from '@angular/core';
import {
  CalendarDay,
  GroupedTradeFinal,
  PluginHistoryRecord,
} from '../../models/report.model';
import { ReportService } from '../../service/report.service';
import { NumberFormatterService } from '../../../../shared/utils/number-formatter.service';
import { TradesPopupComponent } from '../trades-popup/trades-popup.component';
import { ConfigurationOverview } from '../../../strategy/models/strategy.model';
import { PluginHistoryService, PluginHistory } from '../../../../shared/services/plugin-history.service';
import { AppContextService } from '../../../../shared/context';
import { TradeLockerApiService } from '../../../../shared/services/tradelocker-api.service';
import { TimezoneService } from '../../../../shared/services/timezone.service';

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss'],
  standalone: true,
  imports: [CommonModule, TradesPopupComponent],
})
export class CalendarComponent {
  @Input() groupedTrades!: GroupedTradeFinal[];
  @Output() strategyFollowedPercentageChange = new EventEmitter<number>();
  @Input() strategies!: ConfigurationOverview[];
  @Input() userId!: string; // Necesario para obtener el plugin history

  calendar: CalendarDay[][] = [];
  currentDate!: Date;
  selectedMonth!: Date;
  
  // Popup properties
  showTradesPopup = false;
  selectedDay: CalendarDay | null = null;
  
  // Plugin history properties
  pluginHistory: PluginHistory | null = null;

  constructor(
    private reportSvc: ReportService,
    private pluginHistoryService: PluginHistoryService,
    private appContext: AppContextService,
    private tradeLockerApiService: TradeLockerApiService,
    private timezoneService: TimezoneService
  ) {}
  private numberFormatter = new NumberFormatterService();

  ngOnChanges(changes: SimpleChanges) {
    this.currentDate = new Date();
    this.selectedMonth = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth());

    // Obtener userId desde el contexto de autenticación
    this.loadUserIdAndInitialize();

    // Procesar trades para obtener nombres de instrumentos
    this.processTradesForCalendar();

    this.generateCalendar(this.selectedMonth);

    if (this.strategies && this.strategies.length > 0) {
      this.getPercentageStrategyFollowedLast30Days();
    }
  }

  emitStrategyFollowedPercentage(value: number): void {
    this.strategyFollowedPercentageChange.emit(value);
  }

  /**
   * Obtener userId desde el contexto de autenticación y inicializar
   */
  private async loadUserIdAndInitialize() {
    try {
      // Obtener el usuario actual desde el contexto
      const currentUser = this.appContext.currentUser();
      
      if (currentUser && currentUser.id) {
        this.userId = currentUser.id;
        
        // Cargar plugin history con el userId obtenido
        await this.loadPluginHistory();
      }
    } catch (error) {
      console.error('Error obteniendo userId desde contexto:', error);
    }
  }

  /**
   * Convertir Timestamp de Firestore a Date
   */
  private convertFirestoreTimestamp(timestamp: any): Date {
    if (timestamp && typeof timestamp === 'object' && 'seconds' in timestamp) {
      // Es un Timestamp de Firestore
      return new Date(timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000);
    } else {
      // Es un string o Date normal
      return new Date(timestamp);
    }
  }

  /**
   * MEJORA: Convertir fecha a UTC considerando zona horaria del usuario
   * MÉTODO ESPECÍFICO: Para fechas de trades del servidor
   */
  private convertToUTCWithTimezone(date: Date | string | number): Date {
    try {
      // Usar el método específico para fechas de trades
      return this.timezoneService.convertTradeDateToUTC(date);
    } catch (error) {
      console.error('Error convirtiendo fecha a UTC:', error);
      // Fallback: conversión básica
      return new Date(date);
    }
  }

  /**
   * Procesar trades para obtener nombres de instrumentos
   */
  private async processTradesForCalendar() {
    if (!this.groupedTrades || this.groupedTrades.length === 0) {
      return;
    }

    // Verificar si los trades ya tienen nombres de instrumentos correctos
    const firstTrade = this.groupedTrades[0];
    const needsProcessing = !firstTrade.instrument || 
                           firstTrade.instrument === firstTrade.tradableInstrumentId ||
                           firstTrade.instrument === '' ||
                           firstTrade.instrument === 'Cargando...';

    if (!needsProcessing) {
      return; // Ya están procesados
    }

    try {
      // Obtener instrumentos únicos (optimización: solo una petición por combinación única)
      const uniqueInstruments = new Map<string, { tradableInstrumentId: string, routeId: string }>();
      
      this.groupedTrades.forEach(trade => {
        if (trade.tradableInstrumentId && trade.routeId) {
          const key = `${trade.tradableInstrumentId}-${trade.routeId}`;
          if (!uniqueInstruments.has(key)) {
            uniqueInstruments.set(key, {
              tradableInstrumentId: trade.tradableInstrumentId,
              routeId: trade.routeId
            });
          }
        }
      });

      // Establecer "Cargando..." como valor inicial para todos los trades
      this.groupedTrades.forEach(trade => {
        if (trade.tradableInstrumentId && trade.routeId) {
          trade.instrument = 'Cargando...';
        }
      });

      // Obtener detalles de instrumentos (una sola petición por combinación única)
      const instrumentDetailsMap = new Map<string, { lotSize: number, name: string }>();

      for (const [key, instrument] of uniqueInstruments) {
        try {
          // Obtener el token real del usuario desde el contexto
          const userKey = await this.getUserToken();
          if (!userKey) {
            throw new Error('Token de usuario no disponible');
          }

          const instrumentDetails = await this.reportSvc.getInstrumentDetails(
            userKey, // Token real del usuario
            instrument.tradableInstrumentId,
            instrument.routeId,
            1
          ).toPromise();

          if (instrumentDetails) {
            instrumentDetailsMap.set(key, {
              lotSize: instrumentDetails.lotSize || 1,
              name: instrumentDetails.name || instrument.tradableInstrumentId
            });
          } else {
            instrumentDetailsMap.set(key, {
              lotSize: 1,
              name: instrument.tradableInstrumentId
            });
          }

        } catch (error) {
          console.warn(`Error obteniendo detalles del instrumento ${key}:`, error);
          instrumentDetailsMap.set(key, {
            lotSize: 1,
            name: instrument.tradableInstrumentId
          });
        }
      }

      // Actualizar trades con nombres de instrumentos (aplicar a todos los trades con la misma combinación)
      this.groupedTrades.forEach(trade => {
        if (trade.tradableInstrumentId && trade.routeId) {
          const key = `${trade.tradableInstrumentId}-${trade.routeId}`;
          const instrumentDetails = instrumentDetailsMap.get(key);
          
          if (instrumentDetails) {
            trade.instrument = instrumentDetails.name;
          } else {
            trade.instrument = trade.tradableInstrumentId; // Fallback al ID
          }
        }
      });

    } catch (error) {
      console.error('Error procesando trades para calendario:', error);
      // En caso de error, establecer fallback
      this.groupedTrades.forEach(trade => {
        if (trade.tradableInstrumentId && trade.routeId) {
          trade.instrument = trade.tradableInstrumentId;
        }
      });
    }
  }

  /**
   * Obtener el token del usuario desde el store
   */
  private async getUserToken(): Promise<string | null> {
    try {
      // Obtener la cuenta actual del contexto
      const accounts = this.appContext.userAccounts();
      if (!accounts || accounts.length === 0) {
        return null;
      }
      
      const currentAccount = accounts[0]; // Tomar la primera cuenta

      // Usar el TradeLockerApiService para obtener el token
      const userKey = await this.tradeLockerApiService.getUserKey(
        currentAccount.emailTradingAccount,
        currentAccount.brokerPassword,
        currentAccount.server
      ).toPromise();

      if (userKey) {
        return userKey;
      }

      return null;
    } catch (error) {
      console.error('Error obteniendo token del usuario:', error);
      return null;
    }
  }

  /**
   * Cargar plugin history para el usuario
   */
  async loadPluginHistory() {
    try {
      const pluginHistoryArray = await this.pluginHistoryService.getPluginUsageHistory(this.userId);
      if (pluginHistoryArray.length > 0) {
        this.pluginHistory = pluginHistoryArray[0];
      } else {
        this.pluginHistory = null;
      }
    } catch (error) {
      console.error('Error loading plugin history:', error);
      this.pluginHistory = null;
    }
  }

  /**
   * Determinar qué estrategia se siguió en una fecha específica
   * NUEVA LÓGICA: Asociar trades con estrategias basándose en fechas exactas
   * @param tradeDate - Fecha y hora exacta del trade a validar
   * @returns nombre de la estrategia seguida o null si no se siguió ninguna
   */
  getStrategyFollowedOnDate(tradeDate: Date): string | null {
    // PASO 1: Verificar si el plugin estaba activo en la fecha/hora exacta del trade
    const pluginActiveRange = this.getPluginActiveRange(tradeDate);
    if (!pluginActiveRange) {
      return null; // Plugin no estaba activo
    }

    // PASO 2: Buscar estrategias que incluyan la fecha/hora exacta del trade
    const activeStrategy = this.getActiveStrategyAtTime(tradeDate);
    if (!activeStrategy) {
      return null; // No había estrategia activa en ese momento
    }

    return activeStrategy;
  }

  /**
   * PASO 1: Determinar si el plugin estaba activo en la fecha/hora exacta del trade
   * MEJORA: Usar conversión UTC para comparaciones precisas
   * @param tradeDate - Fecha y hora exacta del trade
   * @returns rango activo del plugin o null si no estaba activo
   */
  private getPluginActiveRange(tradeDate: Date): { start: Date, end: Date } | null {
    if (!this.pluginHistory || !this.pluginHistory.dateActive || !this.pluginHistory.dateInactive) {
      return null;
    }

    const dateActive = this.pluginHistory.dateActive;
    const dateInactive = this.pluginHistory.dateInactive;
    const now = new Date();

    // MEJORA: Convertir fecha del trade a UTC para comparación precisa
    const tradeDateUTC = this.convertToUTCWithTimezone(tradeDate);


    // Crear rangos de actividad del plugin
    const activeRanges: { start: Date, end: Date }[] = [];

    // Si dateActive tiene más elementos que dateInactive, está activo hasta ahora
    if (dateActive.length > dateInactive.length) {
      // Crear rangos para todos los pares completos
      for (let i = 0; i < dateInactive.length; i++) {
        activeRanges.push({
          start: this.convertToUTCWithTimezone(dateActive[i]),
          end: this.convertToUTCWithTimezone(dateInactive[i])
        });
      }
      // El último rango activo va desde la última fecha de active hasta ahora
      activeRanges.push({
        start: this.convertToUTCWithTimezone(dateActive[dateActive.length - 1]),
        end: this.convertToUTCWithTimezone(now)
      });
    } else {
      // Si tienen la misma cantidad, crear rangos de fechas
      for (let i = 0; i < dateActive.length; i++) {
        activeRanges.push({
          start: this.convertToUTCWithTimezone(dateActive[i]),
          end: this.convertToUTCWithTimezone(dateInactive[i])
        });
      }
    }

    // Verificar si el plugin estaba activo en la fecha/hora exacta del trade
    for (const range of activeRanges) {
      if (tradeDateUTC >= range.start && tradeDateUTC <= range.end) {
        return range; // Plugin estaba activo en este rango
      }
    }

    return null; // Plugin no estaba activo
  }

  /**
   * PASO 2: Buscar la estrategia activa en la fecha/hora exacta del trade
   * MEJORA: Usar conversión UTC para comparaciones precisas
   * @param tradeDate - Fecha y hora exacta del trade
   * @returns nombre de la estrategia activa o null si no había ninguna
   */
  private getActiveStrategyAtTime(tradeDate: Date): string | null {
    if (!this.strategies || this.strategies.length === 0) {
      return null;
    }

    // MEJORA: Convertir fecha del trade a UTC para comparación precisa
    const tradeDateUTC = this.convertToUTCWithTimezone(tradeDate);


    // Buscar estrategias activas en la fecha/hora exacta del trade
    for (const strategy of this.strategies) {
      // IMPORTANTE: NO filtrar estrategias eliminadas aquí
      // Las estrategias eliminadas (soft delete) SÍ deben considerarse
      // porque en el momento del trade existían y podrían haber sido seguidas
      
      if (this.isStrategyActiveAtTime(strategy, tradeDateUTC)) {
        return strategy.name || 'Unknown Strategy';
      }
    }

    return null; // No había estrategia activa en ese momento
  }

  /**
   * Verificar si una estrategia específica estaba activa en la fecha/hora exacta
   * MEJORA: Usar conversión UTC para comparaciones precisas
   * @param strategy - Estrategia a verificar
   * @param tradeDate - Fecha y hora exacta del trade (ya en UTC)
   * @returns true si la estrategia estaba activa, false si no
   */
  private isStrategyActiveAtTime(strategy: ConfigurationOverview, tradeDate: Date): boolean {
    // Si la estrategia no tiene fechas de activación, no estaba activa
    if (!strategy.dateActive || !strategy.dateInactive) {
      return false;
    }

    const strategyActive = strategy.dateActive;
    const strategyInactive = strategy.dateInactive;
    const now = new Date();

    // Crear rangos de actividad de la estrategia
    const strategyRanges: { start: Date, end: Date }[] = [];

    // Si strategyActive tiene más elementos que strategyInactive, está activa hasta ahora
    if (strategyActive.length > strategyInactive.length) {
      // Crear rangos para todos los pares completos
      for (let i = 0; i < strategyInactive.length; i++) {
        strategyRanges.push({
          start: this.convertToUTCWithTimezone(this.convertFirestoreTimestamp(strategyActive[i])),
          end: this.convertToUTCWithTimezone(this.convertFirestoreTimestamp(strategyInactive[i]))
        });
      }
      // El último rango activo va desde la última fecha de active hasta ahora
      strategyRanges.push({
        start: this.convertToUTCWithTimezone(this.convertFirestoreTimestamp(strategyActive[strategyActive.length - 1])),
        end: this.convertToUTCWithTimezone(now)
      });
    } else {
      // Si tienen la misma cantidad, crear rangos de fechas
      for (let i = 0; i < strategyActive.length; i++) {
        strategyRanges.push({
          start: this.convertToUTCWithTimezone(this.convertFirestoreTimestamp(strategyActive[i])),
          end: this.convertToUTCWithTimezone(this.convertFirestoreTimestamp(strategyInactive[i]))
        });
      }
    }

    // Verificar si la estrategia estaba activa en la fecha/hora exacta del trade
    for (const range of strategyRanges) {
      if (tradeDate >= range.start && tradeDate <= range.end) {
        return true; // Estrategia estaba activa en este rango
      }
    }

    return false; // Estrategia no estaba activa
  }

  /**
   * Determinar si se siguió la estrategia basándose en los rangos de fechas del plugin
   * @param tradeDate - Fecha del trade a validar
   * @returns true si se siguió la estrategia, false si no
   */
  didFollowStrategy(tradeDate: Date): boolean {
    return this.getStrategyFollowedOnDate(tradeDate) !== null;
  }

  /**
   * Obtener información detallada sobre la estrategia seguida en un trade específico
   * @param tradeDate - Fecha y hora exacta del trade
   * @returns objeto con información detallada sobre la estrategia seguida
   */
  getTradeStrategyInfo(tradeDate: Date): {
    followedStrategy: boolean;
    strategyName: string | null;
    pluginActive: boolean;
    pluginActiveRange: { start: Date, end: Date } | null;
    strategyActiveRange: { start: Date, end: Date } | null;
  } {
    const pluginActiveRange = this.getPluginActiveRange(tradeDate);
    const strategyName = this.getActiveStrategyAtTime(tradeDate);
    
    // Obtener el rango activo de la estrategia si existe
    let strategyActiveRange: { start: Date, end: Date } | null = null;
    if (strategyName && this.strategies) {
      const strategy = this.strategies.find(s => s.name === strategyName);
      if (strategy && strategy.dateActive && strategy.dateInactive) {
        strategyActiveRange = this.getStrategyActiveRange(strategy, tradeDate);
      }
    }

    return {
      followedStrategy: strategyName !== null,
      strategyName,
      pluginActive: pluginActiveRange !== null,
      pluginActiveRange,
      strategyActiveRange
    };
  }

  /**
   * Obtener el rango activo de una estrategia específica en una fecha
   * @param strategy - Estrategia a verificar
   * @param tradeDate - Fecha del trade
   * @returns rango activo de la estrategia o null si no estaba activa
   */
  private getStrategyActiveRange(strategy: ConfigurationOverview, tradeDate: Date): { start: Date, end: Date } | null {
    if (!strategy.dateActive || !strategy.dateInactive) {
      return null;
    }

    const strategyActive = strategy.dateActive;
    const strategyInactive = strategy.dateInactive;
    const now = new Date();

    // Crear rangos de actividad de la estrategia
    const strategyRanges: { start: Date, end: Date }[] = [];

    // Si strategyActive tiene más elementos que strategyInactive, está activa hasta ahora
    if (strategyActive.length > strategyInactive.length) {
      // Crear rangos para todos los pares completos
      for (let i = 0; i < strategyInactive.length; i++) {
        strategyRanges.push({
          start: this.convertFirestoreTimestamp(strategyActive[i]),
          end: this.convertFirestoreTimestamp(strategyInactive[i])
        });
      }
      // El último rango activo va desde la última fecha de active hasta ahora
      strategyRanges.push({
        start: this.convertFirestoreTimestamp(strategyActive[strategyActive.length - 1]),
        end: now
      });
    } else {
      // Si tienen la misma cantidad, crear rangos de fechas
      for (let i = 0; i < strategyActive.length; i++) {
        strategyRanges.push({
          start: this.convertFirestoreTimestamp(strategyActive[i]),
          end: this.convertFirestoreTimestamp(strategyInactive[i])
        });
      }
    }

    // Buscar el rango que contiene la fecha del trade
    for (const range of strategyRanges) {
      if (tradeDate >= range.start && tradeDate <= range.end) {
        return range;
      }
    }

    return null;
  }

  generateCalendar(targetMonth: Date) {
    const tradesByDay: { [date: string]: GroupedTradeFinal[] } = {};

    // Primero, filtrar trades válidos (con positionId válido) y deduplicar
    const validTrades = this.groupedTrades.filter(trade => 
      trade.positionId && 
      trade.positionId !== 'null' && 
      trade.positionId !== '' &&
      trade.positionId !== null
    );
    
    // Deduplicar por positionId
    const uniqueTrades = validTrades.filter((trade, index, self) => 
      index === self.findIndex(t => t.positionId === trade.positionId)
    );

    // Agrupar trades únicos por día usando la zona horaria del dispositivo
    uniqueTrades.forEach((trade) => {
      // MEJORA: Usar conversión correcta de fecha de trade
      const tradeDate = this.convertToUTCWithTimezone(Number(trade.lastModified));
      
      // Usar la zona horaria local del dispositivo
      const key = `${tradeDate.getFullYear()}-${tradeDate.getMonth()}-${tradeDate.getDate()}`;

      // Solo incluir trades que estén en el mes seleccionado
      const tradeYear = tradeDate.getFullYear();
      const tradeMonth = tradeDate.getMonth();
      const targetYear = targetMonth.getFullYear();
      const targetMonthIndex = targetMonth.getMonth();
      
      if (tradeYear === targetYear && tradeMonth === targetMonthIndex) {
        if (!tradesByDay[key]) tradesByDay[key] = [];
        tradesByDay[key].push(trade);
      }
    });

    // Generar calendario del mes objetivo
    const year = targetMonth.getFullYear();
    const month = targetMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Calcular inicio y fin de la semana
    let startDay = new Date(firstDay);
    startDay.setDate(firstDay.getDate() - firstDay.getDay());
    let endDay = new Date(lastDay);
    endDay.setDate(lastDay.getDate() + (6 - lastDay.getDay()));

    const days: CalendarDay[] = [];
    let currentDay = new Date(startDay);
    
    while (currentDay <= endDay) {
      const key = `${currentDay.getFullYear()}-${currentDay.getMonth()}-${currentDay.getDate()}`;
      const trades = tradesByDay[key] || [];
      const pnlTotal = trades.reduce((acc, t) => acc + (t.pnl ?? 0), 0);

      const wins = trades.filter((t) => (t.pnl ?? 0) > 0).length;
      const losses = trades.filter((t) => (t.pnl ?? 0) < 0).length;
      const tradesCount = trades.length;
      const tradeWinPercent = tradesCount > 0 ? Math.round((wins / tradesCount) * 1000) / 10 : 0;
      
      // Determinar si se siguió la estrategia basándose en los rangos de fechas del plugin
      // Para cada día, verificar si ALGÚN trade siguió la estrategia
      let followedStrategy = false;
      let strategyName: string | null = null;
      
      if (tradesCount > 0) {
        // Verificar cada trade individualmente usando su fecha/hora exacta
        for (const trade of trades) {
          // MEJORA: Usar conversión correcta de fecha de trade
          const tradeDate = this.convertToUTCWithTimezone(Number(trade.lastModified));
          const tradeStrategyInfo = this.getTradeStrategyInfo(tradeDate);
          
          if (tradeStrategyInfo.followedStrategy) {
            followedStrategy = true;
            strategyName = tradeStrategyInfo.strategyName;
            break; // Si al menos un trade siguió la estrategia, el día cuenta
          }
        }
      }

      days.push({
        date: new Date(currentDay),
        trades: trades as GroupedTradeFinal[],
        pnlTotal,
        tradesCount: trades.length,
        followedStrategy: followedStrategy,
        tradeWinPercent: Math.round(tradeWinPercent),
        strategyName: strategyName,
        isCurrentMonth: currentDay.getMonth() === month && currentDay.getFullYear() === year,
      });

      currentDay.setDate(currentDay.getDate() + 1);
    }

    // Organizar en semanas
    this.calendar = [];
    for (let i = 0; i < days.length; i += 7) {
      this.calendar.push(days.slice(i, i + 7));
    }
    
  }

  getDateNDaysAgo(daysAgo: number): Date {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date;
  }

  filterDaysInRange(
    days: CalendarDay[],
    fromDate: Date,
    toDate: Date
  ): CalendarDay[] {
    return days.filter((day) => day.date >= fromDate && day.date <= toDate);
  }

  countStrategyFollowedDays(days: CalendarDay[]): number {
    return days.filter((day) => day.followedStrategy && day.tradesCount > 0)
      .length;
  }

  calculateStrategyFollowedPercentage(
    days: CalendarDay[],
    periodDays: number
  ): number {
    if (days.length === 0) return 0;

    const fromDate = this.getDateNDaysAgo(periodDays - 1);
    const toDate = new Date();

    const daysInRange = this.filterDaysInRange(days, fromDate, toDate);
    const count = this.countStrategyFollowedDays(daysInRange);

    const percentage = (count / periodDays) * 100;

    return Math.round(percentage * 10) / 10;
  }

  getPercentageStrategyFollowedLast30Days() {
    const percentage = this.calculateStrategyFollowedPercentage(
      this.calendar.flat(),
      30
    );
    this.emitStrategyFollowedPercentage(percentage);
  }

  get currentMonthYear(): string {
    const options: Intl.DateTimeFormatOptions = { month: 'short' };
    const month = this.selectedMonth.toLocaleString('en-US', options);
    const year = this.selectedMonth.getFullYear();
    return `${month}, ${year}`;
  }

  // Navigation methods
  canNavigateLeft(): boolean {
    if (!this.groupedTrades || this.groupedTrades.length === 0) return false;
    
    const earliestTradeDate = this.getEarliestTradeDate();
    const firstDayOfSelectedMonth = new Date(this.selectedMonth.getFullYear(), this.selectedMonth.getMonth(), 1);
    
    return earliestTradeDate < firstDayOfSelectedMonth;
  }

  canNavigateRight(): boolean {
    if (!this.groupedTrades || this.groupedTrades.length === 0) return false;
    
    const latestTradeDate = this.getLatestTradeDate();
    const lastDayOfSelectedMonth = new Date(this.selectedMonth.getFullYear(), this.selectedMonth.getMonth() + 1, 0);
    
    return latestTradeDate > lastDayOfSelectedMonth;
  }

  private getEarliestTradeDate(): Date {
    if (!this.groupedTrades || this.groupedTrades.length === 0) return new Date();
    
    const dates = this.groupedTrades.map(trade => new Date(Number(trade.lastModified)));
    return new Date(Math.min(...dates.map(d => d.getTime())));
  }

  private getLatestTradeDate(): Date {
    if (!this.groupedTrades || this.groupedTrades.length === 0) return new Date();
    
    const dates = this.groupedTrades.map(trade => new Date(Number(trade.lastModified)));
    return new Date(Math.max(...dates.map(d => d.getTime())));
  }

  navigateToPreviousMonth(): void {
    if (this.canNavigateLeft()) {
      this.selectedMonth = new Date(this.selectedMonth.getFullYear(), this.selectedMonth.getMonth() - 1);
      this.generateCalendar(this.selectedMonth);
    }
  }

  navigateToNextMonth(): void {
    if (this.canNavigateRight()) {
      this.selectedMonth = new Date(this.selectedMonth.getFullYear(), this.selectedMonth.getMonth() + 1);
      this.generateCalendar(this.selectedMonth);
    }
  }

  navigateToCurrentMonth(): void {
    this.selectedMonth = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth());
    this.generateCalendar(this.selectedMonth);
  }

  // Export functionality
  exportData() {
    const csvData = this.generateCSVData();
    this.downloadCSV(csvData, `trading-data-${this.currentMonthYear.replace(', ', '-').toLowerCase()}.csv`);
  }

  generateCSVData(): string {
    const headers = ['Date', 'PnL Total', 'Trades Count', 'Win Percentage', 'Strategy Followed', 'Strategy Name'];
    const rows = [headers.join(',')];

    this.calendar.flat().forEach(day => {
      const date = day.date.toISOString().split('T')[0];
      const pnlTotal = day.pnlTotal.toFixed(2);
      const tradesCount = day.tradesCount;
      const winPercentage = day.tradeWinPercent;
      const strategyFollowed = day.followedStrategy ? 'Yes' : 'No';
      const strategyName = day.strategyName || 'None';

      rows.push([date, pnlTotal, tradesCount, winPercentage, strategyFollowed, strategyName].join(','));
    });

    return rows.join('\n');
  }

  downloadCSV(csvData: string, filename: string) {
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  // Weekly summary methods
  getWeekTotal(week: CalendarDay[]): number {
    return week.reduce((total, day) => total + day.pnlTotal, 0);
  }

  getWeekActiveDays(week: CalendarDay[]): number {
    return week.filter(day => day.tradesCount > 0).length;
  }

  // Popup methods
  onDayClick(day: CalendarDay) {
    if (day.tradesCount > 0) {
      this.selectedDay = day;
      this.showTradesPopup = true;
    }
  }

  onClosePopup() {
    this.showTradesPopup = false;
    this.selectedDay = null;
  }

  formatCurrency(value: number): string {
    return this.numberFormatter.formatCurrency(value);
  }

  formatPercentage(value: number): string {
    return this.numberFormatter.formatPercentage(value);
  }

  /**
   * Obtener resumen de estrategias seguidas en un período
   * @param days - Array de días del calendario
   * @returns objeto con estadísticas de estrategias
   */
  getStrategySummary(days: CalendarDay[]): {
    totalDays: number;
    strategyDays: number;
    strategiesUsed: { [strategyName: string]: number };
    strategyPercentage: number;
  } {
    const totalDays = days.length;
    let strategyDays = 0;
    const strategiesUsed: { [strategyName: string]: number } = {};

    days.forEach(day => {
      if (day.followedStrategy && day.strategyName) {
        strategyDays++;
        if (strategiesUsed[day.strategyName]) {
          strategiesUsed[day.strategyName]++;
        } else {
          strategiesUsed[day.strategyName] = 1;
        }
      }
    });

    const strategyPercentage = totalDays > 0 ? Math.round((strategyDays / totalDays) * 100 * 10) / 10 : 0;

    return {
      totalDays,
      strategyDays,
      strategiesUsed,
      strategyPercentage
    };
  }

  /**
   * Obtener resumen de estrategias para los últimos N días
   * @param days - Número de días a analizar
   * @returns resumen de estrategias
   */
  getStrategySummaryLastNDays(days: number): {
    totalDays: number;
    strategyDays: number;
    strategiesUsed: { [strategyName: string]: number };
    strategyPercentage: number;
  } {
    const fromDate = this.getDateNDaysAgo(days - 1);
    const toDate = new Date();
    const daysInRange = this.filterDaysInRange(this.calendar.flat(), fromDate, toDate);
    
    return this.getStrategySummary(daysInRange);
  }

  /**
   * Obtener análisis detallado de trades que siguieron estrategias
   * @param days - Array de días del calendario
   * @returns análisis detallado de trades y estrategias
   */
  getDetailedTradeAnalysis(days: CalendarDay[]): {
    totalTrades: number;
    tradesWithStrategy: number;
    tradesWithoutStrategy: number;
    strategyCompliance: number;
    tradesByStrategy: { [strategyName: string]: number };
    tradesWithoutPlugin: number;
    tradesWithPluginButNoStrategy: number;
  } {
    let totalTrades = 0;
    let tradesWithStrategy = 0;
    let tradesWithoutStrategy = 0;
    let tradesWithoutPlugin = 0;
    let tradesWithPluginButNoStrategy = 0;
    const tradesByStrategy: { [strategyName: string]: number } = {};

    days.forEach(day => {
      if (day.trades && day.trades.length > 0) {
        day.trades.forEach(trade => {
          totalTrades++;
          // MEJORA: Usar conversión correcta de fecha de trade
          const tradeDate = this.convertToUTCWithTimezone(Number(trade.lastModified));
          const tradeStrategyInfo = this.getTradeStrategyInfo(tradeDate);
          
          if (!tradeStrategyInfo.pluginActive) {
            tradesWithoutPlugin++;
          } else if (tradeStrategyInfo.followedStrategy) {
            tradesWithStrategy++;
            const strategyName = tradeStrategyInfo.strategyName || 'Unknown';
            tradesByStrategy[strategyName] = (tradesByStrategy[strategyName] || 0) + 1;
          } else {
            tradesWithPluginButNoStrategy++;
          }
        });
      }
    });

    tradesWithoutStrategy = tradesWithoutPlugin + tradesWithPluginButNoStrategy;
    const strategyCompliance = totalTrades > 0 ? Math.round((tradesWithStrategy / totalTrades) * 100 * 10) / 10 : 0;

    return {
      totalTrades,
      tradesWithStrategy,
      tradesWithoutStrategy,
      strategyCompliance,
      tradesByStrategy,
      tradesWithoutPlugin,
      tradesWithPluginButNoStrategy
    };
  }

  /**
   * Obtener análisis detallado de trades para los últimos N días
   * @param days - Número de días a analizar
   * @returns análisis detallado de trades
   */
  getDetailedTradeAnalysisLastNDays(days: number): {
    totalTrades: number;
    tradesWithStrategy: number;
    tradesWithoutStrategy: number;
    strategyCompliance: number;
    tradesByStrategy: { [strategyName: string]: number };
    tradesWithoutPlugin: number;
    tradesWithPluginButNoStrategy: number;
  } {
    const fromDate = this.getDateNDaysAgo(days - 1);
    const toDate = new Date();
    const daysInRange = this.filterDaysInRange(this.calendar.flat(), fromDate, toDate);
    
    return this.getDetailedTradeAnalysis(daysInRange);
  }

  /**
   * Verificar estado actual del plugin
   * @returns true si el plugin está activo ahora, false si no
   */
  isPluginCurrentlyActive(): boolean {
    if (!this.pluginHistory) {
      return false;
    }
    
    return this.pluginHistoryService.isPluginActiveByDates(this.pluginHistory);
  }

  /**
   * Obtener información detallada del estado del plugin
   * @returns información completa del estado del plugin
   */
  getPluginStatusInfo(): {
    isActive: boolean;
    lastActiveDate: string | null;
    lastInactiveDate: string | null;
    activeRanges: { start: string, end: string }[];
  } {
    if (!this.pluginHistory) {
      return {
        isActive: false,
        lastActiveDate: null,
        lastInactiveDate: null,
        activeRanges: []
      };
    }

    const isActive = this.pluginHistoryService.isPluginActiveByDates(this.pluginHistory);
    const lastActiveDate = this.pluginHistory.dateActive?.[this.pluginHistory.dateActive.length - 1] || null;
    const lastInactiveDate = this.pluginHistory.dateInactive?.[this.pluginHistory.dateInactive.length - 1] || null;
    
    // Crear rangos activos para mostrar
    const activeRanges: { start: string, end: string }[] = [];
    if (this.pluginHistory.dateActive && this.pluginHistory.dateInactive) {
      const dateActive = this.pluginHistory.dateActive;
      const dateInactive = this.pluginHistory.dateInactive;
      
      for (let i = 0; i < Math.min(dateActive.length, dateInactive.length); i++) {
        activeRanges.push({
          start: new Date(dateActive[i]).toISOString(),
          end: new Date(dateInactive[i]).toISOString()
        });
      }
    }

    return {
      isActive,
      lastActiveDate,
      lastInactiveDate,
      activeRanges
    };
  }

}
