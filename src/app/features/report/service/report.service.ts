import { TradeLockerApiService } from '../../../shared/services/tradelocker-api.service';
import { MonthlyReportsService } from '../../../shared/services/monthly-reports.service';
import { Injectable } from '@angular/core';
import { map, Observable, switchMap } from 'rxjs';
import { AppContextService } from '../../../shared/context';
import {
  GroupedTrade,
  GroupedTradeFinal,
  BalanceData,
  historyTrade,
  MonthlyReport,
  InstrumentDetails,
  Instrument,
} from '../models/report.model';
import {
  arrayToHistoryTrade,
  groupOrdersByPosition,
} from '../utils/normalization-utils';

/**
 * Service for managing report data and API interactions.
 *
 * This service acts as an intermediary between the ReportComponent and external services,
 * handling data fetching, transformation, and context updates for trading reports.
 *
 * Responsibilities:
 * - Fetching trading history from TradeLocker API
 * - Fetching account balance data
 * - Fetching instrument details
 * - Updating monthly reports
 * - Managing loading states in AppContextService
 *
 * Relations:
 * - TradeLockerApiService: Direct API communication
 * - MonthlyReportsService: Monthly report data management
 * - AppContextService: Global state and loading management
 *
 * @injectable
 * @providedIn root
 */
@Injectable({ providedIn: 'root' })
export class ReportService {
  /**
   * Constructor for ReportService.
   *
   * @param tradeLockerApiService - Service for TradeLocker API interactions
   * @param monthlyReportsService - Service for monthly report management
   * @param appContext - Application context service for global state
   */
  constructor(
    private tradeLockerApiService: TradeLockerApiService,
    private monthlyReportsService: MonthlyReportsService,
    private appContext: AppContextService
  ) {}

  /**
   * Updates a monthly report in the database.
   *
   * @param monthlyReport - The monthly report data to update
   * @returns Promise that resolves when the update is complete
   * @memberof ReportService
   */
  async updateMonthlyReport(monthlyReport: MonthlyReport) {
    return this.monthlyReportsService.updateMonthlyReport(monthlyReport);
  }

  /**
   * Gets user authentication key from TradeLocker API.
   *
   * Authenticates user credentials and returns an access token for API requests.
   *
   * @param email - Trading account email
   * @param password - Trading account password
   * @param server - Trading server name
   * @returns Observable that emits the user key (access token)
   * @memberof ReportService
   */
  getUserKey(
    email: string,
    password: string,
    server: string
  ): Observable<string> {
    return this.tradeLockerApiService.getUserKey(email, password, server);
  }

  /**
   * Fetches trading history data for an account.
   *
   * Retrieves order history from TradeLocker API, transforms it into GroupedTradeFinal objects,
   * and updates the application context with the processed data.
   *
   * Process:
   * 1. Sets loading state in AppContextService
   * 2. Fetches order history from API
   * 3. Transforms array data to historyTrade objects
   * 4. Groups orders by position using groupOrdersByPosition
   * 5. Updates AppContextService with grouped trades
   * 6. Clears loading state
   *
   * Related to:
   * - arrayToHistoryTrade(): Transforms API array to historyTrade
   * - groupOrdersByPosition(): Groups trades by position
   * - AppContextService.updateReportHistory(): Updates global state
   *
   * @param accountId - Trading account ID
   * @param accessToken - User authentication token
   * @param accNum - Account number
   * @returns Observable that emits an array of GroupedTradeFinal objects
   * @memberof ReportService
   */
  getHistoryData(
    accountId: string,
    accNum: number
  ): Observable<GroupedTradeFinal[]> {
    this.appContext.setLoading('report', true);
    this.appContext.setError('report', null);
    
    return this.tradeLockerApiService.getTradingHistory(accountId, accNum)
      .pipe(
        switchMap(async (details) => {
          // NUEVO FORMATO: El backend devuelve trades ya procesados en formato GroupedTradeFinal
          if (details && details.trades && Array.isArray(details.trades)) {
            const groupedTrades = details.trades as GroupedTradeFinal[];
            // Asegurar que todos los trades tengan los campos requeridos
            const normalizedTrades = groupedTrades.map(trade => ({
              ...trade,
              pnl: trade.pnl ?? 0,
              isOpen: trade.isOpen ?? false,
              lastModified: trade.lastModified?.toString() || trade.createdDate?.toString() || Date.now().toString(),
              positionId: trade.positionId || trade.id || '',
              instrument: trade.instrument || trade.tradableInstrumentId || '',
              closedDate: (trade as any).closedDate?.toString() || trade.lastModified?.toString() || undefined // Nuevo campo del backend
            }));
            
            this.appContext.updateReportHistory(normalizedTrades);
            this.appContext.setLoading('report', false);
            return normalizedTrades;
          }
          
          // FORMATO ANTIGUO: { d: { ordersHistory: [...] } } - necesita transformación
          if (details && details.d && details.d.ordersHistory) {
            const historyTrades: historyTrade[] =
              details.d.ordersHistory.map(arrayToHistoryTrade);
            
            // Pasar accountId y accNum a la función (el backend gestiona el accessToken)
            const groupedTrades = await groupOrdersByPosition(historyTrades, this, accountId, accNum);
            
            // Actualizar contexto con los datos del historial
            this.appContext.updateReportHistory(groupedTrades);
            this.appContext.setLoading('report', false);
            
            return groupedTrades;
          }

          // Si no hay datos válidos, retornar array vacío
          this.appContext.updateReportHistory([]);
          this.appContext.setLoading('report', false);
          return [];
        })
      );
  }

