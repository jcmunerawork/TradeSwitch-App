import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class NumberFormatterService {

  constructor() { }

  /**
   * Formats a number as currency with $ symbol and proper separators
   * @param value - The number to format
   * @param decimals - Number of decimal places (default: 2)
   * @returns Formatted currency string
   */
  formatCurrency(value: number | string | null | undefined): string {
    if (value === null || value === undefined || value === '') {
      return '$0.00';
    }

    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    
    if (isNaN(numValue)) {
      return '$0.00';
    }

    // Truncate to 2 decimal places
    const truncated = Math.floor(numValue * 100) / 100;
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(truncated);
  }

  /**
   * Formats a number as percentage with % symbol
   * @param value - The number to format
   * @param decimals - Number of decimal places (default: 2)
   * @returns Formatted percentage string
   */
  formatPercentage(value: number | string | null | undefined): string {
    if (value === null || value === undefined || value === '') {
      return '0.00%';
    }

    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    
    if (isNaN(numValue)) {
      return '0.00%';
    }

    // Truncate to 2 decimal places
    const truncated = Math.floor(numValue * 100) / 100;
    
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(truncated / 100);
  }

  /**
   * Formats a number with proper separators and 2 decimal places
   * @param value - The number to format
   * @param decimals - Number of decimal places (default: 2)
   * @returns Formatted number string
   */
  formatNumber(value: number | string | null | undefined, decimals: number = 2): string {
    if (value === null || value === undefined || value === '') {
      return '0.00';
    }

    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    
    if (isNaN(numValue)) {
      return '0.00';
    }

    // Truncate to specified decimal places
    const truncated = Math.floor(numValue * Math.pow(10, decimals)) / Math.pow(10, decimals);
    
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(truncated);
  }

  /**
   * Formats a number as currency without the $ symbol (for display purposes)
   * @param value - The number to format
   * @returns Formatted number string with separators
   */
  formatCurrencyValue(value: number | string | null | undefined): string {
    if (value === null || value === undefined || value === '') {
      return '0.00';
    }

    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    
    if (isNaN(numValue)) {
      return '0.00';
    }

    // Truncate to 2 decimal places
    const truncated = Math.floor(numValue * 100) / 100;
    
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(truncated);
  }

  /**
   * Formats a number as percentage without the % symbol (for display purposes)
   * @param value - The number to format
   * @returns Formatted percentage value string
   */
  formatPercentageValue(value: number | string | null | undefined): string {
    if (value === null || value === undefined || value === '') {
      return '0.00';
    }

    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    
    if (isNaN(numValue)) {
      return '0.00';
    }

    // Truncate to 2 decimal places
    const truncated = Math.floor(numValue * 100) / 100;
    
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(truncated);
  }

  /**
   * Formats a number as an integer (no decimal places) with proper separators
   * @param value - The number to format
   * @returns Formatted integer string
   */
  formatInteger(value: number | string | null | undefined): string {
    if (value === null || value === undefined || value === '') {
      return '0';
    }

    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    
    if (isNaN(numValue)) {
      return '0';
    }

    // Round to nearest integer
    const rounded = Math.round(numValue);
    
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(rounded);
  }
}
