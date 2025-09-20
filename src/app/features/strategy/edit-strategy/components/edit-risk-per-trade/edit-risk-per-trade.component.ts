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
    maxRiskPercentage: 2,
    maxRiskPerTrade: 200,
    type: RuleType.RISK_REWARD_RATIO,
    balance: 0,
  };

  inputFirstRatioValue: number = 0;

  inputSecondRatioValue: number = 0;

  initialRiskTrade: number | undefined;

  selectedCurrency = currencies[0];

  dropdownOpen = false;

  currencies = currencies;

  constructor(private store: Store, private settingsService: SettingsService) {}

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

  onChangePercentage(event: Event) {
    const percentage = Number((event.target as HTMLInputElement).value);
    const moneyRisk = Number(
      ((percentage / 100) * this.config.balance).toFixed(2)
    );

    const newConfig: RiskPerTradeConfig = {
      ...this.config,
      maxRiskPercentage: percentage,
      maxRiskPerTrade: moneyRisk,
    };
    this.updateConfig(newConfig);
  }

  onChangeAmount(event: Event) {
    const moneyRisk = Number((event.target as HTMLInputElement).value);
    const percentage = Number(
      ((moneyRisk / this.config.balance) * 100).toFixed(2)
    );

    const newConfig: RiskPerTradeConfig = {
      ...this.config,
      maxRiskPercentage: percentage,
      maxRiskPerTrade: moneyRisk,
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
          this.initialRiskTrade = config.maxRiskPerTrade;
        }
      });
  }

  private updateConfig(config: RiskPerTradeConfig) {
    this.store.dispatch(setRiskPerTradeConfig({ config }));
  }
}
