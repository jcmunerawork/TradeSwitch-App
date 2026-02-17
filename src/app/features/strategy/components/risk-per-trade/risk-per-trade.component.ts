import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit } from '@angular/core';
import {
  MaxDailyTradesConfig,
  RiskPerTradeConfig,
  RiskRewardConfig,
  RuleType,
} from '../../models/strategy.model';
import { Store } from '@ngrx/store';
import { SettingsService } from '../../service/strategy.service';
import { riskPerTrade, riskReward } from '../../store/strategy.selectors';
import {
  setRiskPerTradeConfig,
  setRiskRewardConfig,
} from '../../store/strategy.actions';
import { currencies } from './models/risk-per-trade.model';
import { AppContextService } from '../../../../shared/context';
import { AuthService } from '../../../auth/service/authService';
import { ReportService } from '../../../report/service/report.service';

/**
 * Component for configuring the maximum risk per trade rule.
 *
 * This component allows users to set the maximum amount of risk that can be
 * taken per trade. It supports multiple configuration options:
 * - Review type: MAX (maximum allowed) or FIXED (fixed amount)
 * - Number type: PERCENTAGE or MONEY
 * - Percentage type: INITIAL_B (initial balance), ACTUAL_B (actual balance), or NULL
 *
 * Features:
 * - Toggle rule active/inactive
 * - Currency selection dropdown
 * - Percentage or money amount input
 * - Real-time balance fetching from API
 * - Calculated amount display
 *
 * Relations:
 * - Store (NgRx): Reads and updates riskPerTrade configuration
 * - AppContextService: Gets report data and balance
 * - AuthService: Gets authentication tokens
 * - ReportService: Fetches account balance
 *
 * @component
 * @selector app-risk-per-trade
 * @standalone true
 */
@Component({
  selector: 'app-risk-per-trade',
  templateUrl: './risk-per-trade.component.html',
  styleUrls: ['./risk-per-trade.component.scss'],
  imports: [CommonModule],
  standalone: true,
})
export class RiskPerTradeComponent implements OnInit {
  config: RiskPerTradeConfig = {
    isActive: false,
    review_type: 'MAX',
    number_type: 'PERCENTAGE',
    percentage_type: 'NULL',
    risk_ammount: 0,
    type: RuleType.MAX_RISK_PER_TRADE,
    balance: 1,
    actualBalance: 0,
  };

  actualBalance: number = 0;
  calculatedAmount: number = 0;
  inputFirstRatioValue: number = 0;

  inputSecondRatioValue: number = 0;

  initialRiskTrade: number | undefined;

  selectedCurrency = currencies[0];

  dropdownOpen = false;

  currencies = currencies;

  constructor(
    private store: Store, 
    private settingsService: SettingsService, 
    private appContext: AppContextService,
    private authService: AuthService,
    private reportService: ReportService
  ) {}

  closeDropdown() {
    this.dropdownOpen = false;
  }

  async ngOnInit(): Promise<void> {
    this.listenRuleConfiguration();
    await this.loadData();
  }

