import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

/**
 * Interface for TradeLocker API credentials.
 *
 * @interface TradeLockerCredentials
 */
export interface TradeLockerCredentials {
  email: string;
  password: string;
  server: string;
}

/**
 * Interface for TradeLocker token response.
 *
 * @interface TradeLockerTokenResponse
 */
export interface TradeLockerTokenResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}

/**
 * Interface for TradeLocker account data.
 *
 * @interface TradeLockerAccount
 */
export interface TradeLockerAccount {
  accountId: string;
  accountName: string;
  balance: number;
  currency: string;
  server: string;
}

/**
 * Service for interacting with the TradeLocker API.
 *
 * This service provides methods to authenticate with TradeLocker, fetch
 * account balances, trading history, and instrument details. It handles
 * JWT token management and API communication.
 *
 * Features:
 * - JWT token authentication
 * - Token refresh
 * - Account validation
 * - Account balance fetching
 * - Trading history retrieval
 * - Instrument details fetching
 * - All instruments listing
 * - User key generation
 *
 * API Endpoints:
 * - Base URL: https://demo.tradelocker.com/backend-api
 * - Auth: /auth/jwt/token, /auth/jwt/refresh
 * - Trade: /trade/accounts/{accountId}/state, /trade/accounts/{accountId}/ordersHistory
 * - Instruments: /trade/instruments/{tradableInstrumentId}, /trade/accounts/{accountId}/instruments
 *
 * Relations:
 * - Used by ReportService for fetching trading data
 * - Used by CreateAccountPopupComponent for account validation
 * - Used by TradingAccountsComponent for balance fetching
 *
 * @service
 * @injectable
 * @providedIn root
 */
@Injectable({
  providedIn: 'root'
})
export class TradeLockerApiService {
  private readonly baseUrl = 'https://demo.tradelocker.com/backend-api';
  // COMENTADO: URL antigua, ahora se usa stagingBaseUrl para obtener tokens
  // private readonly baseUrl = 'https://demo.tradelocker.com/backend-api';
  private readonly stagingBaseUrl = 'https://stg.tradelocker.com/backend-api';

  constructor(private http: HttpClient) {}

  /**
   * Get JWT token from TradeLocker
   * COMENTADO: Este método se mantiene como backup, pero ahora se usa getJWTTokenStaging() para validación
   */
  // getJWTToken(credentials: TradeLockerCredentials): Observable<TradeLockerTokenResponse> {
  //   const tokenUrl = `${this.baseUrl}/auth/jwt/token`;
  //   
  //   const headers = new HttpHeaders({
  //     'Content-Type': 'application/json',
  //   });

  //   const body = {
  //     email: credentials.email,
  //     password: credentials.password,
  //     server: credentials.server
  //   };

  //   return this.http.post<TradeLockerTokenResponse>(tokenUrl, body, { headers });
  // }

  /**
   * Get JWT token from TradeLocker Staging API
   * 
   * Uses stagingBaseUrl to validate account credentials.
   * Returns tokens for all accounts of a user (same as getAccountTokens).
   * This method is used for account validation when creating new accounts.
   * 
   * @param credentials - Account credentials (email, password, server)
   * @returns Observable with AccountTokenResponse containing array of account tokens
   */
  getJWTTokenStaging(credentials: TradeLockerCredentials): Observable<AccountTokenResponse> {
    const tokenUrl = `${this.stagingBaseUrl}/auth/jwt/accounts/tokens`;
    
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    });

    const body = {
      email: credentials.email,
      password: credentials.password,
      server: credentials.server
    };

    return this.http.post<AccountTokenResponse>(tokenUrl, body, { headers });
  }
  
  /**
   * COMENTADO: Método antiguo de obtención de balance - ahora se usa Streams API
   * Get account balance from TradeLocker
   * Este método se mantiene como backup pero los balances ahora vienen de streams en tiempo real
   */
  // getAccountBalance(accountId: string, userKey: string, accountNumber: number): Observable<any> {
  //   const balanceUrl = `${this.baseUrl}/trade/accounts/${accountId}/state`;
  //   
  //   const headers = new HttpHeaders({
  //     'Content-Type': 'application/json',
  //     'Authorization': `Bearer ${userKey}`,
  //     'accNum': accountNumber.toString()
  //   });
  //
  //   return this.http.get(balanceUrl, { headers });
  // }

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
   * 
   * Uses staging API to validate if account exists.
   * Returns true if account exists (token received), false otherwise.
   */
  async validateAccount(credentials: TradeLockerCredentials): Promise<boolean> {
    try {
      const tokenResponse = await this.getJWTTokenStaging(credentials).toPromise();
      // La respuesta es AccountTokenResponse con estructura { data: AccountTokenData[] }
      return !!(tokenResponse && tokenResponse.data && tokenResponse.data.length > 0 && tokenResponse.data[0].accessToken);
    } catch (error) {
      console.error('Error validating account in TradeLocker:', error);
      return false;
    }
  }

  /**
   * COMENTADO: Método antiguo de obtención de balance - ahora se usa Streams API
   * Get account balance from TradeLocker
   * Este método se mantiene como backup pero los balances ahora vienen de streams en tiempo real
   * 
   * Los balances se actualizan automáticamente a través de StreamsService cuando se reciben
   * mensajes AccountStatus del Streams API.
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
   * 
   * Uses staging API to get user authentication token.
   * Returns the accessToken from the first account in the response.
   */
  getUserKey(email: string, password: string, server: string): Observable<string> {
    const credentials: TradeLockerCredentials = { email, password, server };
    return this.getJWTTokenStaging(credentials).pipe(
      map(response => {
        // La respuesta es AccountTokenResponse con estructura { data: AccountTokenData[] }
        if (response && response.data && response.data.length > 0 && response.data[0].accessToken) {
          return response.data[0].accessToken;
        }
        throw new Error('No access token found in response');
      })
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

  /**
   * Get account tokens for Streams API
   * Returns tokens for all accounts of a user
   */
  getAccountTokens(credentials: TradeLockerCredentials): Observable<AccountTokenResponse> {
    const tokenUrl = `${this.stagingBaseUrl}/auth/jwt/accounts/tokens`;
    
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
    });

    const body = {
      email: credentials.email,
      password: credentials.password,
      server: credentials.server
    };

    return this.http.post<AccountTokenResponse>(tokenUrl, body, { headers });
  }

}

/**
 * Interface for account token response from Streams API
 */
export interface AccountTokenData {
  accessToken: string;
  expireDate: string;
  accountId: string;
}

export interface AccountTokenResponse {
  data: AccountTokenData[];
}
