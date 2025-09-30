import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { map, Observable, switchMap } from 'rxjs';
import {
  GroupedTrade,
  GroupedTradeFinal,
  BalanceData,
  historyTrade,
  MonthlyReport,
  InstrumentDetails,
} from '../models/report.model';
import {
  arrayToHistoryTrade,
  groupOrdersByPosition,
} from '../utils/normalization-utils';
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { User } from '../../overview/models/overview';
import { randomUUID } from 'crypto';
import { newDataId } from '../utils/firebase-data-utils';

@Injectable({ providedIn: 'root' })
export class ReportService {
  private isBrowser: boolean;
  private db: ReturnType<typeof getFirestore> | null = null;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private http: HttpClient
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (this.isBrowser) {
      const { firebaseApp } = require('../../../firebase/firebase.init.ts');
      this.db = getFirestore(firebaseApp);
    }
  }

  async updateMonthlyReport(monthlyReport: MonthlyReport) {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return;
    }

    const id = newDataId(
      monthlyReport.id,
      monthlyReport.month,
      monthlyReport.year
    );

    await setDoc(doc(this.db, 'monthly_reports', id), monthlyReport);
  }

  getUserKey(
    email: string,
    password: string,
    server: string
  ): Observable<string> {
    return this.http
      .post<any>('https://demo.tradelocker.com/backend-api/auth/jwt/token', {
        email,
        password,
        server,
      })
      .pipe(
        map((auth) => {
          return auth.accessToken;
        })
      );
  }

  getHistoryData(
    accountId: string,
    accessToken: string,
    accNum: number
  ): Observable<GroupedTradeFinal[]> {
    const headers = new HttpHeaders({
      Authorization: `Bearer ${accessToken}`,
      accNum: accNum,
    });

    return this.http
      .get<any>(
        `https://demo.tradelocker.com/backend-api/trade/accounts/${accountId}/ordersHistory`,
        { headers }
      )
      .pipe(
        switchMap(async (details) => {
          const historyTrades: historyTrade[] =
            details.d.ordersHistory.map(arrayToHistoryTrade);
          
          // Pasar accessToken y accNum a la función
          const groupedTrades = await groupOrdersByPosition(historyTrades, {
            getInstrumentDetails: (accessToken: string, tradableInstrumentId: string, routeId: string, accNum: number) => {
              return this.getInstrumentDetails(accessToken, tradableInstrumentId, routeId, accNum);
            }
          }, accessToken, accNum);
          
          return groupedTrades;
        })
      );
  }

  getBalanceData(
    accountId: string,
    accessToken: string,
    accNum: number
  ): Observable<any> {
    const headers = new HttpHeaders({
      Authorization: `Bearer ${accessToken}`,
      accNum: accNum,
    });

    return this.http
      .get<any>(
        `https://demo.tradelocker.com/backend-api/trade/accounts/${accountId}/state`,
        { headers }
      )
      .pipe(
        map((details) => {
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
    const headers = new HttpHeaders({
      Authorization: `Bearer ${accessToken}`,
      accNum: accNum.toString(),
    });

    // Agregar routeId como query parameter
    const params = new HttpParams()
      .set('routeId', routeId);

    return this.http
      .get<any>(
        `https://demo.tradelocker.com/backend-api/trade/instruments/${tradableInstrumentId}`,
        { 
          headers,
          params
        }
      )
      .pipe(
        map((details) => {
          // Extract all instrument data for calculations
          const instrumentData = details.d;
          const instrumentDetailsData: InstrumentDetails = instrumentData;

          return instrumentDetailsData;
        })
      );
  }
}