  async loadData() {
    await this.loadActualBalance();
    this.calculatedAmount = await this.getCalculatedAmount();
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

  onChangePercentage(event: Event) {
    const percentage = Number((event.target as HTMLInputElement).value);
    
    // Obtener balance actual: PRIMERO desde Firebase (account.balance), luego contexto, luego reportData
    const userAccounts = this.appContext.userAccounts();
    const account = userAccounts && userAccounts.length > 0 ? userAccounts[0] : null;
    
    // Prioridad 1: account.balance de Firebase (balance actual guardado)
    if (account?.balance !== undefined && account.balance !== null && account.balance >= 0) {
      this.actualBalance = account.balance;
    } else {
      // Prioridad 2: contexto (balances en tiempo real)
      const accountBalances = this.appContext.accountBalances();
      const balanceFromContext = account ? 
        (accountBalances.get(account.accountID) || accountBalances.get(account.id)) : null;
      
      this.actualBalance = balanceFromContext !== undefined && balanceFromContext !== null ? 
        balanceFromContext : 
        (this.appContext.reportData()?.balanceData?.balance || 0);
    }
    
    const moneyRisk = Number(
      ((percentage / 100) * this.actualBalance).toFixed(2)
    );

    const newConfig: RiskPerTradeConfig = {
      ...this.config,
      risk_ammount: percentage,
      balance: -1,
      actualBalance: this.actualBalance,
    };
    this.updateConfig(newConfig);
  }

  async getCurrentBalance(): Promise<number> {
    if (this.config.percentage_type === 'ACTUAL_B') {
      // Usar el actualBalance guardado si está disponible, sino cargar
      if (this.config.actualBalance && this.config.actualBalance > 0) {
        return this.config.actualBalance;
      } else if (this.actualBalance === 0) {
        await this.loadActualBalance();
        return this.actualBalance;
      }
      return this.actualBalance;
    } else if (this.config.percentage_type === 'INITIAL_B') {
      return this.config.balance;
    }
    return 0;
  }

  // Método para cargar el balance actual desde Firebase/contexto o API
  async loadActualBalance() {
    try {
      // Obtener datos del usuario
      const currentUser = this.appContext.currentUser();
      if (!currentUser) {
        console.warn('No hay usuario autenticado');
        this.actualBalance = 0;
        return;
      }

      // Obtener las cuentas del usuario
      const userAccounts = this.appContext.userAccounts();
      if (!userAccounts || userAccounts.length === 0) {
        console.warn('No hay cuentas disponibles');
        this.actualBalance = 0;
        return;
      }

      const account = userAccounts[0];
      
      // 1. PRIMERO: Usar el balance desde Firebase (account.balance) - Este es el balance actual guardado
      if (account.balance !== undefined && account.balance !== null && account.balance >= 0) {
        this.actualBalance = account.balance;
        return;
      }
      
      // 2. SEGUNDO: Intentar obtener el balance desde el contexto (balances en tiempo real)
      const accountBalances = this.appContext.accountBalances();
      const balanceFromContext = accountBalances.get(account.accountID) || 
                                accountBalances.get(account.id);
      
      if (balanceFromContext !== undefined && balanceFromContext !== null && balanceFromContext > 0) {
        this.actualBalance = balanceFromContext;
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
        console.warn('⚠️ RiskPerTradeComponent: No se pudo obtener el balance');
      }
    } catch (error) {
      console.error('❌ RiskPerTradeComponent: Error loading actual balance:', error);
      this.actualBalance = 0;
    }
  }

  async getCalculatedAmount(): Promise<number> {
    const balance = await this.getCurrentBalance();
    return (this.config.risk_ammount / 100) * balance;
  }

  onChangeAmount(event: Event) {
    const moneyRisk = Number((event.target as HTMLInputElement).value);
    
    // Obtener balance actual: PRIMERO desde Firebase (account.balance), luego contexto, luego reportData
    const userAccounts = this.appContext.userAccounts();
    const account = userAccounts && userAccounts.length > 0 ? userAccounts[0] : null;
    
    // Prioridad 1: account.balance de Firebase (balance actual guardado)
    if (account?.balance !== undefined && account.balance !== null && account.balance >= 0) {
      this.actualBalance = account.balance;
    } else {
      // Prioridad 2: contexto (balances en tiempo real)
      const accountBalances = this.appContext.accountBalances();
      const balanceFromContext = account ? 
        (accountBalances.get(account.accountID) || accountBalances.get(account.id)) : null;
      
      this.actualBalance = balanceFromContext !== undefined && balanceFromContext !== null ? 
        balanceFromContext : 
        (this.appContext.reportData()?.balanceData?.balance || 0);
    }
    
    const percentage = Number(
      ((moneyRisk / this.actualBalance) * 100).toFixed(2)
    );

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
        if (!this.initialRiskTrade) {
          this.initialRiskTrade = config.risk_ammount;
        }
        
        // Si la regla está inactiva, resetear todos los valores
        if (!config.isActive) {
          this.actualBalance = 0;
          this.calculatedAmount = 0;
        } else {
          // Si está activa, cargar actualBalance si está disponible
          if (config.actualBalance && config.actualBalance > 0) {
            this.actualBalance = config.actualBalance;
          }
        }
      });
  }

  private updateConfig(config: RiskPerTradeConfig) {
    this.store.dispatch(setRiskPerTradeConfig({ config }));
  }
}
