import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, ViewChild, ElementRef, Input } from '@angular/core';
import { take } from 'rxjs/operators';
import {
  MaxDailyTradesConfig,
  RiskPerTradeConfig,
  RiskRewardConfig,
  RuleType,
} from '../../../models/strategy.model';
import { Store } from '@ngrx/store';
import { SettingsService } from '../../../service/strategy.service';
import { riskPerTrade, riskReward } from '../../../store/strategy.selectors';
import {
  setRiskPerTradeConfig,
  setRiskRewardConfig,
} from '../../../store/strategy.actions';
import { currencies } from './models/risk-per-trade.model';
import { ReportService } from '../../../../report/service/report.service';
import { AppContextService } from '../../../../../shared/context/context';
import { AuthService } from '../../../../auth/service/authService';
import { AccountData } from '../../../../auth/models/userModel';
import { NumberFormatterService } from '../../../../../shared/utils/number-formatter.service';

@Component({
  selector: 'app-edit-risk-per-trade',
  templateUrl: './edit-risk-per-trade.component.html',
  styleUrls: ['./edit-risk-per-trade.component.scss'],
  imports: [CommonModule],
  standalone: true,
})
export class EditRiskPerTradeComponent implements OnInit {
  @Input() userAccounts: AccountData[] = [];
  
  config: RiskPerTradeConfig = {
    isActive: false,
    review_type: 'MAX',
    number_type: 'PERCENTAGE',
    percentage_type: 'NULL',
    risk_ammount: 0,
    type: RuleType.MAX_RISK_PER_TRADE,
    balance: 0,
    actualBalance: 0,
  };

  // Nuevas propiedades para la lógica del componente
  selectedSizeType: 'max-size' | 'fixed' | null = null;
  selectedCalculationType: 'by percentage' | 'by price' | null = null;
  selectedBalanceType: 'by actual balance' | 'by initial balance' | null = null;
  
  // Valores del balance actual (se obtiene del servicio)
  actualBalance: number = 0;
  initialBalance: number = 0;
  // Balances por cuenta
  accountActualBalances: Record<string, number> = {};
  selectedAccount: AccountData | null = null;
  
  // Variables para el balance inicial
  initialBalanceValue: number = 0;
  displayInitialBalanceValue: string = '';
  isInitialBalanceEditing: boolean = true; // Iniciar en modo edición
  isInitialBalanceConfirmed: boolean = false;
  
  // Valores de entrada
  percentageValue: number = 0;
  priceValue: number = 0;
  
  // Valor mostrado en el input de precio (con formato)
  displayPriceValue: string = '';
  
  // Valor del input de precio sin formato (para edición)
  priceInputValue: string = '';
  
  // Propiedad para el precio formateado
  price: string = '';

  inputFirstRatioValue: number = 0;
  inputSecondRatioValue: number = 0;
  initialRiskTrade: number | undefined;
  selectedCurrency = currencies[0];
  dropdownOpen = false;
  currencies = currencies;

  // Estado de validación
  isValid: boolean = true;
  errorMessage: string = '';

  // Rastrear el estado inicial de Firebase
  private initialFirebaseState: boolean | null = null;
  
  // Control de peticiones para evitar llamadas infinitas
  private accountLoadAttempts: number = 0;
  private maxAccountLoadAttempts: number = 2;

  // Referencia al dropdown de cuenta
  @ViewChild('accountSelect') accountSelect?: ElementRef<HTMLSelectElement>;

  constructor(
    private store: Store, 
    private settingsService: SettingsService,
    private reportService: ReportService,
    private appContext: AppContextService,
    private authService: AuthService,
    private numberFormatter: NumberFormatterService
  ) {}

  closeDropdown() {
    this.dropdownOpen = false;
  }

  ngOnInit(): void {
    // Capturar el estado inicial ANTES de suscribirse al observable
    this.captureInitialFirebaseState();
    this.listenRuleConfiguration();
    
    // Inicializar cuentas si vienen como input
    this.initializeUserAccounts();
  }

  /**
   * Inicializar cuentas del usuario desde el input
   */
  private initializeUserAccounts(): void {
    if (this.userAccounts && this.userAccounts.length > 0) {
      // Las cuentas ya vienen cargadas desde el componente padre
    } else {
      // Si no hay cuentas, cargar desde el servicio (fallback)
      this.loadUserAccounts();
    }
  }


