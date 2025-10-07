import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit } from '@angular/core';
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

@Component({
  selector: 'app-edit-risk-per-trade',
  templateUrl: './edit-risk-per-trade.component.html',
  styleUrls: ['./edit-risk-per-trade.component.scss'],
  imports: [CommonModule],
  standalone: true,
})
export class EditRiskPerTradeComponent implements OnInit {
  config: RiskPerTradeConfig = {
    isActive: false,
    review_type: 'MAX',
    number_type: 'PERCENTAGE',
    percentage_type: 'NULL',
    risk_ammount: 0,
    type: RuleType.MAX_RISK_PER_TRADE,
    balance: 0,
  };

  // Nuevas propiedades para la lógica del componente
  selectedSizeType: 'max-size' | 'fixed' | null = null;
  selectedCalculationType: 'by percentage' | 'by price' | null = null;
  selectedBalanceType: 'by actual balance' | 'by initial balance' | null = null;
  
  // Valores del balance actual (se obtiene del servicio)
  actualBalance: number = 0;
  initialBalance: number = 0;
  // Cuentas del usuario y balances por cuenta
  userAccounts: AccountData[] = [];
  accountActualBalances: Record<string, number> = {};
  selectedAccount: AccountData | null = null;
  
  // Variables para el balance inicial
  initialBalanceValue: number = 0;
  displayInitialBalanceValue: string = '';
  isInitialBalanceEditing: boolean = true; // Iniciar en modo edición
  isInitialBalanceConfirmed: boolean = false;
  
  // Valores de entrada
  percentageValue: number = 2;
  priceValue: number = 0;
  
  // Valor mostrado en el input de precio (con formato)
  displayPriceValue: string = '';
  
  // Propiedad para el precio formateado
  price: string = '';

  inputFirstRatioValue: number = 0;
  inputSecondRatioValue: number = 0;
  initialRiskTrade: number | undefined;
  selectedCurrency = currencies[0];
  dropdownOpen = false;
  currencies = currencies;

  constructor(
    private store: Store, 
    private settingsService: SettingsService,
    private reportService: ReportService,
    private appContext: AppContextService,
    private authService: AuthService
  ) {}

  closeDropdown() {
    this.dropdownOpen = false;
  }

  ngOnInit(): void {
    this.listenRuleConfiguration();
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
    const newConfig = {
      ...this.config,
      isActive: (event.target as HTMLInputElement).checked,
    };
    this.updateConfig(newConfig);
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
    this.selectedBalanceType = null;
    this.saveConfiguration();
  }

  selectBalanceType(type: 'by actual balance' | 'by initial balance') {
    this.selectedBalanceType = type;
    
    // Solo cargar el balance actual cuando el usuario seleccione "by actual balance"
    if (type === 'by actual balance') {
      this.loadUserAccounts().then(() => this.loadActualBalancesForAccounts());
    } else {
      // by initial balance -> solo necesitamos las cuentas desde Firebase
      this.loadUserAccounts();
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
    } catch {
      this.userAccounts = [];
    }
  }

  async loadActualBalancesForAccounts() {
    try {
      const balances: Record<string, number> = {};
      for (const acc of this.userAccounts) {
        try {
          // Obtener token de TradeLocker por cuenta (igual que en ReportService)
          const token = await this.reportService
            .getUserKey(acc.emailTradingAccount, acc.brokerPassword, acc.server)
            .toPromise();
          if (!token) {
            balances[acc.accountID] = 0;
            continue;
          }
          // Con ese token, obtener el balance de la cuenta
          const data = await this.reportService
            .getBalanceData(acc.accountID, token, acc.accountNumber)
            .toPromise();
          balances[acc.accountID] = data?.balance || 0;
        } catch {
          balances[acc.accountID] = 0;
        }
      }
      this.accountActualBalances = balances;
    } catch {
      this.accountActualBalances = {};
    }
  }

