import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { FormsModule } from '@angular/forms';
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
    FormsModule,
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
  strategyId: string | null = null;
  
  // Mini card properties
  currentStrategyName: string = 'My Strategy';
  lastModifiedText: string = 'Never modified';
  isFavorited: boolean = false;
  isEditingName: boolean = false;
  editingStrategyName: string = '';

  constructor(
    private store: Store,
    private router: Router,
    private route: ActivatedRoute,
    private strategySvc: SettingsService,
    private reportSvc: ReportService
  ) {
    this.config$ = this.store.select(allRules);
  }

  ngOnInit() {
    this.getUserData();
    this.getActualBalance();
    this.listenConfigurations();
    this.getStrategyId();
  }

  getStrategyId() {
    this.route.queryParams.subscribe(params => {
      this.strategyId = params['strategyId'] || null;
      if (this.strategyId) {
        this.loadStrategyConfiguration();
      }
    });
  }

  async loadStrategyConfiguration() {
    if (!this.strategyId) return;
    
    try {
      const strategyData = await this.strategySvc.getStrategyView(this.strategyId);
      if (strategyData) {
        // Cargar la configuración de la estrategia específica
        this.store.dispatch(resetConfig({ config: strategyData.configuration }));
        
        // Actualizar datos de la mini card desde configuration-overview
        this.currentStrategyName = strategyData.overview.name;
        this.lastModifiedText = this.formatDate(strategyData.overview.updated_at.toDate());
        this.isFavorited = false; // TODO: Implementar favoritos en la base de datos
      }
    } catch (error) {
      console.error('Error loading strategy configuration:', error);
    }
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
      .getConfiguration(this.user?.id || '')
      .then((data) => {
        if (data) {
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
    if (this.config && this.myChoices && this.user?.id) {
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

      // Si hay strategyId, actualizar la estrategia existente
      if (this.strategyId) {
            this.strategySvc
              .updateStrategyView(this.strategyId, {
                configuration: newConfig
              })
          .then(() => {
            // Actualizar fecha de modificación en la mini card
            this.lastModifiedText = this.formatDate(new Date());
            alert('Strategy Updated');
            this.router.navigate(['/strategy']);
          })
          .catch((err) => {
            console.error('Update Error:', err);
            alert('Error Updating Strategy');
          })
          .finally(() => {
            this.loading = false;
            this.closeConfirmModal();
          });
      } else {
        // Si no hay strategyId, crear nueva estrategia
        this.strategySvc
          .createStrategyView(this.user.id, this.currentStrategyName, newConfig)
          .then((strategyId) => {
            alert('Strategy Created');
            this.router.navigate(['/strategy']);
          })
          .catch((err) => {
            console.error('Create Error:', err);
            alert('Error Creating Strategy');
          })
          .finally(() => {
            this.loading = false;
            this.closeConfirmModal();
          });
      }
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

  // Mini card methods
  startEditName() {
    this.isEditingName = true;
    this.editingStrategyName = this.currentStrategyName;
    // Focus on input after view update
    setTimeout(() => {
      const input = document.querySelector('.strategy-name-input') as HTMLInputElement;
      if (input) {
        input.focus();
        input.select();
      }
    }, 0);
  }

  async saveStrategyName() {
    if (!this.editingStrategyName.trim()) {
      this.cancelEditName();
      return;
    }

    if (this.editingStrategyName.trim() === this.currentStrategyName) {
      this.cancelEditName();
      return;
    }

    try {
      if (this.strategyId) {
        // Actualizar nombre en configuration-overview
        await this.strategySvc.updateConfigurationOverview(this.strategyId, { 
          name: this.editingStrategyName.trim() 
        });
        
        // Actualizar UI
        this.currentStrategyName = this.editingStrategyName.trim();
        this.lastModifiedText = this.formatDate(new Date());
      } else {
        // Si no hay strategyId, solo actualizar localmente
        this.currentStrategyName = this.editingStrategyName.trim();
        this.lastModifiedText = this.formatDate(new Date());
      }
      
      this.isEditingName = false;
    } catch (error) {
      console.error('Error updating strategy name:', error);
      alert('Error updating strategy name');
      this.cancelEditName();
    }
  }

  cancelEditName() {
    this.isEditingName = false;
    this.editingStrategyName = '';
  }

  toggleFavorite() {
    this.isFavorited = !this.isFavorited;
    // TODO: Implementar persistencia de favoritos en Firebase
    console.log('Strategy favorited:', this.isFavorited);
  }

  formatDate(date: Date): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    return `Last modified: ${month} ${day}, ${year}`;
  }

  discardChanges() {
    this.router.navigate(['/strategy']);
  }
}

