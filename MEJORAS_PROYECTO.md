# Mejoras y Mejores Prácticas para TradeSwitch-App

## 📋 Índice
1. [Arquitectura y Estructura](#arquitectura-y-estructura)
2. [HTTP y Comunicación con APIs](#http-y-comunicación-con-apis)
3. [Manejo de Errores](#manejo-de-errores)
4. [Componentes y Performance](#componentes-y-performance)
5. [TypeScript y Tipado](#typescript-y-tipado)
6. [Testing](#testing)
7. [Configuración y Variables de Entorno](#configuración-y-variables-de-entorno)
8. [Validaciones y Formularios](#validaciones-y-formularios)
9. [Organización de Código](#organización-de-código)
10. [RxJS y Observables](#rxjs-y-observables)
11. [Seguridad](#seguridad)
12. [Documentación](#documentación)

---

## 🏗️ Arquitectura y Estructura

### ❌ Problemas Actuales
- No existe carpeta `core/` para servicios singleton
- Servicios mezclados en `shared/services/` sin separación clara
- Falta patrón Repository para acceso a datos
- No hay base service para operaciones HTTP comunes

### ✅ Mejoras Recomendadas

#### 1. Crear estructura `core/`
```
src/app/
├── core/
│   ├── services/
│   │   ├── config.service.ts          # Configuración de app
│   │   ├── error-handler.service.ts   # Manejo global de errores
│   │   ├── logger.service.ts          # Logging centralizado
│   │   └── api.service.ts             # Base service para HTTP
│   ├── interceptors/
│   │   ├── auth.interceptor.ts        # Token injection
│   │   ├── error.interceptor.ts       # Error handling
│   │   ├── loading.interceptor.ts     # Loading states
│   │   └── cache.interceptor.ts       # HTTP caching
│   ├── guards/
│   │   └── (mover guards aquí)
│   └── models/
│       └── api-response.model.ts       # Modelos base
```

#### 2. Implementar Base Service/Repository Pattern
```typescript
// core/services/api.service.ts
@Injectable({ providedIn: 'root' })
export abstract class BaseApiService {
  protected abstract apiUrl: string;
  
  constructor(protected http: HttpClient) {}
  
  protected get<T>(endpoint: string, options?: any): Observable<T> {
    return this.http.get<T>(`${this.apiUrl}/${endpoint}`, options);
  }
  
  protected post<T>(endpoint: string, body: any, options?: any): Observable<T> {
    return this.http.post<T>(`${this.apiUrl}/${endpoint}`, body, options);
  }
  
  protected put<T>(endpoint: string, body: any, options?: any): Observable<T> {
    return this.http.put<T>(`${this.apiUrl}/${endpoint}`, body, options);
  }
  
  protected delete<T>(endpoint: string, options?: any): Observable<T> {
    return this.http.delete<T>(`${this.apiUrl}/${endpoint}`, options);
  }
}

// Uso en servicios específicos
@Injectable({ providedIn: 'root' })
export class UserRepository extends BaseApiService {
  protected apiUrl = '/api/users';
  
  getUsers(): Observable<User[]> {
    return this.get<User[]>('');
  }
  
  getUserById(id: string): Observable<User> {
    return this.get<User>(id);
  }
}
```

#### 3. Separar servicios por responsabilidad
- **Core services**: Config, Logger, ErrorHandler, BaseApi
- **Feature services**: Lógica de negocio específica
- **Repository services**: Acceso a datos (Firebase, APIs externas)

---

## 🌐 HTTP y Comunicación con APIs

### ❌ Problemas Actuales
- No hay interceptors HTTP configurados
- Manejo de errores HTTP disperso en cada servicio
- No hay manejo centralizado de tokens/auth
- No hay loading states globales para requests HTTP
- URLs hardcodeadas en servicios

### ✅ Mejoras Recomendadas

#### 1. Crear HTTP Interceptors

**Auth Interceptor** (para tokens):
```typescript
// core/interceptors/auth.interceptor.ts
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private authService: AuthService) {}
  
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = this.authService.getToken();
    
    if (token) {
      req = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
    }
    
    return next.handle(req);
  }
}
```

**Error Interceptor**:
```typescript
// core/interceptors/error.interceptor.ts
@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
  constructor(
    private errorHandler: ErrorHandlerService,
    private alertService: AlertService
  ) {}
  
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        const errorMessage = this.errorHandler.getErrorMessage(error);
        
        // Log error
        this.errorHandler.logError(error);
        
        // Show user-friendly message
        if (!req.url.includes('/silent')) {
          this.alertService.showError(errorMessage);
        }
        
        return throwError(() => error);
      })
    );
  }
}
```

**Loading Interceptor**:
```typescript
// core/interceptors/loading.interceptor.ts
@Injectable()
export class LoadingInterceptor implements HttpInterceptor {
  private activeRequests = 0;
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();
  
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Ignorar requests de cache o silent
    if (req.headers.has('X-Skip-Loading')) {
      return next.handle(req);
    }
    
    this.activeRequests++;
    this.loadingSubject.next(true);
    
    return next.handle(req).pipe(
      finalize(() => {
        this.activeRequests--;
        if (this.activeRequests === 0) {
          this.loadingSubject.next(false);
        }
      })
    );
  }
}
```

**Configurar en app.config.ts**:
```typescript
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { loadingInterceptor } from './core/interceptors/loading.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(
      withFetch(),
      withInterceptors([
        authInterceptor,
        errorInterceptor,
        loadingInterceptor
      ])
    ),
    // ... otros providers
  ],
};
```

#### 2. Centralizar URLs de API
```typescript
// core/constants/api.constants.ts
export const API_ENDPOINTS = {
  TRADE_LOCKER: {
    BASE: 'https://demo.tradelocker.com/backend-api',
    AUTH: '/auth/jwt/token',
    REFRESH: '/auth/jwt/refresh',
    ACCOUNT_STATE: (id: string) => `/trade/accounts/${id}/state`,
    ORDERS_HISTORY: (id: string) => `/trade/accounts/${id}/ordersHistory`,
  },
  FIREBASE: {
    USERS: '/users',
    ACCOUNTS: '/accounts',
    STRATEGIES: '/strategies',
  }
} as const;

// Uso en servicios
export class TradeLockerApiService {
  private readonly baseUrl = API_ENDPOINTS.TRADE_LOCKER.BASE;
  
  getAccountState(accountId: string) {
    const url = API_ENDPOINTS.TRADE_LOCKER.ACCOUNT_STATE(accountId);
    return this.http.get(`${this.baseUrl}${url}`);
  }
}
```

---

## ⚠️ Manejo de Errores

### ❌ Problemas Actuales
- Manejo de errores inconsistente
- No hay servicio centralizado de error handling
- Errores HTTP manejados manualmente en cada servicio
- No hay tipos de error específicos

### ✅ Mejoras Recomendadas

#### 1. Crear Error Handler Service
```typescript
// core/services/error-handler.service.ts
@Injectable({ providedIn: 'root' })
export class ErrorHandlerService {
  constructor(private logger: LoggerService) {}
  
  getErrorMessage(error: HttpErrorResponse | Error): string {
    if (error instanceof HttpErrorResponse) {
      return this.getHttpErrorMessage(error);
    }
    return error.message || 'An unexpected error occurred';
  }
  
  private getHttpErrorMessage(error: HttpErrorResponse): string {
    switch (error.status) {
      case 400:
        return 'Invalid request. Please check your input.';
      case 401:
        return 'Unauthorized. Please log in again.';
      case 403:
        return 'Access denied. You don\'t have permission.';
      case 404:
        return 'Resource not found.';
      case 500:
        return 'Server error. Please try again later.';
      case 0:
        return 'Network error. Please check your connection.';
      default:
        return error.error?.message || 'An error occurred';
    }
  }
  
  logError(error: Error | HttpErrorResponse, context?: string): void {
    const errorInfo = {
      message: error.message,
      stack: error instanceof Error ? error.stack : undefined,
      status: error instanceof HttpErrorResponse ? error.status : undefined,
      url: error instanceof HttpErrorResponse ? error.url : undefined,
      context,
      timestamp: new Date().toISOString()
    };
    
    this.logger.error('Error occurred', errorInfo);
    
    // Enviar a servicio de tracking (Sentry, etc.)
    // Sentry.captureException(error);
  }
}
```

#### 2. Crear Tipos de Error Específicos
```typescript
// core/models/errors.model.ts
export class AppError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public fields: string[]) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class NetworkError extends AppError {
  constructor(message: string = 'Network connection failed') {
    super(message, 'NETWORK_ERROR');
    this.name = 'NetworkError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 'AUTH_ERROR');
    this.name = 'AuthenticationError';
  }
}
```

#### 3. Global Error Handler
```typescript
// core/handlers/global-error.handler.ts
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  constructor(
    private errorHandler: ErrorHandlerService,
    private alertService: AlertService
  ) {}
  
  handleError(error: Error | HttpErrorResponse): void {
    this.errorHandler.logError(error);
    
    const message = this.errorHandler.getErrorMessage(error);
    this.alertService.showError(message);
  }
}

// En app.config.ts
import { ErrorHandler } from '@angular/core';

providers: [
  { provide: ErrorHandler, useClass: GlobalErrorHandler },
  // ...
]
```

---

## 🎨 Componentes y Performance

### ❌ Problemas Actuales
- Componentes muy grandes (strategy.component.ts tiene 1411 líneas)
- No se usa OnPush change detection
- Falta memoización de cálculos costosos
- No hay trackBy functions en *ngFor

### ✅ Mejoras Recomendadas

#### 1. Dividir Componentes Grandes
**Antes**: `strategy.component.ts` (1411 líneas)

**Después**: Dividir en componentes más pequeños:
```
strategy/
├── strategy.component.ts          # Container (100-200 líneas)
├── components/
│   ├── strategy-list/
│   ├── strategy-card/
│   ├── strategy-search/
│   ├── strategy-filters/
│   └── strategy-actions/
└── services/
    └── strategy-facade.service.ts  # Lógica de negocio
```

#### 2. Implementar OnPush Change Detection
```typescript
@Component({
  selector: 'app-strategy',
  changeDetection: ChangeDetectionStrategy.OnPush, // ✅ Agregar
  // ...
})
export class StrategyComponent {
  // Usar signals o observables con async pipe
  strategies$ = this.strategyService.getStrategies();
  
  // O usar signals
  strategies = signal<Strategy[]>([]);
}
```

#### 3. Usar trackBy en *ngFor
```typescript
// En componente
trackByStrategyId(index: number, strategy: Strategy): string {
  return strategy.id;
}

trackByAccountId(index: number, account: Account): string {
  return account.id;
}

// En template
<div *ngFor="let strategy of strategies; trackBy: trackByStrategyId">
```

#### 4. Memoización de Cálculos Costosos
```typescript
// Usar computed signals
totalPnL = computed(() => {
  return this.trades().reduce((sum, trade) => sum + trade.pnl, 0);
});

// O usar memoization con RxJS
totalPnL$ = this.trades$.pipe(
  map(trades => trades.reduce((sum, trade) => sum + trade.pnl, 0)),
  shareReplay(1)
);
```

#### 5. Lazy Loading de Componentes Pesados
```typescript
// Para modales o componentes que no siempre se muestran
@Component({
  selector: 'app-heavy-modal',
  standalone: true,
  // ...
})
export class HeavyModalComponent {}

// En componente padre
showModal = signal(false);

// En template
@if (showModal()) {
  <app-heavy-modal />
}
```

---

## 📝 TypeScript y Tipado

### ❌ Problemas Actuales
- Algunos servicios usan `any` implícitamente
- Falta tipado estricto en algunos lugares
- Interfaces y modelos dispersos

### ✅ Mejoras Recomendadas

#### 1. Crear Tipos Base Reutilizables
```typescript
// core/models/base.model.ts
export interface BaseEntity {
  id: string;
  createdAt: number;
  updatedAt: number;
}

export interface ApiResponse<T> {
  data: T;
  status: number;
  message?: string;
  errors?: string[];
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

#### 2. Usar Tipos Genéricos
```typescript
// En servicios
export class BaseRepository<T extends BaseEntity> {
  protected abstract collection: string;
  
  getAll(): Observable<T[]> { }
  getById(id: string): Observable<T> { }
  create(entity: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Observable<T> { }
  update(id: string, entity: Partial<T>): Observable<T> { }
  delete(id: string): Observable<void> { }
}
```

#### 3. Evitar `any`, usar `unknown`
```typescript
// ❌ Malo
function processData(data: any) { }

// ✅ Bueno
function processData(data: unknown) {
  if (isValidData(data)) {
    // TypeScript ahora sabe el tipo
  }
}

function isValidData(data: unknown): data is MyDataType {
  return typeof data === 'object' && data !== null && 'id' in data;
}
```

#### 4. Organizar Modelos por Feature
```
features/
├── strategy/
│   └── models/
│       ├── strategy.model.ts
│       └── strategy-rule.model.ts
├── report/
│   └── models/
│       └── report.model.ts
└── auth/
    └── models/
        └── user.model.ts
```

---

## 🧪 Testing

### ❌ Problemas Actuales
- Solo 5 archivos de test (.spec.ts)
- Cobertura de tests muy baja
- No hay tests de servicios
- No hay tests E2E

### ✅ Mejoras Recomendadas

#### 1. Estructura de Testing
```
src/app/
├── core/
│   └── services/
│       ├── api.service.ts
│       └── api.service.spec.ts
├── features/
│   └── strategy/
│       ├── strategy.component.ts
│       ├── strategy.component.spec.ts
│       └── services/
│           ├── strategy.service.ts
│           └── strategy.service.spec.ts
```

#### 2. Testing de Servicios
```typescript
// strategy.service.spec.ts
describe('StrategyService', () => {
  let service: StrategyService;
  let httpMock: HttpTestingController;
  
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [StrategyService]
    });
    service = TestBed.inject(StrategyService);
    httpMock = TestBed.inject(HttpTestingController);
  });
  
  it('should fetch strategies', () => {
    const mockStrategies: Strategy[] = [/* ... */];
    
    service.getStrategies().subscribe(strategies => {
      expect(strategies).toEqual(mockStrategies);
    });
    
    const req = httpMock.expectOne('/api/strategies');
    expect(req.request.method).toBe('GET');
    req.flush(mockStrategies);
  });
});
```

#### 3. Testing de Componentes
```typescript
// strategy.component.spec.ts
describe('StrategyComponent', () => {
  let component: StrategyComponent;
  let fixture: ComponentFixture<StrategyComponent>;
  
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StrategyComponent],
      providers: [
        { provide: StrategyService, useValue: mockStrategyService }
      ]
    }).compileComponents();
    
    fixture = TestBed.createComponent(StrategyComponent);
    component = fixture.componentInstance;
  });
  
  it('should create', () => {
    expect(component).toBeTruthy();
  });
  
  it('should load strategies on init', () => {
    component.ngOnInit();
    expect(component.strategies().length).toBeGreaterThan(0);
  });
});
```

#### 4. Configurar Cobertura
```json
// package.json
{
  "scripts": {
    "test:coverage": "ng test --code-coverage",
    "test:watch": "ng test --watch"
  }
}

// karma.conf.js
coverageReporter: {
  type: 'html',
  dir: require('path').join(__dirname, './coverage'),
  check: {
    global: {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80
    }
  }
}
```

---

## ⚙️ Configuración y Variables de Entorno

### ❌ Problemas Actuales
- Variables de entorno hardcodeadas en angular.json
- No hay servicio de configuración centralizado
- Configuración mezclada en diferentes lugares

### ✅ Mejoras Recomendadas

#### 1. Crear Config Service
```typescript
// core/services/config.service.ts
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';

export interface AppConfig {
  apiUrl: string;
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    // ...
  };
  features: {
    enableAnalytics: boolean;
    enableErrorTracking: boolean;
  };
}

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private config: AppConfig = {
    apiUrl: environment.apiUrl,
    firebase: {
      apiKey: environment.firebase.apiKey,
      authDomain: environment.firebase.authDomain,
      projectId: environment.firebase.projectId,
      // ...
    },
    features: {
      enableAnalytics: environment.production,
      enableErrorTracking: environment.production
    }
  };
  
  get apiUrl(): string {
    return this.config.apiUrl;
  }
  
  get firebaseConfig(): AppConfig['firebase'] {
    return this.config.firebase;
  }
  
  get isProduction(): boolean {
    return environment.production;
  }
}
```

#### 2. Estructura de Environments
```
src/
├── environments/
│   ├── environment.ts          # Development
│   ├── environment.prod.ts     # Production
│   └── environment.staging.ts  # Staging
```

```typescript
// environments/environment.ts
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
  firebase: {
    apiKey: process.env['FIREBASE_API_KEY'],
    authDomain: process.env['FIREBASE_AUTH_DOMAIN'],
    // ...
  }
};
```

---

## ✅ Validaciones y Formularios

### ❌ Problemas Actuales
- Validaciones básicas, no hay validators personalizados reutilizables
- Validaciones duplicadas en diferentes componentes

### ✅ Mejoras Recomendadas

#### 1. Crear Validators Personalizados
```typescript
// shared/validators/custom.validators.ts
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export class CustomValidators {
  static email(control: AbstractControl): ValidationErrors | null {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(control.value) ? null : { invalidEmail: true };
  }
  
  static passwordStrength(control: AbstractControl): ValidationErrors | null {
    const value = control.value;
    if (!value) return null;
    
    const hasUpperCase = /[A-Z]/.test(value);
    const hasLowerCase = /[a-z]/.test(value);
    const hasNumeric = /[0-9]/.test(value);
    const hasSpecialChar = /[!@#$%^&*]/.test(value);
    
    const valid = hasUpperCase && hasLowerCase && hasNumeric && hasSpecialChar && value.length >= 8;
    
    return valid ? null : { passwordStrength: true };
  }
  
  static matchFields(field1: string, field2: string): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const field1Value = control.get(field1)?.value;
      const field2Value = control.get(field2)?.value;
      
      return field1Value === field2Value ? null : { fieldsMismatch: true };
    };
  }
}
```

#### 2. Usar Validators en Formularios
```typescript
this.form = this.fb.group({
  email: ['', [Validators.required, CustomValidators.email]],
  password: ['', [Validators.required, CustomValidators.passwordStrength]],
  confirmPassword: ['', Validators.required]
}, {
  validators: CustomValidators.matchFields('password', 'confirmPassword')
});
```

---

## 📦 Organización de Código

### ❌ Problemas Actuales
- Falta barrel exports (index.ts) para facilitar imports
- Imports largos y repetitivos
- No hay estructura clara de utils

### ✅ Mejoras Recomendadas

#### 1. Crear Barrel Exports
```typescript
// shared/components/index.ts
export * from './text-input/text-input.component';
export * from './password-input/password-input.component';
export * from './strategy-card/strategy-card.component';
// ...

