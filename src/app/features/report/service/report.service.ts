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
      .pipe(map((auth) => auth.accessToken));
  }

  getHistoryData(
    accountId: string,
    accessToken: string,
    accNum: number,
    from: string,
    to: string
  ): Observable<GroupedTrade[]> {
    const headers = new HttpHeaders({
      Authorization: `Bearer ${accessToken}`,
      accNum: accNum,
    });

    const params = new HttpParams()
      .set('from', from.toString())
      .set('to', to.toString());

    return this.http
      .get<any>(
        `https://demo.tradelocker.com/backend-api/trade/accounts/${accountId}/ordersHistory`,
        { headers, params }
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
      accNum: accNum.toString(),
    });

    return this.http
      .get<any>(
        `https://demo.tradelocker.com/backend-api/trade/accounts/${accountId}/state`,
        { headers }
      )
      .pipe(
        map((details) => {
          return details.d.accountDetailsData[0] as unknown as number;
        })
      );
  }
}
