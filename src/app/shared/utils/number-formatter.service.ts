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

  /**
   * Formats input value during typing (removes non-numeric characters except decimal point)
   * @param input - The input string to clean
   * @returns Cleaned numeric string
   */
  cleanNumericInput(input: string): string {
    return input.replace(/[^0-9.]/g, '');
  }

  /**
   * Formats a number for input display with proper separators during typing
   * @param input - The input string
   * @returns Formatted string with separators
   */
  formatInputValue(input: string): string {
    if (input === '') {
      return '';
    }

    // Clean the input
    let cleaned = this.cleanNumericInput(input);

    // Avoid more than one decimal point
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = parts[0] + '.' + parts[1];
    }

    // Convert to number
    const value = parseFloat(cleaned);
    if (isNaN(value)) {
      return '';
    }

    // Format with separators and preserve decimal places
    return value.toLocaleString('en-US', {
      minimumFractionDigits: parts[1] ? parts[1].length : 0,
      maximumFractionDigits: parts[1] ? parts[1].length : 2
    });
  }

  /**
   * Formats a number as currency for display (on blur)
   * @param value - The number to format
   * @returns Formatted currency string with $ symbol
   */
  formatCurrencyDisplay(value: number | string | null | undefined): string {
    if (value === null || value === undefined || value === '') {
      return '';
    }

    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    
    if (isNaN(numValue) || numValue <= 0) {
      return '';
    }

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numValue);
  }

  /**
   * Parses a formatted currency string back to a number
   * @param formattedValue - The formatted currency string
   * @returns The numeric value
   */
  parseCurrencyValue(formattedValue: string): number {
    if (!formattedValue) return 0;
    
    const numericValue = parseFloat(formattedValue.replace(/[^0-9.-]/g, ''));
    return isNaN(numericValue) ? 0 : numericValue;
  }
}
