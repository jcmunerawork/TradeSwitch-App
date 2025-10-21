import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface AlertConfig {
  title: string;
  message: string;
  buttonText?: string;
  type?: 'info' | 'warning' | 'error' | 'success';
}

@Injectable({
  providedIn: 'root'
})
export class AlertService {
  private alertSubject = new BehaviorSubject<{ visible: boolean; config: AlertConfig | null }>({
    visible: false,
    config: null
  });

  public alert$ = this.alertSubject.asObservable();

  showAlert(config: AlertConfig): void {
    this.alertSubject.next({
      visible: true,
      config: {
        title: config.title,
        message: config.message,
        buttonText: config.buttonText || 'OK',
        type: config.type || 'info'
      }
    });
  }

  hideAlert(): void {
    this.alertSubject.next({
      visible: false,
      config: null
    });
  }

  // Métodos de conveniencia
  showError(message: string, title: string = 'Error'): void {
    this.showAlert({
      title,
      message,
      type: 'error'
    });
  }

  showWarning(message: string, title: string = 'Warning'): void {
    this.showAlert({
      title,
      message,
      type: 'warning'
    });
  }

  showSuccess(message: string, title: string = 'Success'): void {
    this.showAlert({
      title,
      message,
      type: 'success'
    });
  }

  showInfo(message: string, title: string = 'Information'): void {
    this.showAlert({
      title,
      message,
      type: 'info'
    });
  }
}
