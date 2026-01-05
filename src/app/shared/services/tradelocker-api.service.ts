import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError, shareReplay, finalize } from 'rxjs/operators';
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

  // Cache para tokens con TTL (5 minutos)
  // Clave: `${email}:${server}`, Valor: { token: string, expiresAt: number }
  private tokenCache = new Map<string, { token: string; expiresAt: number }>();
  private readonly TOKEN_CACHE_TTL = 5 * 60 * 1000; // 5 minutos
  
  // Map para evitar múltiples llamadas simultáneas con las mismas credenciales
  // Clave: `${email}:${server}`, Valor: Observable<string>
  private pendingRequests = new Map<string, Observable<string>>();

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
          
          // El backend puede devolver:
          // 1. Un objeto directo con { accessToken, refreshToken, expireDate } (nuevo formato)
          // 2. Un objeto con { data: [...] } (formato antiguo)
          // 3. Un array directo (formato antiguo)
          
          // Usar 'any' para manejar los diferentes formatos de respuesta
          const data: any = response.data;
          let tokenData: any[];
          
          // Si data tiene accessToken directamente, es el nuevo formato
          if (data && typeof data === 'object' && 'accessToken' in data && !Array.isArray(data)) {
            // Nuevo formato: convertir objeto a array para mantener compatibilidad
            tokenData = [{
              accessToken: data.accessToken,
              refreshToken: data.refreshToken,
              expireDate: data.expireDate,
              accountId: data.accountId || '' // Si el backend no lo envía, usar string vacío
            }];
            console.log('🔑 TradeLockerApiService: Detected new format (object), converted to array');
          } else if (Array.isArray(data)) {
            // Formato antiguo: array directo
            tokenData = data;
            console.log('🔑 TradeLockerApiService: Detected old format (array direct)');
          } else if (data && typeof data === 'object' && 'data' in data && Array.isArray(data.data)) {
            // Formato antiguo: { data: [...] }
            tokenData = data.data;
            console.log('🔑 TradeLockerApiService: Detected old format (nested data array)');
          } else {
            // Intentar como array vacío o error
            console.error('❌ TradeLockerApiService: Token data format not recognized:', data);
            observer.error(new Error(`Invalid response format. Expected object with accessToken or array, but got: ${typeof data}`));
            return;
          }
          
          console.log('🔑 TradeLockerApiService: Processed token data:', tokenData);
          
          if (!Array.isArray(tokenData) || tokenData.length === 0) {
            console.error('❌ TradeLockerApiService: Token data is not a valid array:', tokenData);
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
   * 
   * Endpoint correcto: GET /api/v1/tradelocker/balance/:accountId?accNum=1
   */
  getAccountBalance(accountId: string, accountNumber: number): Observable<any> {
    return new Observable(observer => {
      this.getIdToken().then(idToken => {
        // Usar el endpoint correcto: /tradelocker/balance/:accountId?accNum=1
        this.backendApi.getTradeLockerBalance(accountId, accountNumber, idToken).then(response => {
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
   * 
   * IMPLEMENTA CACHÉ Y DEDUPLICACIÓN para evitar errores 429 (Too Many Requests)
   * 
   * Características:
   * - Caché en memoria con TTL de 5 minutos
   * - Deduplicación de peticiones simultáneas con las mismas credenciales
   * - shareReplay para reutilizar la misma petición entre múltiples suscriptores
   * - Limpieza automática de peticiones pendientes al completarse
   */
  getUserKey(email: string, password: string, server: string): Observable<string> {
    // Crear una clave única para estas credenciales (email + server)
    const cacheKey = `${email}:${server}`;
    
    // 1. Verificar si hay un token válido en caché
    const cached = this.tokenCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      console.log('🔑 TradeLockerApiService: Using cached token for', cacheKey);
      return of(cached.token);
    }
    
    // 2. Verificar si ya hay una petición en curso para estas credenciales
    const pendingRequest = this.pendingRequests.get(cacheKey);
    if (pendingRequest) {
      console.log('🔑 TradeLockerApiService: Reusing pending request for', cacheKey);
      return pendingRequest;
    }
    
    // 3. Limpiar tokens expirados del caché antes de hacer nueva petición
    this.cleanExpiredTokens();
    
    // 4. Crear nueva petición
    const credentials: TradeLockerCredentials = { email, password, server };
    const request$ = this.getJWTTokenStaging(credentials).pipe(
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
        
        const token = firstAccount.accessToken;
        
        // Guardar en caché con TTL de 5 minutos
        const expiresAt = Date.now() + this.TOKEN_CACHE_TTL;
        this.tokenCache.set(cacheKey, { token, expiresAt });
        console.log('🔑 TradeLockerApiService: Token cached for', cacheKey, 'expires at', new Date(expiresAt).toISOString());
        
        return token;
      }),
      catchError(error => {
        console.error('❌ TradeLockerApiService: Error in getUserKey:', error);
        // Limpiar la petición pendiente en caso de error
        this.pendingRequests.delete(cacheKey);
        return throwError(() => error);
      }),
      // Compartir la petición entre múltiples suscriptores (evita llamadas duplicadas)
      shareReplay(1),
      // Limpiar la petición pendiente cuando se complete (éxito o error)
      finalize(() => {
        this.pendingRequests.delete(cacheKey);
        console.log('🔑 TradeLockerApiService: Pending request cleared for', cacheKey);
      })
    );
    
    // Guardar la petición pendiente para reutilizarla si se llama de nuevo
    this.pendingRequests.set(cacheKey, request$);
    console.log('🔑 TradeLockerApiService: New request created for', cacheKey);
    
    return request$;
  }

  /**
   * Limpiar caché de tokens (útil para logout o cuando cambian las credenciales)
   */
  clearTokenCache(): void {
    console.log('🔑 TradeLockerApiService: Clearing token cache');
    this.tokenCache.clear();
    this.pendingRequests.clear();
  }

  /**
   * Limpiar tokens expirados del caché
   * Se llama automáticamente antes de hacer nuevas peticiones
   */
  private cleanExpiredTokens(): void {
    const now = Date.now();
    let cleanedCount = 0;
    for (const [key, value] of this.tokenCache.entries()) {
      if (value.expiresAt <= now) {
        this.tokenCache.delete(key);
        cleanedCount++;
      }
    }
    if (cleanedCount > 0) {
      console.log(`🔑 TradeLockerApiService: Cleaned ${cleanedCount} expired token(s) from cache`);
    }
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
