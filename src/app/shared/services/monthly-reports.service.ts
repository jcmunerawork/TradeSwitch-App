import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MonthlyReport } from '../../features/report/models/report.model';
import { BackendApiService } from '../../core/services/backend-api.service';
import { getAuth } from 'firebase/auth';

/**
 * Service for managing monthly trading reports via backend API.
 *
 * This service provides CRUD operations for monthly trading reports that
 * aggregate trading statistics by month. Reports are used for historical
 * analysis and performance tracking.
 *
 * All operations now go through the backend API, which handles Firebase persistence.
 *
 * Features:
 * - Update monthly report (via backend)
 * - Get monthly report by ID (via backend)
 * - Get all monthly reports for current user (via backend)
 * - Get monthly reports by user ID (via backend)
 * - Get monthly report by user, month, and year (via backend)
 * - Delete monthly report (via backend)
 *
 * Report Structure:
 * - Stored in: `monthly_reports/{reportId}` (managed by backend)
 * - Report ID format: Generated using `newDataId()` utility
 * - Contains: Monthly aggregated trading statistics
 *
 * Relations:
 * - Used by ReportService for saving monthly summaries
 * - Used by ReportComponent for historical data
 * - Uses `newDataId` utility for unique ID generation
 * - Uses BackendApiService for all Firebase operations
 *
 * @service
 * @injectable
 * @providedIn root
 */
@Injectable({
  providedIn: 'root'
})
export class MonthlyReportsService {
  private isBrowser: boolean;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private backendApi: BackendApiService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  /**
   * Get Firebase ID token for backend API calls
   */
  private async getIdToken(): Promise<string> {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('User not authenticated');
    }
    return await currentUser.getIdToken();
  }

  /**
   * Update monthly report (creates or updates via backend)
   */
  async updateMonthlyReport(monthlyReport: MonthlyReport): Promise<void> {
    if (!this.isBrowser) {// 
      return;
    }

    try {
      const idToken = await this.getIdToken();
      await this.backendApi.createOrUpdateMonthlyReport(monthlyReport, idToken);
    } catch (error) {// 
      throw error;
    }
  }

  /**
   * Get monthly report by ID
   */
  async getMonthlyReport(reportId: string): Promise<MonthlyReport | null> {
    if (!this.isBrowser) {// 
      return null;
    }

    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.getMonthlyReport(reportId, idToken);
      
      if (response.success && response.data?.report) {
        return response.data.report as MonthlyReport;
      }
      return null;
    } catch (error) {// 
      return null;
    }
  }

  /**
   * Get all monthly reports for the current user
   */
  async getAllMonthlyReports(): Promise<MonthlyReport[]> {
    if (!this.isBrowser) {// 
      return [];
    }

    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.getMonthlyReports(idToken);
      
      if (response.success && response.data?.reports) {
        return response.data.reports as MonthlyReport[];
      }
      return [];
    } catch (error) {// 
      return [];
    }
  }

  /**
   * Get monthly report by user, month and year
   */
  async getMonthlyReportByUserMonthYear(userId: string, month: number, year: number): Promise<MonthlyReport | null> {
    if (!this.isBrowser) {// 
      return null;
    }

    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.getMonthlyReportByUserMonthYear(userId, month, year, idToken);
      
      if (response.success && response.data?.report) {
        return response.data.report as MonthlyReport;
      }
      return null;
    } catch (error) {// 
      return null;
    }
  }

}
