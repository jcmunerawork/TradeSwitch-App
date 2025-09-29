import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { map, Observable } from 'rxjs';
import {
  GroupedTrade,
  historyTrade,
  MonthlyReport,
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

  async getPluginUsageHistory(idToSearch: string): Promise<any[]> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return [];
    }

    const ref = collection(this.db, 'plugin_history');
    const q = query(ref, where('id', '==', idToSearch));

    const matchingDocs: any[] | PromiseLike<any[]> = [];
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
      matchingDocs.push(doc.data());
    });

    return matchingDocs;
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
  ): Observable<GroupedTrade[]> {
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
        map((details) => {
          const historyTrades: historyTrade[] =
            details.d.ordersHistory.map(arrayToHistoryTrade);
          const groupedTrades = groupOrdersByPosition(historyTrades);
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
          const accountData = details.d.accountDetailsData;
          const balanceData = {
            balance: accountData[0], // balance
            projectedBalance: accountData[1], // projectedBalance
            availableFunds: accountData[2], // availableFunds
            blockedBalance: accountData[3], // blockedBalance
            cashBalance: accountData[4], // cashBalance
            unsettledCash: accountData[5], // unsettledCash
            withdrawalAvailable: accountData[6], // withdrawalAvailable
            stocksValue: accountData[7], // stocksValue
            optionValue: accountData[8], // optionValue
            initialMarginReq: accountData[9], // initialMarginReq
            maintMarginReq: accountData[10], // maintMarginReq
            marginWarningLevel: accountData[11], // marginWarningLevel
            blockedForStocks: accountData[12], // blockedForStocks
            stockOrdersReq: accountData[13], // stockOrdersReq
            stopOutLevel: accountData[14], // stopOutLevel
            warningMarginReq: accountData[15], // warningMarginReq
            marginBeforeWarning: accountData[16], // marginBeforeWarning
            todayGross: accountData[17], // todayGross - A gross profit for today
            todayNet: accountData[18], // todayNet - A total profit or loss realized from positions today
            todayFees: accountData[19], // todayFees - Fees paid today
            todayVolume: accountData[20], // todayVolume - A total volume traded for today
            todayTradesCount: accountData[21], // todayTradesCount - A number of trades done for today
            openGrossPnL: accountData[22], // openGrossPnL - A profit or loss on all currently opened positions
            openNetPnL: accountData[23], // openNetPnL - A net profit or loss on open positions
            positionsCount: accountData[24], // positionsCount - A number of currently opened positions
            ordersCount: accountData[25] // ordersCount - A number of currently placed pending orders
          };

          return balanceData;
        })
      );
  }
}
