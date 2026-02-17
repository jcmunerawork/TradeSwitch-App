import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MonthlyReport } from '../../features/report/models/report.model';
import { newDataId } from '../../features/report/utils/firebase-data-utils';
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
    if (!this.isBrowser) {
      console.warn('Not available in SSR');
      return;
    }

    try {
      const idToken = await this.getIdToken();
      await this.backendApi.createOrUpdateMonthlyReport(monthlyReport, idToken);
    } catch (error) {
      console.error('Error updating monthly report:', error);
      throw error;
    }
  }

  /**
   * Get monthly report by ID
   */
  async getMonthlyReport(reportId: string): Promise<MonthlyReport | null> {
    if (!this.isBrowser) {
      console.warn('Not available in SSR');
      return null;
    }

    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.getMonthlyReport(reportId, idToken);
      
      if (response.success && response.data?.report) {
        return response.data.report as MonthlyReport;
      }
      return null;
    } catch (error) {
      console.error('Error getting monthly report:', error);
      return null;
    }
  }

  /**
   * Get all monthly reports for the current user
   */
  async getAllMonthlyReports(): Promise<MonthlyReport[]> {
    if (!this.isBrowser) {
      console.warn('Not available in SSR');
      return [];
    }

    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.getMonthlyReports(idToken);
      
      if (response.success && response.data?.reports) {
        return response.data.reports as MonthlyReport[];
      }
      return [];
    } catch (error) {
      console.error('Error getting all monthly reports:', error);
      return [];
    }
  }

  /**
   * Get monthly reports by user ID
   * Note: The backend endpoint returns all reports for the current user (from token)
   */
  async getMonthlyReportsByUserId(userId: string): Promise<MonthlyReport[]> {
    if (!this.isBrowser) {
      console.warn('Not available in SSR');
      return [];
    }

    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.getMonthlyReports(idToken);
      
      if (response.success && response.data?.reports) {
        // Filter by userId if needed (backend should already filter by token user)
        const reports = response.data.reports as MonthlyReport[];
        return reports.filter(report => report.id && report.id.includes(userId) || true); // Backend already filters by user
      }
      return [];
    } catch (error) {
      console.error('Error getting monthly reports by user ID:', error);
      return [];
    }
  }

  /**
   * Get monthly report by user, month and year
   */
  async getMonthlyReportByUserMonthYear(userId: string, month: number, year: number): Promise<MonthlyReport | null> {
    if (!this.isBrowser) {
      console.warn('Not available in SSR');
      return null;
    }

    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.getMonthlyReportByUserMonthYear(userId, month, year, idToken);
      
      if (response.success && response.data?.report) {
        return response.data.report as MonthlyReport;
      }
      return null;
    } catch (error) {
      console.error('Error getting monthly report by user, month and year:', error);
      return null;
    }
  }

  /**
   * Delete monthly report
   */
  async deleteMonthlyReport(reportId: string): Promise<void> {
    if (!this.isBrowser) {
      console.warn('Not available in SSR');
      return;
    }

    try {
      const idToken = await this.getIdToken();
      await this.backendApi.deleteMonthlyReport(reportId, idToken);
    } catch (error) {
      console.error('Error deleting monthly report:', error);
      throw error;
    }
  }
}
