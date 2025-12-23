import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { getFirestore, collection, doc, getDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit } from 'firebase/firestore';
import { isPlatformBrowser } from '@angular/common';
import { MonthlyReport } from '../../features/report/models/report.model';
import { newDataId } from '../../features/report/utils/firebase-data-utils';

/**
 * Service for managing monthly trading reports in Firebase.
 *
 * This service provides CRUD operations for monthly trading reports that
 * aggregate trading statistics by month. Reports are used for historical
 * analysis and performance tracking.
 *
 * Features:
 * - Update monthly report
 * - Get monthly report by ID
 * - Get all monthly reports
 * - Get monthly reports by user ID
 * - Get monthly report by user, month, and year
 * - Delete monthly report
 *
 * Report Structure:
 * - Stored in: `monthly_reports/{reportId}`
 * - Report ID format: Generated using `newDataId()` utility
 * - Contains: Monthly aggregated trading statistics
 *
 * Relations:
 * - Used by ReportService for saving monthly summaries
 * - Used by ReportComponent for historical data
 * - Uses `newDataId` utility for unique ID generation
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
  private db: ReturnType<typeof getFirestore> | null = null;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (this.isBrowser) {
      const { firebaseApp } = require('../../firebase/firebase.init.ts');
      this.db = getFirestore(firebaseApp);
    }
  }

  /**
   * Update monthly report
   */
  async updateMonthlyReport(monthlyReport: MonthlyReport): Promise<void> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return;
    }

    try {
      const id = newDataId(
        monthlyReport.id,
        monthlyReport.month,
        monthlyReport.year
      );

      await setDoc(doc(this.db, 'monthly_reports', id), monthlyReport);
    } catch (error) {
      console.error('Error updating monthly report:', error);
      throw error;
    }
  }

  /**
   * Get monthly report by ID
   */
  async getMonthlyReport(reportId: string): Promise<MonthlyReport | null> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return null;
    }

    try {
      const docRef = doc(this.db, 'monthly_reports', reportId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return docSnap.data() as MonthlyReport;
      }
      return null;
    } catch (error) {
      console.error('Error getting monthly report:', error);
      return null;
    }
  }

  /**
   * Get all monthly reports
   */
  async getAllMonthlyReports(): Promise<MonthlyReport[]> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return [];
    }

    try {
      const snapshot = await getDoc(doc(this.db, 'monthly_reports'));
      const reports: MonthlyReport[] = [];
      
      snapshot.data()?.['forEach']((doc: any) => {
        const data = doc.data() as MonthlyReport;
        (data as any).id = doc.id;
        reports.push(data);
      });
      
      return reports;
    } catch (error) {
      console.error('Error getting all monthly reports:', error);
      return [];
    }
  }

  /**
   * Get monthly reports by user ID
   */
  async getMonthlyReportsByUserId(userId: string): Promise<MonthlyReport[]> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return [];
    }

    try {
      const q = query(
        collection(this.db, 'monthly_reports'),
        where('userId', '==', userId),
        orderBy('year', 'desc'),
        orderBy('month', 'desc')
      );
      
      const snapshot = await getDoc(doc(this.db, 'monthly_reports'));
      const reports: MonthlyReport[] = [];
      
      snapshot.data()?.['forEach']((doc: any) => {
        const data = doc.data() as MonthlyReport;
        (data as any).id = doc.id;
        reports.push(data);
      });
      
      return reports;
    } catch (error) {
      console.error('Error getting monthly reports by user ID:', error);
      return [];
    }
  }

  /**
   * Get monthly report by user, month and year
   */
  async getMonthlyReportByUserMonthYear(userId: string, month: number, year: number): Promise<MonthlyReport | null> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return null;
    }

    try {
      const q = query(
        collection(this.db, 'monthly_reports'),
        where('userId', '==', userId),
        where('month', '==', month),
        where('year', '==', year),
        limit(1)
      );
      
      const snapshot = await getDoc(doc(this.db, 'monthly_reports'));
      
      if (snapshot.exists()) {
        const doc = snapshot.data()?.[0];
        const data = doc.data() as MonthlyReport;
        (data as any).id = doc.id;
        return data;
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
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return;
    }

    try {
      await deleteDoc(doc(this.db, 'monthly_reports', reportId));
    } catch (error) {
      console.error('Error deleting monthly report:', error);
      throw error;
    }
  }
}
