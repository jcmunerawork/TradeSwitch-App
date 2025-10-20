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

@Injectable({ providedIn: 'root' })
export class ReportService {
  constructor(
    private tradeLockerApiService: TradeLockerApiService,
    private monthlyReportsService: MonthlyReportsService,
    private appContext: AppContextService
  ) {}

  async updateMonthlyReport(monthlyReport: MonthlyReport) {
    return this.monthlyReportsService.updateMonthlyReport(monthlyReport);
  }

  getUserKey(
    email: string,
    password: string,
    server: string
  ): Observable<string> {
    return this.tradeLockerApiService.getUserKey(email, password, server);
  }

  getHistoryData(
    accountId: string,
    accessToken: string,
    accNum: number
  ): Observable<GroupedTradeFinal[]> {
    this.appContext.setLoading('report', true);
    this.appContext.setError('report', null);
    
    return this.tradeLockerApiService.getTradingHistory(accessToken, accountId, accNum)
      .pipe(
        switchMap(async (details) => {
          // Verificar si hay datos válidos
          if (!details || !details.d || !details.d.ordersHistory) {
            this.appContext.updateReportHistory([]);
            this.appContext.setLoading('report', false);
            return [];
          }

          const historyTrades: historyTrade[] =
            details.d.ordersHistory.map(arrayToHistoryTrade);
          
          // Pasar accessToken y accNum a la función
          const groupedTrades = await groupOrdersByPosition(historyTrades, this, accessToken, accNum);
          
          // Actualizar contexto con los datos del historial
          this.appContext.updateReportHistory(groupedTrades);
          this.appContext.setLoading('report', false);
          
          return groupedTrades;
        })
      );
  }

  getBalanceData(
    accountId: string,
    accessToken: string,
    accNum: number
  ): Observable<any> {
    this.appContext.setLoading('report', true);
    this.appContext.setError('report', null);
    
    return this.tradeLockerApiService.getAccountBalance(accountId, accessToken, accNum)
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

  getInstrumentDetails(
    accessToken: string,
    tradableInstrumentId: string,
    routeId: string,
    accNum: number
  ): Observable<InstrumentDetails> {
    return this.tradeLockerApiService.getInstrumentDetails(accessToken, tradableInstrumentId, routeId, accNum)
      .pipe(
        map((details) => {
          // Extract all instrument data for calculations
          const instrumentData = details.d;
          const instrumentDetailsData: InstrumentDetails = instrumentData;

          return instrumentDetailsData;
        })
      );
  }

  getAllInstruments(
    accessToken: string,
    accNum: number,
    accountId: string
  ): Observable<Instrument[]> {
    return this.tradeLockerApiService.getAllInstruments(accessToken, accountId, accNum)
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
