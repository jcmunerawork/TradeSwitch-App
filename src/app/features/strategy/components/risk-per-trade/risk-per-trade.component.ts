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
    this.actualBalance = this.appContext.reportData()?.balanceData?.balance || 0;
    const moneyRisk = Number(
      ((percentage / 100) * this.actualBalance).toFixed(2)
    );

    const newConfig: RiskPerTradeConfig = {
      ...this.config,
      risk_ammount: percentage,
      balance: this.actualBalance,
    };
    this.updateConfig(newConfig);
  }

  async getCurrentBalance(): Promise<number> {
    if (this.config.percentage_type === 'ACTUAL_B') {
      // Si no tenemos el balance cargado, hacer la petición
      if (this.actualBalance === 0) {
        await this.loadActualBalance();
      }
      return this.actualBalance;
    } else if (this.config.percentage_type === 'INITIAL_B') {
      return this.config.balance;
    }
    return 0;
  }

  // Método para cargar el balance actual desde el servicio
  async loadActualBalance() {
    try {
      // Obtener datos del usuario para hacer la petición
      const currentUser = this.appContext.currentUser();
      if (!currentUser) {
        console.warn('No hay usuario autenticado');
        this.actualBalance = 0;
        return;
      }

      // Obtener la primera cuenta del usuario
      const userAccounts = this.appContext.userAccounts();
      if (!userAccounts || userAccounts.length === 0) {
        console.warn('No hay cuentas disponibles');
        this.actualBalance = 0;
        return;
      }

      const account = userAccounts[0];
      const accessToken = await this.authService.getBearerTokenFirebase(currentUser.id);
      
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

  async getCalculatedAmount(): Promise<number> {
    const balance = await this.getCurrentBalance();
    return (this.config.risk_ammount / 100) * balance;
  }

  onChangeAmount(event: Event) {
    const moneyRisk = Number((event.target as HTMLInputElement).value);
    this.actualBalance = this.appContext.reportData()?.balanceData?.balance || 0;
    const percentage = Number(
      ((moneyRisk / this.actualBalance) * 100).toFixed(2)
    );

    const newConfig: RiskPerTradeConfig = {
      ...this.config,
      risk_ammount: moneyRisk,
      balance: this.actualBalance,
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
      });
  }

  private updateConfig(config: RiskPerTradeConfig) {
    this.store.dispatch(setRiskPerTradeConfig({ config }));
  }
}