// Uso
import { TextInputComponent, PasswordInputComponent } from '@shared/components';
```

#### 2. Organizar Utils
```
shared/
├── utils/
│   ├── formatters/
│   │   ├── currency.formatter.ts
│   │   ├── number.formatter.ts
│   │   └── date.formatter.ts
│   ├── validators/
│   │   └── custom.validators.ts
│   ├── helpers/
│   │   ├── array.helpers.ts
│   │   ├── object.helpers.ts
│   │   └── string.helpers.ts
│   └── index.ts
```

#### 3. Path Aliases en tsconfig.json
```json
{
  "compilerOptions": {
    "paths": {
      "@core/*": ["src/app/core/*"],
      "@shared/*": ["src/app/shared/*"],
      "@features/*": ["src/app/features/*"],
      "@environments/*": ["src/environments/*"]
    }
  }
}

// Uso
import { ConfigService } from '@core/services/config.service';
import { CustomValidators } from '@shared/validators';
```

---

## 🔄 RxJS y Observables

### ❌ Problemas Actuales
- Posibles memory leaks por falta de unsubscribe
- No se usa async pipe consistentemente
- Falta manejo de errores en observables

### ✅ Mejoras Recomendadas

#### 1. Usar Async Pipe
```typescript
// ✅ Bueno
@Component({
  template: `
    <div *ngFor="let user of users$ | async">{{ user.name }}</div>
  `
})
export class Component {
  users$ = this.userService.getUsers();
}

