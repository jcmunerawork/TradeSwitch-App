import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface TradeLockerCredentials {
  email: string;
  password: string;
  server: string;
}

export interface TradeLockerTokenResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}

export interface TradeLockerAccount {
  accountId: string;
  accountName: string;
  balance: number;
  currency: string;
  server: string;
}

@Injectable({
  providedIn: 'root'
})
export class TradeLockerApiService {
  private readonly baseUrl = 'https://demo.tradelocker.com/backend-api';

  constructor(private http: HttpClient) {}

  /**
   * Get JWT token from TradeLocker
   */
  getJWTToken(credentials: TradeLockerCredentials): Observable<TradeLockerTokenResponse> {
    const tokenUrl = `${this.baseUrl}/auth/jwt/token`;
    
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
    });

    const body = {
      email: credentials.email,
      password: credentials.password,
      server: credentials.server
    };

    return this.http.post<TradeLockerTokenResponse>(tokenUrl, body, { headers });
  }

  refreshToken(accessToken: string): Observable<any> {
    const refreshUrl = `${this.baseUrl}/auth/jwt/refresh`;
    
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    });
    
    return this.http.post<any>(refreshUrl, { headers });
  }

  /**
   * Validate account credentials in TradeLocker
   */
  async validateAccount(credentials: TradeLockerCredentials): Promise<boolean> {
    try {
      const tokenResponse = await this.getJWTToken(credentials).toPromise();
      return !!(tokenResponse && tokenResponse.accessToken);
    } catch (error) {
      console.error('Error validating account in TradeLocker:', error);
      return false;
    }
  }

  /**
   * Get account balance from TradeLocker
   */
  getAccountBalance(accountId: string, userKey: string, accountNumber: number): Observable<any> {
    const balanceUrl = `${this.baseUrl}/trade/accounts/${accountId}/state`;
    
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userKey}`,
      'accNum': accountNumber.toString()
    });

    return this.http.get(balanceUrl, { headers });
  }

  /**
   * Get trading history from TradeLocker
   */
  getTradingHistory(userKey: string, accountId: string, accNum: number): Observable<any> {
    const historyUrl = `${this.baseUrl}/trade/accounts/${accountId}/ordersHistory`;
    
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userKey}`,
      'accNum': accNum.toString()
    });

    return this.http.get(historyUrl, { headers });
  }

  /**
   * Get user key for API calls
   */
  getUserKey(email: string, password: string, server: string): Observable<string> {
    const credentials: TradeLockerCredentials = { email, password, server };
    return this.getJWTToken(credentials).pipe(
      map(response => response.accessToken)
    );
  }

  /**
   * Get instrument details
   */
  getInstrumentDetails(accessToken: string, tradableInstrumentId: string, routeId: string, accNum: number): Observable<any> {
    const instrumentsUrl = `${this.baseUrl}/trade/instruments/${tradableInstrumentId}`;
    
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'accNum': accNum.toString()
    });

    const params = {
      routeId: routeId
    };

    return this.http.get(instrumentsUrl, { headers, params });
  }

  /**
   * Get all instruments for an account
   */
  getAllInstruments(accessToken: string, accountId: string, accNum: number): Observable<any> {
    const instrumentsUrl = `${this.baseUrl}/trade/accounts/${accountId}/instruments`;
    
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'accNum': accNum.toString()
    });

    return this.http.get(instrumentsUrl, { headers });
  }

}