  /**
   * Capturar el estado inicial de Firebase desde el store actual
   * Esto evita que se capture múltiples veces durante las emisiones del observable
   */
  private captureInitialFirebaseState(): void {
    // Usar take(1) para obtener solo el primer valor y luego desuscribirse automáticamente
    this.store.select(riskPerTrade).pipe(take(1)).subscribe(config => {
      this.initialFirebaseState = config.isActive;
    });
  }

  toggleDropdown() {
    if (this.config.isActive) {
      this.dropdownOpen = !this.dropdownOpen;
    } else {
      this.dropdownOpen = false;
    }
  }

  selectCurrency(currency: { code: string; country: string }) {
    this.selectedCurrency = currency;
    this.dropdownOpen = false;
  }

  onToggleActive(event: Event) {
    const isActive = (event.target as HTMLInputElement).checked;
    
    if (!isActive) {
      // Si se desactiva, resetear todos los valores a 0
      const newConfig = {
        ...this.config,
        isActive: false,
        balance: 0,
        actualBalance: 0,
        risk_ammount: 0,
        review_type: 'MAX' as const,
        number_type: 'PERCENTAGE' as const,
        percentage_type: 'NULL' as const,
      };
      this.updateConfig(newConfig);
    } else {
      // Si se activa, mantener la configuración actual
      const newConfig = {
        ...this.config,
        isActive: true,
      };
      this.updateConfig(newConfig);
    }
  }

  // Nuevos métodos para manejar las opciones
  selectSizeType(type: 'max-size' | 'fixed') {
    this.selectedSizeType = type;
    this.selectedCalculationType = null;
    this.selectedBalanceType = null;
    this.saveConfiguration();
  }

  selectCalculationType(type: 'by percentage' | 'by price') {
    this.selectedCalculationType = type;
    
    // Resetear todos los campos relacionados cuando se cambia el tipo de cálculo
    this.selectedBalanceType = null;
    this.selectedAccount = null;
    this.percentageValue = 0;
    this.priceValue = 0;
    this.displayPriceValue = '';
    this.priceInputValue = '';
    this.initialBalance = 0;
    this.initialBalanceValue = 0;
    this.displayInitialBalanceValue = '';
    this.isInitialBalanceConfirmed = false;
    this.isInitialBalanceEditing = true;
    
    // Resetear el dropdown para mostrar el placeholder
    setTimeout(() => {
      if (this.accountSelect) {
        this.accountSelect.nativeElement.selectedIndex = 0; // Seleccionar la primera opción (placeholder)
      }
    }, 0);
    
    this.saveConfiguration();
  }

  selectBalanceType(type: 'by actual balance' | 'by initial balance') {
    this.selectedBalanceType = type;
    
    // Resetear cuenta seleccionada y valores cuando se cambia el tipo de balance
    this.selectedAccount = null;
    this.percentageValue = 0;
    this.priceValue = 0;
    this.displayPriceValue = '';
    this.priceInputValue = '';
    this.initialBalance = 0;
    this.initialBalanceValue = 0;
    this.displayInitialBalanceValue = '';
    this.isInitialBalanceConfirmed = false;
    this.isInitialBalanceEditing = true;
    
    // Resetear el dropdown para mostrar el placeholder
    setTimeout(() => {
      if (this.accountSelect) {
        this.accountSelect.nativeElement.selectedIndex = 0; // Seleccionar la primera opción (placeholder)
      }
    }, 0);
    
    // Solo cargar el balance actual cuando el usuario seleccione "by actual balance"
    if (type === 'by actual balance') {
      if (this.userAccounts.length > 0) {
        // Cargar balances directamente desde Firebase (account.balance) sin hacer peticiones a la API
        this.loadActualBalancesForAccounts();
      } else {
        this.loadUserAccounts().then(() => this.loadActualBalancesForAccounts());
      }
    } else {
      // by initial balance -> las cuentas ya están disponibles desde el input
      if (this.userAccounts.length === 0) {
        this.loadUserAccounts();
      }
    }
    
    this.saveConfiguration();
  }

  async loadUserAccounts() {
    try {
      // Preferir UID de Firebase
      const firebaseUser = this.authService.getAuth().currentUser;
      const userId = firebaseUser?.uid || this.appContext.currentUser()?.id;
      if (!userId) {
        this.userAccounts = [];
        return;
      }
      const accounts = await this.authService.getUserAccounts(userId);
      this.userAccounts = accounts || [];
      
      // Si hay cuentas, actualizar los balances desde el backend y guardarlos en Firebase
      if (this.userAccounts.length > 0 && firebaseUser) {
        await this.updateAccountBalancesFromBackend();
      }
    } catch (error) {
      console.error('Error loading user accounts:', error);
      this.userAccounts = [];
    }
  }