  /**
   * Fetches account balance data from TradeLocker API.
   *
   * Retrieves comprehensive balance information including available funds, margin requirements,
   * daily trading statistics, and open position data.
   *
   * Process:
   * 1. Sets loading state in AppContextService
   * 2. Fetches balance data from API
   * 3. Maps array data to BalanceData interface
   * 4. Updates AppContextService with balance data
   * 5. Clears loading state
   *
   * Related to:
   * - AppContextService.updateReportBalance(): Updates global balance state
   *
   * @param accountId - Trading account ID
   * @param accessToken - User authentication token
   * @param accNum - Account number
   * @returns Observable that emits BalanceData object
   * @memberof ReportService
   */
  getBalanceData(
    accountId: string,
    accNum: number
  ): Observable<any> {
    this.appContext.setLoading('report', true);
    this.appContext.setError('report', null);
    
    return this.tradeLockerApiService.getAccountBalance(accountId, accNum)
      .pipe(
        map((details) => {
          // Verificar si hay datos válidos
          if (!details || !details.d || !details.d.accountDetailsData) {
            const emptyBalanceData: BalanceData = {
              balance: 0,
              projectedBalance: 0,
              availableFunds: 0,
              blockedBalance: 0,
              cashBalance: 0,
              unsettledCash: 0,
              withdrawalAvailable: 0,
              stocksValue: 0,
              optionValue: 0,
              initialMarginReq: 0,
              maintMarginReq: 0,
              marginWarningLevel: 0,
              blockedForStocks: 0,
              stockOrdersReq: 0,
              stopOutLevel: 0,
              warningMarginReq: 0,
              marginBeforeWarning: 0,
              todayGross: 0,
              todayNet: 0,
              todayFees: 0,
              todayVolume: 0,
              todayTradesCount: 0,
              openGrossPnL: 0,
              openNetPnL: 0,
              positionsCount: 0,
              ordersCount: 0
            };
            
            this.appContext.updateReportBalance(emptyBalanceData);
            this.appContext.setLoading('report', false);
            return emptyBalanceData;
          }

          // Extract all balance data for calculations
          const accountData = details.d;
          
          // Mapear el array accountDetailsData a las propiedades específicas
          const accountDetailsData = accountData.accountDetailsData;
          const balanceData: BalanceData = {
            balance: accountDetailsData[0] || 0,
            projectedBalance: accountDetailsData[1] || 0,
            availableFunds: accountDetailsData[2] || 0,
            blockedBalance: accountDetailsData[3] || 0,
            cashBalance: accountDetailsData[4] || 0,
            unsettledCash: accountDetailsData[5] || 0,
            withdrawalAvailable: accountDetailsData[6] || 0,
            stocksValue: accountDetailsData[7] || 0,
            optionValue: accountDetailsData[8] || 0,
            initialMarginReq: accountDetailsData[9] || 0,
            maintMarginReq: accountDetailsData[10] || 0,
            marginWarningLevel: accountDetailsData[11] || 0,
            blockedForStocks: accountDetailsData[12] || 0,
            stockOrdersReq: accountDetailsData[13] || 0,
            stopOutLevel: accountDetailsData[14] || 0,
            warningMarginReq: accountDetailsData[15] || 0,
            marginBeforeWarning: accountDetailsData[16] || 0,
            todayGross: accountDetailsData[17] || 0,
            todayNet: accountDetailsData[18] || 0,
            todayFees: accountDetailsData[19] || 0,
            todayVolume: accountDetailsData[20] || 0,
            todayTradesCount: accountDetailsData[21] || 0,
            openGrossPnL: accountDetailsData[22] || 0,
            openNetPnL: accountDetailsData[23] || 0,
            positionsCount: accountDetailsData[24] || 0,
            ordersCount: accountDetailsData[25] || 0
          };
          
          // Actualizar contexto con los datos de balance
          this.appContext.updateReportBalance(balanceData);
          this.appContext.setLoading('report', false);
          
          return balanceData;
        })
      );
  }

  /**
   * Fetches detailed information about a trading instrument.
   *
   * Retrieves instrument metadata including lot size, name, currency, and trading specifications.
   * Used primarily for calculating accurate PnL and displaying instrument names.
   *
   * @param accessToken - User authentication token
   * @param tradableInstrumentId - Unique identifier for the instrument
   * @param routeId - Route ID for the instrument
   * @param accNum - Account number
   * @returns Observable that emits InstrumentDetails object
   * @memberof ReportService
   */
  getInstrumentDetails(
    accountId: string,
    tradableInstrumentId: string,
    routeId: string,
    accNum: number
  ): Observable<InstrumentDetails> {
    return this.tradeLockerApiService.getInstrumentDetails(accountId, tradableInstrumentId, routeId, accNum)
      .pipe(
        map((details) => {
          // Extract all instrument data for calculations
          const instrumentData = details.d;
          const instrumentDetailsData: InstrumentDetails = instrumentData;

          return instrumentDetailsData;
        })
      );
  }

  /**
   * Fetches all available trading instruments for an account.
   *
   * Retrieves a list of all instruments that can be traded on the account,
   * including basic information like ID, name, and routes.
   *
   * @param accessToken - User authentication token
   * @param accNum - Account number
   * @param accountId - Trading account ID
   * @returns Observable that emits an array of Instrument objects
   * @memberof ReportService
   */
  getAllInstruments(
    accountId: string,
    accNum: number
  ): Observable<Instrument[]> {
    return this.tradeLockerApiService.getAllInstruments(accountId, accNum)
      .pipe(
        map((details) => {
          return details.d.instruments;
        })
      )
      .pipe(
        map((instruments) => {
          return instruments.map((instrument: Instrument) => {
            return instrument;
          });
        })
      );
  }
}