// ❌ Evitar
users: User[] = [];
subscription = this.userService.getUsers().subscribe(users => {
  this.users = users;
});
```

#### 2. Unsubscribe Pattern
```typescript
// Opción 1: takeUntil
private destroy$ = new Subject<void>();

ngOnInit() {
  this.userService.getUsers()
    .pipe(takeUntil(this.destroy$))
    .subscribe();
}

ngOnDestroy() {
  this.destroy$.next();
  this.destroy$.complete();
}

// Opción 2: take(1) para one-time subscriptions
this.userService.getUser(id)
  .pipe(take(1))
  .subscribe();

// Opción 3: firstValueFrom o lastValueFrom
async loadUser() {
  const user = await firstValueFrom(this.userService.getUser(id));
}
```

#### 3. Manejo de Errores en Observables
```typescript
this.userService.getUsers().pipe(
  catchError(error => {
    this.errorHandler.handleError(error);
    return of([]); // Valor por defecto
  }),
  retry(3), // Reintentar 3 veces
  retryWhen(errors => 
    errors.pipe(
      delay(1000),
      take(3)
    )
  )
).subscribe();
```

---

## 🔒 Seguridad

### ❌ Problemas Actuales
- No hay sanitización explícita de inputs
- Falta validación de datos del servidor
- No hay rate limiting en front-end

### ✅ Mejoras Recomendadas

#### 1. Sanitizar Inputs
```typescript
import { DomSanitizer } from '@angular/platform-browser';