  /**
   * Actualizar balances de todas las cuentas desde el backend y guardarlos en Firebase
   */
  private async updateAccountBalancesFromBackend(): Promise<void> {
    try {
      const firebaseUser = this.authService.getAuth().currentUser;
      if (!firebaseUser) {
        return;
      }

      const idToken = await firebaseUser.getIdToken();
      
      // Actualizar balances para todas las cuentas en paralelo
      const balancePromises = this.userAccounts.map(async (account) => {
        try {
          if (!account.accountID || account.accountNumber === undefined) {
            return;
          }

          // Obtener balance desde el backend
          const balanceResponse = await this.reportService.getBalanceData(
            account.accountID,
            account.accountNumber
          ).toPromise();

          if (balanceResponse && balanceResponse.balance !== undefined) {
            const balance = balanceResponse.balance;
            
            // Actualizar en el contexto
            this.appContext.updateAccountBalance(account.accountID, balance);
            
            // Actualizar en Firebase
            const updatedAccount = {
              ...account,
              balance: balance
            };
            await this.authService.updateAccount(account.id, updatedAccount);
          }
        } catch (error) {
          console.error(`❌ EditRiskPerTradeComponent: Error actualizando balance para cuenta ${account.accountID}:`, error);
        }
      });

      await Promise.all(balancePromises);
    } catch (error) {
      console.error('❌ EditRiskPerTradeComponent: Error en updateAccountBalancesFromBackend:', error);
    }
  }

  async loadActualBalancesForAccounts() {
    try {
      const balances: Record<string, number> = {};
      
      for (const acc of this.userAccounts) {
        try {
          // 1. PRIMERO: Usar el balance desde Firebase (account.balance) - Este es el balance actual guardado
          if (acc.balance !== undefined && acc.balance !== null && acc.balance >= 0) {
            balances[acc.accountID] = acc.balance;
            continue;
          }
          
          // 2. SEGUNDO: Intentar obtener el balance desde el contexto (balances en tiempo real)
          const accountBalances = this.appContext.accountBalances();
          const balanceFromContext = accountBalances.get(acc.accountID) || 
                                    accountBalances.get(acc.id);
          
          if (balanceFromContext !== undefined && balanceFromContext !== null && balanceFromContext > 0) {
            balances[acc.accountID] = balanceFromContext;
            continue;
          }
          
          // 3. Fallback: Hacer petición a la API
          const data = await this.reportService
            .getBalanceData(acc.accountID, acc.accountNumber)
            .toPromise();
          
          if (data?.balance) {
            balances[acc.accountID] = data.balance;
          } else {
            balances[acc.accountID] = 0;
            console.warn(`⚠️ EditRiskPerTradeComponent: No se pudo obtener el balance para cuenta ${acc.accountID}`);
          }
        } catch (error) {
          console.error(`❌ EditRiskPerTradeComponent: Error cargando balance para cuenta ${acc.accountID}:`, error);
          balances[acc.accountID] = 0;
        }
      }
      this.accountActualBalances = balances;
    } catch (error) {
      console.error('❌ EditRiskPerTradeComponent: Error en loadActualBalancesForAccounts:', error);
      this.accountActualBalances = {};
    }
  }

  onSelectAccount(event: Event) {
    const accountID = (event.target as HTMLSelectElement).value;
    this.selectedAccount = this.userAccounts.find(a => a.accountID === accountID) || null;
    
    // Asegurar que se tengan los tipos necesarios para mostrar el input de porcentaje
    if (!this.selectedSizeType) {
      this.selectedSizeType = 'max-size'; // Valor por defecto
    }
    if (!this.selectedCalculationType) {
      this.selectedCalculationType = 'by percentage'; // Valor por defecto
    }
    
    // Ajustar balances visibles según selección
    if (this.selectedBalanceType === 'by initial balance') {
      this.initialBalance = this.selectedAccount?.initialBalance || 0;
      // Mostrar inmediatamente el balance inicial seleccionado en los resúmenes
      this.isInitialBalanceConfirmed = true;
      this.isInitialBalanceEditing = false;
    } else if (this.selectedBalanceType === 'by actual balance' && this.selectedAccount) {
      // PRIMERO: Usar el balance desde Firebase (account.balance) - Este es el balance actual guardado
      if (this.selectedAccount.balance !== undefined && this.selectedAccount.balance !== null && this.selectedAccount.balance >= 0) {
        this.actualBalance = this.selectedAccount.balance;
        // Actualizar también en accountActualBalances para consistencia
        this.accountActualBalances[this.selectedAccount.accountID] = this.selectedAccount.balance;
      } else {
        // SEGUNDO: Intentar obtener el balance desde contexto
        const accountBalances = this.appContext.accountBalances();
        const balanceFromContext = accountBalances.get(this.selectedAccount.accountID) || 
                                  accountBalances.get(this.selectedAccount.id);
        
        if (balanceFromContext !== undefined && balanceFromContext !== null && balanceFromContext > 0) {
          this.actualBalance = balanceFromContext;
          // Actualizar también en accountActualBalances para consistencia
          this.accountActualBalances[this.selectedAccount.accountID] = balanceFromContext;
        } else {
          // Usar el balance cargado previamente
          this.actualBalance = this.accountActualBalances[this.selectedAccount.accountID] || 0;
        }
      }
    }
    this.saveConfiguration();
  }