  onSelectAccount(event: Event) {
    const accountID = (event.target as HTMLSelectElement).value;
    this.selectedAccount = this.userAccounts.find(a => a.accountID === accountID) || null;
    // Ajustar balances visibles según selección
    if (this.selectedBalanceType === 'by initial balance') {
      this.initialBalance = this.selectedAccount?.initialBalance || 0;
    } else if (this.selectedBalanceType === 'by actual balance' && this.selectedAccount) {
      this.actualBalance = this.accountActualBalances[this.selectedAccount.accountID] || 0;
    }
    this.saveConfiguration();
  }

  onPercentageChange(event: Event) {
    this.percentageValue = Number((event.target as HTMLInputElement).value);
    this.saveConfiguration();
  }

  formatCurrency(event: any) {
    let input = event.target.value.replace(/[^0-9.]/g, '');

    if (input === '') {
      this.price = '';
      this.priceValue = 0;
      this.displayPriceValue = '';
      return;
    }

    // Evitar más de un punto decimal
    const parts = input.split('.');
    if (parts.length > 2) {
      input = parts[0] + '.' + parts[1];
    }

    // Convertir a número
    const value = parseFloat(input);
    if (isNaN(value)) {
      this.price = '';
      this.priceValue = 0;
      this.displayPriceValue = '';
      return;
    }

    this.priceValue = value;

    // Formatear con separadores de miles y decimales
    const formatted = value.toLocaleString('en-US', {
      minimumFractionDigits: parts[1] ? parts[1].length : 0,
      maximumFractionDigits: parts[1] ? parts[1].length : 2
    });

    this.price = formatted;
    this.displayPriceValue = this.price;
    this.saveConfiguration();
  }

  onBlur() {
    if (!this.price) return;

    const num = parseFloat(this.price.replace(/[^0-9.]/g, ''));
    if (!isNaN(num)) {
      this.priceValue = num;
      this.price = num.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
      this.displayPriceValue = this.price;
    }
  }

  // Métodos para el balance inicial
  formatInitialBalance(event: any) {
    let input = event.target.value.replace(/[^0-9.]/g, '');

    if (input === '') {
      this.initialBalanceValue = 0;
      this.displayInitialBalanceValue = '';
      return;
    }

    // Evitar más de un punto decimal
    const parts = input.split('.');
    if (parts.length > 2) {
      input = parts[0] + '.' + parts[1];
    }

    // Convertir a número
    const value = parseFloat(input);
    if (isNaN(value)) {
      this.initialBalanceValue = 0;
      this.displayInitialBalanceValue = '';
      return;
    }

    this.initialBalanceValue = value;

    // Formatear con separadores de miles y decimales
    const formatted = value.toLocaleString('en-US', {
      minimumFractionDigits: parts[1] ? parts[1].length : 0,
      maximumFractionDigits: parts[1] ? parts[1].length : 2
    });

    this.displayInitialBalanceValue = formatted;
  }

