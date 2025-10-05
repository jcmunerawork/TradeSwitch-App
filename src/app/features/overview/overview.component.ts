import { Store } from '@ngrx/store';
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { statCardComponent } from '../report/components/statCard/stat_card.component';
import { OverviewService } from './services/overview.service';
import { overviewSubscriptionData, User } from './models/overview';
import { LoadingPopupComponent } from '../../shared/pop-ups/loading-pop-up/loading-popup.component';
import { FormsModule } from '@angular/forms';
import { TradeSwitchTableComponent } from './components/tradeSwitch-table/tradeSwitchTable.component';
import { TopListComponent } from './components/top-list/top-list.component';
import { RouterLink } from '@angular/router';
import { AppContextService } from '../../shared/context';

@Component({
  selector: 'app-overview',
  imports: [
    CommonModule,
    statCardComponent,
    LoadingPopupComponent,
    FormsModule,
    TradeSwitchTableComponent,
    TopListComponent,
    RouterLink,
  ],
  templateUrl: './overview.component.html',
  styleUrl: './overview.component.scss',
  standalone: true,
})
export class Overview {
  topUsers: User[] = [];
  constructor(
    private store: Store, 
    private overviewSvc: OverviewService,
    private appContext: AppContextService
  ) {}

  loading = false;
  subscriptionsData: overviewSubscriptionData | null = null;
  usersData: User[] = [];
  newUsers = 0;

  ngOnInit(): void {
    this.subscribeToContextData();
    this.loadConfig();
  }

  private subscribeToContextData() {
    // Suscribirse a los datos de overview desde el contexto
    this.appContext.overviewData$.subscribe(data => {
      this.usersData = data.allUsers;
      // Convertir subscriptions a overviewSubscriptionData si es necesario
      this.subscriptionsData = data.subscriptions as any;
    });

    // Suscribirse a los estados de carga
    this.appContext.isLoading$.subscribe(loading => {
      this.loading = loading.overview;
    });
  }

  loadConfig() {
    this.loading = true;
    this.getOverviewSubscriptionData();
    this.getUsersData();
  }

  getUsersData() {
    this.overviewSvc
      .getUsersData()
      .then((docSnap) => {
        if (docSnap && !docSnap.empty && docSnap.docs.length > 0) {
          this.usersData = docSnap.docs
            .map((doc) => doc.data() as User)
            .filter((user) => !user.isAdmin);

          this.filterTop10Users();
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

  getOverviewSubscriptionData() {
    this.overviewSvc
      .getOverviewSubscriptionData()
      .then((docSnap) => {
        if (docSnap && !docSnap.empty && docSnap.docs.length > 0) {
          const data = docSnap.docs[0].data() as overviewSubscriptionData;
          if (docSnap.docs.length > 1) {
            this.newUsers =
              data.users -
              ((docSnap.docs[1].data() as overviewSubscriptionData).users || 0);
          }

          this.subscriptionsData = data;
        } else {
          console.warn('No config');
        }
      })
      .catch((err) => {
        this.loading = false;

        console.error('Error to get the config', err);
      });
  }

  filterTop10Users() {
    this.topUsers = this.usersData
      .filter((user) => user.profit > 0)
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 10);
  }
}