constructor(private sanitizer: DomSanitizer) {}

getSafeHtml(html: string) {
  return this.sanitizer.sanitize(SecurityContext.HTML, html);
}

getSafeUrl(url: string) {
  return this.sanitizer.sanitize(SecurityContext.URL, url);
}
```

#### 2. Validar Respuestas del Servidor
```typescript
// Usar type guards
function isValidUserResponse(data: unknown): data is User {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'email' in data &&
    typeof (data as any).email === 'string'
  );
}

this.http.get<User>('/api/user').pipe(
  map(response => {
    if (!isValidUserResponse(response)) {
      throw new ValidationError('Invalid user data received');
    }
    return response;
  })
).subscribe();
```

#### 3. Content Security Policy
```html
<!-- index.html -->
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; script-src 'self' 'unsafe-inline';">
```

---

## 📚 Documentación

### ✅ Mejoras Recomendadas

#### 1. README Mejorado
- Setup instructions
- Arquitectura del proyecto
- Convenciones de código
- Guía de contribución

#### 2. JSDoc en Funciones Complejas
```typescript
/**
 * Calcula el PnL total agrupando trades por posición.
 * 
 * @param trades - Array de trades a procesar
 * @param accountId - ID de la cuenta para filtrar
 * @returns Observable con el PnL total calculado
 * 
 * @example
 * ```typescript
 * calculateTotalPnL(trades, 'acc123').subscribe(pnl => {
 *   console.log('Total PnL:', pnl);
 * });
 * ```
 */
