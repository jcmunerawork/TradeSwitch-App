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
import { User } from '../overview/models/overview';
import { selectUser } from '../auth/store/user.selectios';
import { initialStrategyState } from './store/strategy.reducer';
import { OverviewService } from '../overview/services/overview.service';
import { ReportService } from '../report/service/report.service';
import { selectUserKey } from '../report/store/report.selectors';
import { setUserKey } from '../report/store/report.actions';

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

  user: User | null = null;

  constructor(
    private store: Store,
    private strategySvc: SettingsService,
    private reportSvc: ReportService
  ) {}

  ngOnInit(): void {
    this.getUserData();
    this.getActualBalance();
    this.listenConfigurations();
  }

  fetchUserKey() {
    this.reportSvc
      .getUserKey('crisdamencast@gmail.com', 'FP`{Nlq_T9', 'HEROFX')
      .subscribe({
        next: (key: string) => {
          this.store.dispatch(setUserKey({ userKey: key }));
        },
        error: (err) => {
          this.store.dispatch(setUserKey({ userKey: '' }));
        },
      });
  }

  getActualBalance() {
    this.store
      .select(selectUserKey)
      .pipe()
      .subscribe({
        next: (userKey) => {
          if (userKey === '') {
            this.fetchUserKey();
          } else {
            this.reportSvc.getBalanceData('1234211', userKey, 1).subscribe({
              next: (balance) => {
                this.loadConfig(balance);
              },
              error: (err) => {
                console.error('Error fetching balance data', err);
              },
            });
          }
        },
      });
  }

  getUserData() {
    this.store.select(selectUser).subscribe({
      next: (user) => {
        this.user = user.user;
      },
      error: (err) => {
        console.error('Error fetching user data', err);
      },
    });
  }

  loadConfig(balance: number) {
    this.loading = true;
    this.strategySvc
      .getStrategyConfig(this.user?.id)
      .then((docSnap) => {
        if (docSnap && docSnap['exists']()) {
          const data = docSnap['data']() as StrategyState;
          const riskPerTradeBalance = {
            ...data.riskPerTrade,
            balance: balance,
          };

          this.store.dispatch(
            resetConfig({
              config: { ...data, riskPerTrade: riskPerTradeBalance },
            })
          );
          this.loading = false;
        } else {
          this.store.dispatch(resetConfig({ config: initialStrategyState }));

          this.loading = false;

          console.warn('No config');
        }
      })
      .catch((err) => {
        this.store.dispatch(resetConfig({ config: initialStrategyState }));
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
          this.previousConfig = {
            ...config,
          };
        }
      });
  }

  save = () => {
    this.loading = true;
    this.strategySvc
      .saveStrategyConfig(this.user?.id, this.config)
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