  onInitialBalanceBlur() {
    if (!this.displayInitialBalanceValue) return;

    const num = parseFloat(this.displayInitialBalanceValue.replace(/[^0-9.]/g, ''));
    if (!isNaN(num)) {
      this.initialBalanceValue = num;
      this.displayInitialBalanceValue = num.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
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
      // Obtener el usuario actual de Firebase directamente
      const currentUser = this.authService.getAuth().currentUser;
      if (!currentUser) {
        console.warn('No hay usuario autenticado en Firebase');
        this.actualBalance = 0;
        return;
      }

      // Obtener el token fresco
      const accessToken = await currentUser.getIdToken(true); // true = force refresh
      
      // Obtener las cuentas del usuario desde el contexto
      const userAccounts = this.appContext.userAccounts();
      if (!userAccounts || userAccounts.length === 0) {
        console.warn('No hay cuentas disponibles');
        this.actualBalance = 0;
        return;
      }

      const account = userAccounts[0];
      
      // Hacer la petición al servicio de reportes para obtener el balance
      const balanceData = await this.reportService.getBalanceData(
        account.accountID,
        accessToken,
        account.accountNumber
      ).toPromise();

      if (balanceData && balanceData.balance) {
        this.actualBalance = balanceData.balance;
        // Actualizar el contexto con los datos obtenidos
        this.appContext.updateReportBalance(balanceData);
      } else {
        this.actualBalance = 0;
      }
    } catch (error) {
      console.error('Error loading actual balance:', error);
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
    if (this.selectedCalculationType === 'by percentage' && this.selectedBalanceType === 'by initial balance') {
      balanceToSave = this.getCurrentBalance();
    } else {
      balanceToSave = -1;
    }

    const newConfig: RiskPerTradeConfig = {
      ...this.config,
      risk_ammount: percentage,
      balance: balanceToSave,
    };
    this.updateConfig(newConfig);
  }

  onChangeAmount(event: Event) {
    const moneyRisk = Number((event.target as HTMLInputElement).value);
    const percentage = Number(
      ((moneyRisk / this.getCurrentBalance()) * 100).toFixed(2)
    );

    // Cuando es money, siempre guardar -1
    const newConfig: RiskPerTradeConfig = {
      ...this.config,
      risk_ammount: moneyRisk,
      balance: -1,
    };
    this.updateConfig(newConfig);
  }

  listenRuleConfiguration() {
    this.store
      .select(riskPerTrade)
      .pipe()
      .subscribe((config) => {
        this.config = config;
        
        // SOLO cargar datos si la regla está activa Y tiene datos guardados
        if (config.isActive && config.review_type && config.number_type && config.percentage_type) {
          // Cargar datos existentes solo si están completos
          this.selectedSizeType = config.review_type === 'MAX' ? 'max-size' : 'fixed';
          this.selectedCalculationType = config.number_type === 'PERCENTAGE' ? 'by percentage' : 'by price';
          
          // Manejar el percentage_type correctamente
          if (config.percentage_type === 'NULL') {
            // Cuando es money, no hay balance type específico
            this.selectedBalanceType = null;
          } else {
            this.selectedBalanceType = config.percentage_type === 'ACTUAL_B' ? 'by actual balance' : 'by initial balance';
          }
          
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
            }
          }
          
          // Solo cargar balance inicial si está configurado y es INITIAL_B
          if (config.balance && config.balance > 0 && config.percentage_type === 'INITIAL_B') {
            this.initialBalance = config.balance;
            this.initialBalanceValue = config.balance;
            this.displayInitialBalanceValue = config.balance.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            });
            this.isInitialBalanceConfirmed = true;
            this.isInitialBalanceEditing = false;
          }
        } else {
          // Si no hay datos guardados, resetear a estado inicial
          this.selectedSizeType = null;
          this.selectedCalculationType = null;
          this.selectedBalanceType = null;
          this.percentageValue = 2;
          this.priceValue = 0;
          this.displayPriceValue = '';
          this.initialBalance = 0;
          this.initialBalanceValue = 0;
          this.displayInitialBalanceValue = '';
          this.isInitialBalanceConfirmed = false;
          this.isInitialBalanceEditing = true;
        }
      });
  }

  private updateConfig(config: RiskPerTradeConfig) {
    this.store.dispatch(setRiskPerTradeConfig({ config }));
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
    let percentageType: "INITIAL_B" | "ACTUAL_B" | "NULL";

    if (this.selectedCalculationType === 'by percentage') {
      // Cuando es percentage
      if (this.selectedBalanceType === 'by initial balance') {
        // percentage + initialBalance: guardar el balance real
        balanceToSave = this.getCurrentBalance();
        percentageType = 'INITIAL_B';
      } else {
        // percentage + actualBalance: guardar -1
        balanceToSave = -1;
        percentageType = 'ACTUAL_B';
      }
    } else {
      // Cuando es money: guardar -1 y percentage_type como 'NULL'
      balanceToSave = -1;
      percentageType = 'NULL';
    }

    const newConfig: RiskPerTradeConfig = {
      ...this.config,
      review_type: this.selectedSizeType === 'max-size' ? 'MAX' : 'FIXED',
      number_type: this.selectedCalculationType === 'by percentage' ? 'PERCENTAGE' : 'MONEY',
      percentage_type: percentageType,
      risk_ammount: this.selectedCalculationType === 'by percentage' ? this.percentageValue : this.priceValue,
      balance: balanceToSave
    };

    this.updateConfig(newConfig);
  }
}