calculateTotalPnL(trades: Trade[], accountId: string): Observable<number> {
  // ...
}
```

#### 3. ADRs (Architecture Decision Records)
```
docs/
└── adr/
    ├── 001-use-ngrx-for-state-management.md
    ├── 002-implement-repository-pattern.md
    └── 003-use-standalone-components.md
```

---

## 🎯 Prioridades de Implementación

### 🔴 Alta Prioridad (Implementar primero)
1. ✅ Crear estructura `core/` y mover servicios singleton
2. ✅ Implementar HTTP Interceptors (auth, error, loading)
3. ✅ Crear Error Handler Service centralizado
4. ✅ Dividir componentes grandes (strategy.component.ts)
5. ✅ Implementar OnPush change detection
6. ✅ Crear Config Service para variables de entorno

### 🟡 Media Prioridad
7. ✅ Implementar Base Service/Repository pattern
8. ✅ Crear validators personalizados reutilizables
9. ✅ Agregar barrel exports (index.ts)
10. ✅ Mejorar manejo de RxJS (async pipe, unsubscribe)
11. ✅ Organizar modelos e interfaces

### 🟢 Baja Prioridad (Mejoras continuas)
12. ✅ Aumentar cobertura de tests
13. ✅ Implementar path aliases
14. ✅ Mejorar documentación
15. ✅ Optimizaciones de performance adicionales

---

## 📊 Resumen de Mejoras

| Categoría | Estado Actual | Mejora Propuesta | Impacto |
|-----------|--------------|------------------|---------|
| Arquitectura | ⚠️ Mezclada | ✅ Core/Shared/Features clara | Alto |
| HTTP | ❌ Sin interceptors | ✅ Interceptors completos | Alto |
| Errores | ⚠️ Disperso | ✅ Centralizado | Alto |
| Componentes | ⚠️ Muy grandes | ✅ Divididos y optimizados | Alto |
| Testing | ❌ Muy bajo | ✅ Cobertura 80%+ | Medio |
| Config | ⚠️ Hardcoded | ✅ Service centralizado | Medio |
| Validaciones | ⚠️ Básicas | ✅ Reutilizables | Medio |
| TypeScript | ✅ Bueno | ✅ Mejorar tipos | Bajo |

---

## 🚀 Próximos Pasos

1. Revisar este documento con el equipo
2. Priorizar mejoras según necesidades del negocio
3. Crear issues/tickets para cada mejora
4. Implementar mejoras de forma incremental
5. Documentar cambios y decisiones

---

**Nota**: Estas mejoras deben implementarse de forma incremental, priorizando las de alta prioridad que tienen mayor impacto en mantenibilidad y escalabilidad del proyecto.
