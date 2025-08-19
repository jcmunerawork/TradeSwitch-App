import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { map, Observable } from 'rxjs';
import { GroupedTrade, historyTrade } from '../models/report.model';
import {
  arrayToHistoryTrade,
  groupOrdersByPosition,
} from '../utils/normalization-utils';

@Injectable({ providedIn: 'root' })
export class ReportService {
  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private http: HttpClient
  ) {}

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
    accessToken: string
  ): Observable<GroupedTrade[]> {
    const headers = new HttpHeaders({
      Authorization: `Bearer ${accessToken}`,
      accNum: 1,
    });

    const from = Date.UTC(2025, 0, 1, 0, 0, 0);
    const to = Date.UTC(2025, 7, 31, 23, 59, 59);

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
            details.d.ordersHistory.map(arrayToHistoryTrade); // ajusta según tu estructura
          const groupedTrades = groupOrdersByPosition(historyTrades);
          return groupedTrades;
        })
      );
  }
}
