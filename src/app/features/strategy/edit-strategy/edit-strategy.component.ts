import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { allRules } from '../store/strategy.selectors';
import { StrategyState } from '../models/strategy.model';
import { resetConfig } from '../store/strategy.actions';
import { SettingsService } from '../service/strategy.service';
import { ReportService } from '../../report/service/report.service';
import { User } from '../../overview/models/overview';
import { selectUser } from '../../auth/store/user.selectios';
import { selectUserKey } from '../../report/store/report.selectors';
import { setUserKey } from '../../report/store/report.actions';
import { initialStrategyState } from '../store/strategy.reducer';
import { EditPopupComponent } from '../../../shared/pop-ups/edit-pop-up/edit-popup.component';
import { ConfirmPopupComponent } from '../../../shared/pop-ups/confirm-pop-up/confirm-popup.component';
import { LoadingPopupComponent } from '../../../shared/pop-ups/loading-pop-up/loading-popup.component';

// Importar componentes de reglas edit-*
import { EditMaxDailyTradesComponent } from './components/edit-max-daily-trades/edit-max-daily-trades.component';
import { EditRiskRewardComponent } from './components/edit-risk-reward/edit-risk-reward.component';
import { EditRiskPerTradeComponent } from './components/edit-risk-per-trade/edit-risk-per-trade.component';
import { EditDaysAllowedComponent } from './components/edit-days-allowed/edit-days-allowed.component';
import { EditAssetsAllowedComponent } from './components/edit-assets-allowed/edit-assets-allowed.component';
import { EditHoursAllowedComponent } from './components/edit-hours-allowed/edit-hours-allowed.component';

@Component({
  selector: 'app-edit-strategy',
  imports: [
    EditMaxDailyTradesComponent,
    EditRiskRewardComponent,
    EditRiskPerTradeComponent,
    EditDaysAllowedComponent,
    EditAssetsAllowedComponent,
    EditHoursAllowedComponent,
    EditPopupComponent,
    ConfirmPopupComponent,
    LoadingPopupComponent
  ],
  templateUrl: './edit-strategy.component.html',
  styleUrl: './edit-strategy.component.scss',
  standalone: true,
})
export class EditStrategyComponent implements OnInit {
  config$: Observable<StrategyState>;
  config: StrategyState | null = null;
  myChoices: StrategyState | null = null;
  loading = false;
  user: User | null = null;
  editPopupVisible = false;
  confirmPopupVisible = false;

  constructor(
    private store: Store,
    private router: Router,
    private strategySvc: SettingsService,
    private reportSvc: ReportService
  ) {
    this.config$ = this.store.select(allRules);
  }

  ngOnInit() {
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
        // Inicializar My Choices con las reglas activas actuales
        this.initializeMyChoices();
        // Escuchar cambios en el store
        this.listenToStoreChanges();
      });
  }

  initializeMyChoices() {
    if (this.config) {
      this.myChoices = {
        maxDailyTrades: { ...this.config.maxDailyTrades, isActive: this.config.maxDailyTrades.isActive },
        riskReward: { ...this.config.riskReward, isActive: this.config.riskReward.isActive },
        riskPerTrade: { ...this.config.riskPerTrade, isActive: this.config.riskPerTrade.isActive },
        daysAllowed: { ...this.config.daysAllowed, isActive: this.config.daysAllowed.isActive },
        assetsAllowed: { ...this.config.assetsAllowed, isActive: this.config.assetsAllowed.isActive },
        hoursAllowed: { ...this.config.hoursAllowed, isActive: this.config.hoursAllowed.isActive }
      };
    }
  }

  // Escuchar cambios en el store para detectar cuando se activan/desactivan reglas
  listenToStoreChanges() {
    this.config$.subscribe(config => {
      if (this.config && this.myChoices) {
        // Detectar cambios en las reglas activas
        this.updateMyChoicesFromConfig(config);
      }
    });
  }

  updateMyChoicesFromConfig(newConfig: StrategyState) {
    if (!this.myChoices) return;

    // Comparar con la configuración anterior para detectar cambios
    if (this.config) {
      // Si una regla se activó en Available Rules, moverla a My Choices
      if (!this.config.maxDailyTrades.isActive && newConfig.maxDailyTrades.isActive) {
        this.myChoices.maxDailyTrades = { ...newConfig.maxDailyTrades, isActive: true };
        // Desactivar la regla en la configuración principal para que no aparezca en Available Rules
        this.config.maxDailyTrades.isActive = false;
      }
      if (!this.config.riskReward.isActive && newConfig.riskReward.isActive) {
        this.myChoices.riskReward = { ...newConfig.riskReward, isActive: true };
        this.config.riskReward.isActive = false;
      }
      if (!this.config.riskPerTrade.isActive && newConfig.riskPerTrade.isActive) {
        this.myChoices.riskPerTrade = { ...newConfig.riskPerTrade, isActive: true };
        this.config.riskPerTrade.isActive = false;
      }
      if (!this.config.daysAllowed.isActive && newConfig.daysAllowed.isActive) {
        this.myChoices.daysAllowed = { ...newConfig.daysAllowed, isActive: true };
        this.config.daysAllowed.isActive = false;
      }
      if (!this.config.assetsAllowed.isActive && newConfig.assetsAllowed.isActive) {
        this.myChoices.assetsAllowed = { ...newConfig.assetsAllowed, isActive: true };
        this.config.assetsAllowed.isActive = false;
      }
      if (!this.config.hoursAllowed.isActive && newConfig.hoursAllowed.isActive) {
        this.myChoices.hoursAllowed = { ...newConfig.hoursAllowed, isActive: true };
        this.config.hoursAllowed.isActive = false;
      }
    }
  }

  saveStrategy() {
    this.confirmPopupVisible = true;
  }

  save = () => {
    if (this.config && this.myChoices) {
      this.loading = true;
      
      // Crear nueva configuración solo con las reglas de My Choices
      const newConfig: StrategyState = {
        maxDailyTrades: this.myChoices.maxDailyTrades,
        riskReward: this.myChoices.riskReward,
        riskPerTrade: this.myChoices.riskPerTrade,
        daysAllowed: this.myChoices.daysAllowed,
        assetsAllowed: this.myChoices.assetsAllowed,
        hoursAllowed: this.myChoices.hoursAllowed
      };

      // Guardar en el store
      this.store.dispatch(resetConfig({ config: newConfig }));

      // Guardar en Firebase
      this.strategySvc
        .saveStrategyConfig(this.user?.id, newConfig)
        .then(() => {
          alert('Strategy Saved');
          this.router.navigate(['/strategy']);
        })
        .catch((err) => {
          console.error('Save Error:', err);
          alert('Error Saving');
        })
        .finally(() => {
          this.loading = false;
          this.closeConfirmModal();
        });
    }
  };

  closePopup = () => {
    this.editPopupVisible = false;
  };

  openConfirmPopup() {
    this.confirmPopupVisible = true;
  }

  closeConfirmModal = () => {
    this.confirmPopupVisible = false;
  };

  discardChanges() {
    this.router.navigate(['/strategy']);
  }
}