  onPercentageChange(event: Event) {
    this.percentageValue = Number((event.target as HTMLInputElement).value);
    this.saveConfiguration();
  }

  formatCurrency(event: any) {
    const input = event.target.value;
    const formatted = this.numberFormatter.formatInputValue(input);
    
    if (formatted === '') {
      this.price = '';
      this.priceValue = 0;
      this.displayPriceValue = '';
      return;
    }

    // Convertir a número
    const value = parseFloat(this.numberFormatter.cleanNumericInput(input));
    if (isNaN(value)) {
      this.price = '';
      this.priceValue = 0;
      this.displayPriceValue = '';
      return;
    }

    this.priceValue = value;
    this.price = formatted;
    this.displayPriceValue = this.price;
    this.saveConfiguration();
  }

  onPriceInput(event: Event) {
    const target = event.target as HTMLInputElement;
    this.priceInputValue = target.value;
  }

  onPriceFocus() {
    // Cuando el usuario hace focus, mostrar solo el número sin formato para edición
    if (this.priceValue > 0) {
      this.priceInputValue = this.priceValue.toString();
    }
  }

  onPriceBlur() {
    // Convertir el valor a número usando el servicio centralizado
    const numericValue = this.numberFormatter.parseCurrencyValue(this.priceInputValue);
    if (!isNaN(numericValue) && numericValue > 0) {
      // Guardar el valor sin formato
      this.priceValue = numericValue;
      
      // Mostrar formato visual (solo para display)
      this.displayPriceValue = this.numberFormatter.formatCurrencyDisplay(numericValue);
      
      // Actualizar el input para mostrar el formato visual
      this.priceInputValue = this.displayPriceValue;
      
      this.saveConfiguration();
    } else {
      // Si no es un número válido, limpiar
      this.priceInputValue = '';
      this.displayPriceValue = '';
      this.priceValue = 0;
    }
  }

  onBlur() {
    // Método legacy - mantener para compatibilidad
    this.onPriceBlur();
  }

  // Métodos para el balance inicial
  formatInitialBalance(event: any) {
    const input = event.target.value;
    const formatted = this.numberFormatter.formatInputValue(input);
    
    if (formatted === '') {
      this.initialBalanceValue = 0;
      this.displayInitialBalanceValue = '';
      return;
    }

    // Convertir a número
    const value = parseFloat(this.numberFormatter.cleanNumericInput(input));
    if (isNaN(value)) {
      this.initialBalanceValue = 0;
      this.displayInitialBalanceValue = '';
      return;
    }

    this.initialBalanceValue = value;
    this.displayInitialBalanceValue = formatted;
  }

  onInitialBalanceBlur() {
    if (!this.displayInitialBalanceValue) return;

    const num = this.numberFormatter.parseCurrencyValue(this.displayInitialBalanceValue);
    if (!isNaN(num)) {
      this.initialBalanceValue = num;
      this.displayInitialBalanceValue = this.numberFormatter.formatNumber(num, 2);
    }
  }

  clearInitialBalance() {
    this.initialBalanceValue = 0;
    this.displayInitialBalanceValue = '';
    this.initialBalance = 0;
    this.isInitialBalanceConfirmed = false;
    this.isInitialBalanceEditing = true; // Habilitar edición después de borrar
  }

  editInitialBalance() {
    this.isInitialBalanceEditing = true;
    this.isInitialBalanceConfirmed = false;
  }

  confirmInitialBalance() {
    this.initialBalance = this.initialBalanceValue;
    this.isInitialBalanceEditing = false;
    this.isInitialBalanceConfirmed = true;
    this.saveConfiguration();
  }

