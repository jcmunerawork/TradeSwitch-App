import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { BackendApiService } from '../../core/services/backend-api.service';
import { getAuth } from 'firebase/auth';

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
 * IMPORTANTE: Este servicio NO hace conexiones directas a TradeLocker API.
 * Todas las llamadas pasan por el backend propio (BackendApiService) que actúa como proxy.
 * 
 * Endpoints del backend propio:
 * - POST /api/v1/tradelocker/auth/token - Obtener JWT token
 * - POST /api/v1/tradelocker/validate - Validar cuenta
 * - GET /api/v1/tradelocker/accounts/{accountId}/balance - Obtener balance
 * - GET /api/v1/tradelocker/accounts/{accountId}/history - Obtener historial
 * - GET /api/v1/tradelocker/instruments/{id} - Obtener detalles de instrumento
 * - GET /api/v1/tradelocker/accounts/{accountId}/instruments - Listar instrumentos
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
  // NOTA: Este servicio NO hace conexiones directas a TradeLocker API.
  // Todas las llamadas pasan por el backend propio que actúa como proxy.
  // Las URLs de TradeLocker se mantienen solo como referencia/documentación.

  constructor(
    private backendApi: BackendApiService
  ) {}

  /**
   * Get Firebase ID token for backend API calls
   */
  private async getIdToken(): Promise<string> {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('User not authenticated');
    }
    return await currentUser.getIdToken();
  }

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
   * Now uses backend API but maintains same interface
   * 
   * Uses stagingBaseUrl to validate account credentials.
   * Returns tokens for all accounts of a user (same as getAccountTokens).
   * This method is used for account validation when creating new accounts.
   * 
   * @param credentials - Account credentials (email, password, server)
   * @returns Observable with AccountTokenResponse containing array of account tokens
   */
  getJWTTokenStaging(credentials: TradeLockerCredentials): Observable<AccountTokenResponse> {
    return new Observable(observer => {
      this.getIdToken().then(idToken => {
        this.backendApi.getTradeLockerJWTToken(credentials, idToken).then(response => {
          console.log('🔑 TradeLockerApiService: getJWTTokenStaging backend response:', response);
          
          if (!response.success) {
            const errorMessage = response.error?.message || 'Failed to get JWT token';
            console.error('❌ TradeLockerApiService: Backend returned error:', errorMessage, response.error);
            observer.error(new Error(errorMessage));
            return;
          }
          
          if (!response.data) {
            console.error('❌ TradeLockerApiService: No data in backend response:', response);
            observer.error(new Error('No data in backend response'));
            return;
          }
          
          // El backend devuelve { data: any[] }, así que response.data ya es el objeto con la propiedad data
          const tokenData = response.data.data || response.data || [];
          
          console.log('🔑 TradeLockerApiService: Processed token data:', tokenData);
          
          if (!Array.isArray(tokenData)) {
            console.error('❌ TradeLockerApiService: Token data is not an array:', tokenData);
            observer.error(new Error(`Invalid response format. Expected array but got: ${typeof tokenData}`));
            return;
          }
          
          observer.next({ data: tokenData } as AccountTokenResponse);
          observer.complete();
        }).catch(error => {
          console.error('❌ TradeLockerApiService: Error calling backend API:', error);
          observer.error(error);
        });
      }).catch(error => {
        console.error('❌ TradeLockerApiService: Error getting ID token:', error);
        observer.error(error);
      });
    });
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
    return new Observable(observer => {
      this.getIdToken().then(idToken => {
        this.backendApi.refreshTradeLockerToken(accessToken, idToken).then(response => {
          if (response.success && response.data) {
            observer.next(response.data);
            observer.complete();
          } else {
            observer.error(new Error(response.error?.message || 'Failed to refresh token'));
          }
        }).catch(error => {
          observer.error(error);
        });
      }).catch(error => {
        observer.error(error);
      });
    });
  }

  /**
   * Validate account credentials in TradeLocker
   * Now uses backend API but maintains same interface
   * 
   * Uses staging API to validate if account exists.
   * Returns true if account exists (token received), false otherwise.
   */
  async validateAccount(credentials: TradeLockerCredentials): Promise<boolean> {
    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.validateTradeLockerAccount(credentials, idToken);
      
      if (!response.success || !response.data) {
        return false;
      }
      
      return response.data.isValid;
    } catch (error) {
      console.error('Error validating account in TradeLocker:', error);
      return false;
    }
  }

  /**
   * COMENTADO: Método antiguo de obtención de balance - ahora se usa Streams API
   * Get account balance from TradeLocker
   * Now uses backend API but maintains same interface
   * Este método se mantiene como backup pero los balances ahora vienen de streams en tiempo real
   * 
   * Los balances se actualizan automáticamente a través de StreamsService cuando se reciben
   * mensajes AccountStatus del Streams API.
   * 
   * NOTA: El backend gestiona el accessToken automáticamente, no es necesario enviarlo.
   */
  getAccountBalance(accountId: string, accountNumber: number): Observable<any> {
    return new Observable(observer => {
      this.getIdToken().then(idToken => {
        this.backendApi.getTradeLockerAccountBalance(accountId, accountNumber, idToken).then(response => {
          if (response.success && response.data) {
            observer.next(response.data);
            observer.complete();
          } else {
            observer.error(new Error(response.error?.message || 'Failed to get account balance'));
          }
        }).catch(error => {
          observer.error(error);
        });
      }).catch(error => {
        observer.error(error);
      });
    });
  }

  /**
   * Get trading history from TradeLocker
   * Now uses backend API but maintains same interface
   * 
   * NOTA: El backend gestiona el accessToken automáticamente, no es necesario enviarlo.
   */
  getTradingHistory(accountId: string, accNum: number): Observable<any> {
    return new Observable(observer => {
      this.getIdToken().then(idToken => {
        this.backendApi.getTradeLockerTradingHistory(accountId, accNum, idToken).then(response => {
          if (response.success && response.data) {
            // NUEVO FORMATO: El backend devuelve { success: true, data: { trades: [...] } }
            // Los trades ya vienen en formato GroupedTradeFinal
            if (response.data.trades && Array.isArray(response.data.trades)) {
              // Formato nuevo: devolver directamente los trades
              observer.next({ trades: response.data.trades });
            } 
            // FORMATO ANTIGUO: { d: { ordersHistory: [...] } }
            else if (response.data.d && response.data.d.ordersHistory) {
              observer.next(response.data);
            } 
            // Si no hay estructura reconocida, devolver vacío
            else {
              console.warn(`⚠️ Formato de respuesta no reconocido para account ${accountId}:`, response.data);
              observer.next({ trades: [] });
            }
            observer.complete();
          } else {
            // Si es 404, puede ser que la cuenta no tenga historial o no exista
            const errorMessage = response.error?.message || 'Failed to get trading history';
            console.warn(`⚠️ Trading history not found for account ${accountId}:`, errorMessage);
            // Retornar array vacío en lugar de error para 404
            if (response.error?.message?.includes('404') || response.error?.message?.includes('Not Found')) {
              observer.next({ trades: [] }); // Estructura nueva vacía
              observer.complete();
            } else {
              observer.error(new Error(errorMessage));
            }
          }
        }).catch(error => {
          // Manejar 404 específicamente
          if (error?.status === 404 || error?.statusText === 'Not Found') {
            console.warn(`⚠️ Trading history endpoint returned 404 for account ${accountId}. Account may not have history or may not exist.`);
            // Retornar estructura vacía en lugar de error
            observer.next({ trades: [] });
            observer.complete();
          } else {
            console.error(`❌ Error getting trading history for account ${accountId}:`, error);
            observer.error(error);
          }
        });
      }).catch(error => {
        observer.error(error);
      });
    });
  }

  /**
   * Get user key for API calls
   * Now uses backend API but maintains same interface
   * 
   * Uses staging API to get user authentication token.
   * Returns the accessToken from the first account in the response.
   */
  getUserKey(email: string, password: string, server: string): Observable<string> {
    const credentials: TradeLockerCredentials = { email, password, server };
    return this.getJWTTokenStaging(credentials).pipe(
      map(response => {
        // La respuesta es AccountTokenResponse con estructura { data: AccountTokenData[] }
        console.log('🔑 TradeLockerApiService: getUserKey response:', response);
        
        if (!response) {
          console.error('❌ TradeLockerApiService: No response received');
          throw new Error('No response received from backend');
        }
        
        if (!response.data) {
          console.error('❌ TradeLockerApiService: No data in response:', response);
          throw new Error('No data found in response');
        }
        
        if (!Array.isArray(response.data) || response.data.length === 0) {
          console.error('❌ TradeLockerApiService: Empty or invalid data array:', response.data);
          throw new Error(`No accounts found in response. Expected array but got: ${JSON.stringify(response.data)}`);
        }
        
        const firstAccount = response.data[0];
        console.log('🔑 TradeLockerApiService: First account data:', firstAccount);
        
        if (!firstAccount.accessToken) {
          console.error('❌ TradeLockerApiService: No accessToken in first account:', firstAccount);
          throw new Error(`No access token found in response. Account data: ${JSON.stringify(firstAccount)}`);
        }
        
        return firstAccount.accessToken;
      }),
      catchError(error => {
        console.error('❌ TradeLockerApiService: Error in getUserKey:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get instrument details
   * Now uses backend API but maintains same interface
   * 
   * NOTA: El backend gestiona el accessToken automáticamente, se pasa accountId en su lugar.
   */
  getInstrumentDetails(accountId: string, tradableInstrumentId: string, routeId: string, accNum: number): Observable<any> {
    return new Observable(observer => {
      this.getIdToken().then(idToken => {
        this.backendApi.getTradeLockerInstrumentDetails(accountId, tradableInstrumentId, routeId, accNum, idToken).then(response => {
          if (response.success && response.data) {
            observer.next(response.data);
            observer.complete();
          } else {
            observer.error(new Error(response.error?.message || 'Failed to get instrument details'));
          }
        }).catch(error => {
          observer.error(error);
        });
      }).catch(error => {
        observer.error(error);
      });
    });
  }

  /**
   * Get all instruments for an account
   * Now uses backend API but maintains same interface
   * 
   * NOTA: El backend gestiona el accessToken automáticamente, no es necesario enviarlo.
   */
  getAllInstruments(accountId: string, accNum: number): Observable<any> {
    return new Observable(observer => {
      this.getIdToken().then(idToken => {
        this.backendApi.getTradeLockerAllInstruments(accountId, accNum, idToken).then(response => {
          if (response.success && response.data) {
            observer.next(response.data);
            observer.complete();
          } else {
            observer.error(new Error(response.error?.message || 'Failed to get all instruments'));
          }
        }).catch(error => {
          observer.error(error);
        });
      }).catch(error => {
        observer.error(error);
      });
    });
  }

  /**
   * Get account tokens for Streams API
   * Now uses backend API but maintains same interface
   * Returns tokens for all accounts of a user
   */
  getAccountTokens(credentials: TradeLockerCredentials): Observable<AccountTokenResponse> {
    return new Observable(observer => {
      this.getIdToken().then(idToken => {
        this.backendApi.getTradeLockerAccountTokens(credentials, idToken).then(response => {
          if (response.success && response.data) {
            observer.next({ data: response.data.data || [] } as AccountTokenResponse);
            observer.complete();
          } else {
            observer.error(new Error(response.error?.message || 'Failed to get account tokens'));
          }
        }).catch(error => {
          observer.error(error);
        });
      }).catch(error => {
        observer.error(error);
      });
    });
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
