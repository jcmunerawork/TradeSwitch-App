import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-loading-popup',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="loading-overlay" *ngIf="visible">
      <div class="loading-box">
        <div class="spinner"></div>
        <p>Cargando configuración...</p>
      </div>
    </div>
  `,
  styles: [
    `
      .loading-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2000;
      }
      .loading-box {
        background: #23252b;
        padding: 24px 36px;
        border-radius: 12px;
        color: #fff;
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .spinner {
        border: 4px solid rgba(255, 255, 255, 0.2);
        border-top: 4px solid #c8fc00;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        animation: spin 1s linear infinite;
        margin-bottom: 12px;
      }
      @keyframes spin {
        0% {
          transform: rotate(0deg);
        }
        100% {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class LoadingPopupComponent {
  @Input() visible = false;
}