  // Método legacy para cargar un balance actual (se mantiene por compatibilidad, ahora usamos loadActualBalancesForAccounts)
  async loadActualBalance() {
    try {
      // Obtener las cuentas del usuario desde el contexto
      const userAccounts = this.appContext.userAccounts();
      if (!userAccounts || userAccounts.length === 0) {
        this.actualBalance = 0;
        return;
      }

      const account = userAccounts[0];
      
      // 1. Intentar obtener el balance desde el contexto (balances en tiempo real)
      const accountBalances = this.appContext.accountBalances();
      const balanceFromContext = accountBalances.get(account.accountID) || 
                                accountBalances.get(account.id);
      
      if (balanceFromContext !== undefined && balanceFromContext !== null && balanceFromContext > 0) {
        this.actualBalance = balanceFromContext;
        return;
      }
      
      // 2. Intentar obtener el balance desde Firebase (account.balance)
      if (account.balance !== undefined && account.balance !== null && account.balance > 0) {
        this.actualBalance = account.balance;
        return;
      }
      
      // 3. Fallback: Hacer petición a la API
      const balanceData = await this.reportService.getBalanceData(
        account.accountID,
        account.accountNumber
      ).toPromise();

      if (balanceData && balanceData.balance) {
        this.actualBalance = balanceData.balance;
        // Actualizar el contexto con los datos obtenidos
        this.appContext.updateReportBalance(balanceData);
      } else {
        this.actualBalance = 0;
        console.warn('⚠️ EditRiskPerTradeComponent: No se pudo obtener el balance');
      }
    } catch (error) {
      console.error('❌ EditRiskPerTradeComponent: Error loading actual balance:', error);
      this.actualBalance = 0;
    }
  }

  getCurrentBalance(): number {
    if (this.selectedBalanceType === 'by actual balance') {
      return this.actualBalance;
    } else if (this.selectedBalanceType === 'by initial balance') {
      return this.isInitialBalanceConfirmed ? this.initialBalance : 0;
    }
    return 0;
  }

  getCalculatedAmount(): number {
    const balance = this.getCurrentBalance();
    return (this.percentageValue / 100) * balance;
  }

  onChangePercentage(event: Event) {
    const percentage = Number((event.target as HTMLInputElement).value);
    const moneyRisk = Number(
      ((percentage / 100) * this.getCurrentBalance()).toFixed(2)
    );

    // Usar la misma lógica que saveConfiguration para determinar el balance
    let balanceToSave: number;
    let actualBalanceToSave: number | undefined;
    if (this.selectedCalculationType === 'by percentage' && this.selectedBalanceType === 'by initial balance') {
      balanceToSave = this.selectedAccount?.initialBalance || 0;
      actualBalanceToSave = 0;
    } else {
      balanceToSave = -1;
      actualBalanceToSave = this.actualBalance;
    }

    const newConfig: RiskPerTradeConfig = {
      ...this.config,
      risk_ammount: percentage,
      balance: balanceToSave,
      actualBalance: actualBalanceToSave,
    };
    this.updateConfig(newConfig);
  }

  onChangeAmount(event: Event) {
    const moneyRisk = Number((event.target as HTMLInputElement).value);
    const percentage = Number(
      ((moneyRisk / this.getCurrentBalance()) * 100).toFixed(2)
    );

    // Cuando es money, siempre guardar 0 en ambos
    const newConfig: RiskPerTradeConfig = {
      ...this.config,
      risk_ammount: moneyRisk,
      balance: 0,
      actualBalance: 0,
    };
    this.updateConfig(newConfig);
  }

