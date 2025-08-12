import { MaxDailyTradesComponent } from './components/max-daily-trades/max-daily-trades.component';
import { RiskRewardComponent } from './components/risk-reward/risk-reward.component';
import { RiskPerTradeComponent } from './components/risk-per-trade/risk-per-trade.component';
import { DaysAllowedComponent } from './components/days-allowed/days-allowed.component';
import { HoursAllowedComponent } from './components/hours-allowed/hours-allowed.component';
import { AssetsAllowedComponent } from './components/assets-allowed/assets-allowed.component';
import { Store } from '@ngrx/store';
import { allRules } from './store/strategy.selectors';
import { StrategyState } from './models/strategy.model';
import { CommonModule } from '@angular/common';
import { resetConfig } from './store/strategy.actions';
import { EditPopupComponent } from '../../shared/pop-ups/edit-pop-up/edit-popup.component';
import { ConfirmPopupComponent } from '../../shared/pop-ups/confirm-pop-up/confirm-popup.component';
import { SettingsService } from './service/strategy.service';
import { LoadingPopupComponent } from '../../shared/pop-ups/loading-pop-up/loading-popup.component';
import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-strategy',
  imports: [
    CommonModule,
    MaxDailyTradesComponent,
    RiskRewardComponent,
    RiskPerTradeComponent,
    DaysAllowedComponent,
    HoursAllowedComponent,
    AssetsAllowedComponent,
    EditPopupComponent,
    ConfirmPopupComponent,
    LoadingPopupComponent,
  ],
  templateUrl: './strategy.component.html',
  styleUrl: './strategy.component.scss',
  standalone: true,
})
export class Strategy implements OnInit {
  config!: StrategyState;
  previousConfig: StrategyState | undefined;
  canEdit: boolean = false;
  editPopupVisible = false;
  confirmPopupVisible = false;
  loading = false;

  constructor(private store: Store, private strategySvc: SettingsService) {}

  ngOnInit(): void {
    this.loadConfig();
    this.listenConfigurations();
  }

  loadConfig() {
    this.loading = true;
    this.strategySvc
      .getStrategyConfig()
      .then((docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as StrategyState;
          this.store.dispatch(resetConfig({ config: data }));
          this.loading = false;
        } else {
          this.loading = false;

          console.warn('No config');
        }
      })
      .catch((err) => {
        this.loading = false;

        console.error('Error to get the config', err);
      });
  }

  listenConfigurations() {
    this.store
      .select(allRules)
      .pipe()
      .subscribe((config) => {
        this.config = { ...config };
        if (!this.previousConfig) {
          this.previousConfig = { ...config };
        }
      });
  }

  save = () => {
    this.loading = true;
    this.strategySvc
      .saveStrategyConfig(this.config)
      .then(() => {
        alert('Strategy Saved');
      })
      .catch((err) => {
        console.error('Save Error:', err);
        alert('Error Saving');
      })
      .finally(() => {
        this.loading = false;
        this.canEdit = false;
        this.closeConfirmModal();
      });
  };

  openEditPopup() {
    this.editPopupVisible = true;
  }

  closePopup = () => {
    this.editPopupVisible = false;
    this.canEdit = true;
  };

  openConfirmPopup() {
    this.confirmPopupVisible = true;
  }

  closeConfirmModal = () => {
    this.confirmPopupVisible = false;
  };

  resetValues() {
    if (this.previousConfig) {
      this.store.dispatch(resetConfig({ config: this.previousConfig }));
    }
  }
}
