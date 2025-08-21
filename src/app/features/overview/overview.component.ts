import { Store } from '@ngrx/store';
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { statCardComponent } from '../report/components/statCard/stat_card.component';
import { OverviewService } from './services/overview.service';
import { overviewSubscriptionData, User } from './models/overview';
import { LoadingPopupComponent } from '../../shared/pop-ups/loading-pop-up/loading-popup.component';
import { FormsModule } from '@angular/forms';
import { TradeSwitchTableComponent } from './components/tradeSwitch-table/tradeSwitchTable.component';

@Component({
  selector: 'app-overview',
  imports: [
    CommonModule,
    statCardComponent,
    LoadingPopupComponent,
    FormsModule,
    TradeSwitchTableComponent,
  ],
  templateUrl: './overview.component.html',
  styleUrl: './overview.component.scss',
  standalone: true,
})
export class Overview {
  constructor(private store: Store, private overviewSvc: OverviewService) {}

  loading = false;
  subscriptionsData: overviewSubscriptionData | null = null;
  usersData: User[] = [];
  newUsers = 0;

  ngOnInit(): void {
    this.loadConfig();
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
          this.usersData = docSnap.docs.map((doc) => doc.data() as User);
          for (let index = 0; index < 100; index++) {
            this.usersData.push(this.usersData[0]);
          }
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
}