  listenRuleConfiguration() {
    this.store
      .select(riskPerTrade)
      .pipe()
      .subscribe((config) => {
        this.config = config;
        
        // Resetear contador de intentos cuando se carga una nueva configuración
        this.accountLoadAttempts = 0;
        
        // El estado inicial ya fue capturado en ngOnInit, solo procesar la lógica
        
        if (config.isActive) {
          // Usar el estado inicial de Firebase para determinar el comportamiento
          if (this.initialFirebaseState === false) {
            // Regla vino inactiva de Firebase: SIEMPRE empezar desde cero, ignorar valores de config
            this.selectedSizeType = null;
            this.selectedCalculationType = null;
            this.selectedBalanceType = null;
            this.percentageValue = 0;
            this.priceValue = 0;
            this.displayPriceValue = '';
            this.priceInputValue = '';
            this.initialBalance = 0;
            this.initialBalanceValue = 0;
            this.displayInitialBalanceValue = '';
            this.isInitialBalanceConfirmed = false;
            this.isInitialBalanceEditing = true;
            this.selectedAccount = null;
            this.actualBalance = 0;
          } else {
            // Regla vino activa de Firebase: cargar valores desde config
            this.selectedSizeType = config.review_type === 'MAX' ? 'max-size' : 'fixed';
            this.selectedCalculationType = config.number_type === 'PERCENTAGE' ? 'by percentage' : 'by price';
            
            // Manejar el percentage_type correctamente
            if (config.percentage_type === 'NULL') {
              // Cuando es money, no hay balance type específico
              this.selectedBalanceType = null;
            } else {
              this.selectedBalanceType = config.percentage_type === 'ACTUAL_B' ? 'by actual balance' : 'by initial balance';
            }
            
            // Cargar el valor de riesgo
            if (config.risk_ammount) {
              if (config.number_type === 'PERCENTAGE') {
                this.percentageValue = config.risk_ammount;
              } else {
                this.priceValue = config.risk_ammount;
                this.price = config.risk_ammount.toLocaleString('en-US', {
                  style: 'currency',
                  currency: 'USD',
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                });
                this.displayPriceValue = this.price;
                this.priceInputValue = this.displayPriceValue;
              }
            }

            // Cargar balance y seleccionar cuenta según el tipo
            if (config.percentage_type === 'INITIAL_B' && config.balance && config.balance > 0) {
              // Configurar el tipo de balance y cálculo para balance inicial
              this.selectedBalanceType = 'by initial balance';
              this.selectedCalculationType = 'by percentage';
              
              // Cargar balance inicial y seleccionar la cuenta correspondiente
              this.initialBalance = config.balance;
              this.initialBalanceValue = config.balance;

              this.displayInitialBalanceValue = config.balance.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              });
              this.isInitialBalanceConfirmed = true;
              this.isInitialBalanceEditing = false;
              
              // Usar cuentas disponibles o cargarlas si es necesario
              if (this.userAccounts.length > 0) {
                
                // Buscar la cuenta que coincida con el balance inicial
                const matchingAccount = this.userAccounts.find((account) => {
                  // Asegurar que ambos valores sean números
                  const accountBalance = Number(account.initialBalance) || 0;
                  const configBalance = Number(config.balance) || 0;
                  const difference = Math.abs(accountBalance - configBalance);
                  return difference < 0.01; // Tolerancia para decimales
                });
                
                if (matchingAccount) {
                  this.selectedAccount = matchingAccount;
                  // Seleccionar en el dropdown
                  setTimeout(() => {
                    if (this.accountSelect) {
                      const selectElement = this.accountSelect.nativeElement;
                      const optionIndex = this.userAccounts.findIndex(account => 
                        account.accountID === matchingAccount.accountID
                      );
                      if (optionIndex !== -1) {
                        selectElement.selectedIndex = optionIndex + 1;
                      }
                    }
                  }, 100);
                } else {
                  this.selectedAccount = null;
                  this.isValid = false;
                  this.errorMessage = 'Please complete this rule. The saved balance does not match any available account.';
                }
              } else {
                // Controlar intentos de carga para evitar peticiones infinitas
                if (this.accountLoadAttempts < this.maxAccountLoadAttempts) {
                  this.accountLoadAttempts++;
                  this.loadUserAccounts().then(() => {
                    // Buscar la cuenta que coincida con el balance inicial
                    const matchingAccount = this.userAccounts.find((account) => {
                      // Asegurar que ambos valores sean números
                      const accountBalance = Number(account.initialBalance) || 0;
                      const configBalance = Number(config.balance) || 0;
                      const difference = Math.abs(accountBalance - configBalance);
                      return difference < 0.01; // Tolerancia para decimales
                    });
                    
                    if (matchingAccount) {
                      this.selectedAccount = matchingAccount;
                      // Seleccionar en el dropdown
                      setTimeout(() => {
                        if (this.accountSelect) {
                          const selectElement = this.accountSelect.nativeElement;
                          const optionIndex = this.userAccounts.findIndex(account => 
                            account.accountID === matchingAccount.accountID
                          );
                          if (optionIndex !== -1) {
                            selectElement.selectedIndex = optionIndex + 1; // +1 porque el primer option es el placeholder
                          }
                        }
                      }, 100);
                    } else {
                      this.selectedAccount = null;
                      this.isValid = false;
                      this.errorMessage = 'Please complete this rule. The saved balance does not match any available account.';
                    }
                  }).catch(() => {
                    // Si falla la carga, mostrar error
                    this.selectedAccount = null;
                    this.isValid = false;
                    this.errorMessage = 'Error loading accounts. Please try again.';
                  });
                } else {
                  // Máximo de intentos alcanzado, mostrar error
                  this.selectedAccount = null;
                  this.isValid = false;
                  this.errorMessage = 'Please complete this rule. The saved balance does not match any available account.';
                }
              }
              
            } else if (config.percentage_type === 'ACTUAL_B' && config.actualBalance.balance && config.actualBalance.balance > 0) {
              // Configurar el tipo de balance y cálculo para balance actual
              this.selectedBalanceType = 'by actual balance';
              this.selectedCalculationType = 'by percentage';
              
              // Cargar balance actual y seleccionar la cuenta correspondiente
              this.actualBalance = config.actualBalance.balance || 0;
              
              // Usar cuentas disponibles o cargarlas si es necesario
              if (this.userAccounts.length > 0) {
                this.loadActualBalancesForAccounts().then(() => {
                  // Buscar la cuenta que tenga el balance actual que coincida
                  const matchingAccount = this.userAccounts.find(account => {
                    // Asegurar que ambos valores sean números
                    const accountBalance = Number(this.accountActualBalances[account.accountID]) || 0;
                    const configBalance = Number(config.actualBalance.balance) || 0;
                    const difference = Math.abs(accountBalance - configBalance);
                    return difference < 0.01; // Tolerancia para decimales
                  });
                  
                  if (matchingAccount) {
                    this.selectedAccount = matchingAccount;
                    // Seleccionar en el dropdown
                    setTimeout(() => {
                      if (this.accountSelect) {
                        const selectElement = this.accountSelect.nativeElement;
                        const optionIndex = this.userAccounts.findIndex(account => 
                          account.accountID === matchingAccount.accountID
                        );
                        if (optionIndex !== -1) {
                          selectElement.selectedIndex = optionIndex + 1; // +1 porque el primer option es el placeholder
                        }
                      }
                    }, 100);
                  } else {
                    this.selectedAccount = null;
                    this.isValid = false;
                    this.errorMessage = 'Please complete this rule. The saved balance does not match any available account.';
                  }
                });
              } else {
                // Controlar intentos de carga para evitar peticiones infinitas
                if (this.accountLoadAttempts < this.maxAccountLoadAttempts) {
                  this.accountLoadAttempts++;
                  this.loadUserAccounts().then(() => {
                    this.loadActualBalancesForAccounts().then(() => {
                      // Buscar la cuenta que tenga el balance actual que coincida
                      const matchingAccount = this.userAccounts.find(account => {
                        // Asegurar que ambos valores sean números
                        const accountBalance = Number(this.accountActualBalances[account.accountID]) || 0;
                        const configBalance = Number(config.actualBalance.balance) || 0;
                        const difference = Math.abs(accountBalance - configBalance);
                        return difference < 0.01; // Tolerancia para decimales
                      });
                      
                      if (matchingAccount) {
                        this.selectedAccount = matchingAccount;
                        // Seleccionar en el dropdown
                        setTimeout(() => {
                          if (this.accountSelect) {
                            const selectElement = this.accountSelect.nativeElement;
                            const optionIndex = this.userAccounts.findIndex(account => 
                              account.accountID === matchingAccount.accountID
                            );
                            if (optionIndex !== -1) {
                              selectElement.selectedIndex = optionIndex + 1; // +1 porque el primer option es el placeholder
                            }
                          }
                        }, 100);
                      } else {
                        this.selectedAccount = null;
                        this.isValid = false;
                        this.errorMessage = 'Please complete this rule. The saved balance does not match any available account.';
                      }
                    }).catch(() => {
                      // Si falla la carga de balances, mostrar error
                      this.selectedAccount = null;
                      this.isValid = false;
                      this.errorMessage = 'Error loading account balances. Please try again.';
                    });
                  }).catch(() => {
                    // Si falla la carga de cuentas, mostrar error
                    this.selectedAccount = null;
                    this.isValid = false;
                    this.errorMessage = 'Error loading accounts. Please try again.';
                  });
                } else {
                  // Máximo de intentos alcanzado, mostrar error
                  this.selectedAccount = null;
                  this.isValid = false;
                  this.errorMessage = 'Please complete this rule. The saved balance does not match any available account.';
                }
              }
            }
          }
          
        } else {
          // Si la regla está desactivada, resetear UI a null
          this.selectedSizeType = null;
          this.selectedCalculationType = null;
          this.selectedBalanceType = null;
          this.percentageValue = 0;
          this.priceValue = 0;
          this.displayPriceValue = '';
          this.priceInputValue = '';
          this.initialBalance = 0;
          this.initialBalanceValue = 0;
          this.displayInitialBalanceValue = '';
          this.isInitialBalanceConfirmed = false;
          this.isInitialBalanceEditing = true;
          this.selectedAccount = null;
          this.actualBalance = 0;
        }
        
        // Validar la configuración después de actualizarla (solo si no hay selección automática pendiente)
        // La validación para casos con selección automática se maneja dentro de los setTimeout
        if (!config.isActive || 
            (config.percentage_type !== 'INITIAL_B' && config.percentage_type !== 'ACTUAL_B')) {
          this.validateConfig(this.config);
        }
      });
  }

  private updateConfig(config: RiskPerTradeConfig) {
    this.store.dispatch(setRiskPerTradeConfig({ config }));
    this.validateConfig(config);
  }

  private validateConfig(config: RiskPerTradeConfig) {
    if (!config.isActive) {
      this.isValid = true;
      this.errorMessage = '';
      return;
    }

    // Validar que se haya seleccionado un tipo de tamaño
    if (!this.selectedSizeType) {
      this.isValid = false;
      this.errorMessage = 'You must select a size type';
      return;
    }

    // Validar que se haya seleccionado un tipo de cálculo
    if (!this.selectedCalculationType) {
      this.isValid = false;
      this.errorMessage = 'You must select a calculation type';
      return;
    }

    // Validar según el tipo de cálculo seleccionado
    if (this.selectedCalculationType === 'by percentage') {
      // Validar que se haya seleccionado un tipo de balance
      if (!this.selectedBalanceType) {
        this.isValid = false;
        this.errorMessage = 'You must select a balance type';
        return;
      }

      // Validar que se haya seleccionado una cuenta
      if (!this.selectedAccount) {
        this.isValid = false;
        this.errorMessage = 'You must select an account';
        return;
      }

      // Validar que se haya ingresado un porcentaje válido
      if (!this.percentageValue || this.percentageValue <= 0) {
        this.isValid = false;
        this.errorMessage = 'You must enter a valid percentage value';
        return;
      }
    } else if (this.selectedCalculationType === 'by price') {
      // Validar que se haya ingresado un precio válido
      if (!this.priceValue || this.priceValue <= 0) {
        this.isValid = false;
        this.errorMessage = 'You must enter a valid price value';
        return;
      }
    }

    // Si llegamos aquí, la validación pasó
    this.isValid = true;
    this.errorMessage = '';
  }

  // Método público para verificar si la regla es válida
  public isRuleValid(): boolean {
    return this.isValid;
  }

  // Método público para obtener el mensaje de error
  public getErrorMessage(): string {
    return this.errorMessage;
  }

  // Método para guardar la configuración con la nueva estructura
  private saveConfiguration() {
    if (!this.selectedSizeType || !this.selectedCalculationType) {
      return; // No guardar si faltan selecciones básicas
    }
    
    // Para percentage, también necesitamos selectedBalanceType
    if (this.selectedCalculationType === 'by percentage' && !this.selectedBalanceType) {
      return;
    }

    // Determinar el balance a guardar según la lógica especificada
    let balanceToSave: number;
    let actualBalanceToSave: number | undefined;
    let percentageType: "INITIAL_B" | "ACTUAL_B" | "NULL";

    if (this.selectedCalculationType === 'by percentage') {
      // Cuando es percentage
      if (this.selectedBalanceType === 'by initial balance') {
        // percentage + initialBalance: guardar el balance en balance, actualBalance = 0
        balanceToSave = this.selectedAccount?.initialBalance || 0;
        actualBalanceToSave = 0;
        percentageType = 'INITIAL_B';
      } else {
        // percentage + actualBalance: guardar -1 en balance, valor en actualBalance
        balanceToSave = -1;
        actualBalanceToSave = this.actualBalance;
        percentageType = 'ACTUAL_B';
      }
    } else {
      // Cuando es money: guardar 0 en ambos
      balanceToSave = 0;
      actualBalanceToSave = 0;
      percentageType = 'NULL';
    }

    const newConfig: RiskPerTradeConfig = {
      ...this.config,
      review_type: this.selectedSizeType === 'max-size' ? 'MAX' : 'FIXED',
      number_type: this.selectedCalculationType === 'by percentage' ? 'PERCENTAGE' : 'MONEY',
      percentage_type: percentageType,
      risk_ammount: this.selectedCalculationType === 'by percentage' ? this.percentageValue : this.priceValue,
      balance: balanceToSave,
      actualBalance: actualBalanceToSave
    };

    this.updateConfig(newConfig);
  }
}
