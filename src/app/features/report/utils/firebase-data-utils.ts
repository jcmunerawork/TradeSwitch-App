import { GroupedTrade, GroupedTradeFinal } from '../models/report.model';

/**
 * Gets the best trade (highest PnL) from an array of trades.
 *
 * Iterates through all trades and finds the one with the maximum PnL value.
 * Returns null if there are no trades or if all trades have undefined PnL.
 *
 * @param groupedTrades - Array of GroupedTradeFinal objects
 * @returns The highest PnL value rounded to nearest integer, or null if no valid trades
 */
export const getBestTrade = (groupedTrades: GroupedTradeFinal[]): number | null => {
  if (!groupedTrades || groupedTrades.length === 0) {
    return null;
  }

  const tradeWithMaxPnl = groupedTrades.reduce((maxTrade, currentTrade) => {
    if (currentTrade.pnl === undefined) return maxTrade;
    if (maxTrade.pnl === undefined || currentTrade.pnl > maxTrade.pnl) {
      return currentTrade;
    }
    return maxTrade;
  }, groupedTrades[0]);

  return Math.round(tradeWithMaxPnl.pnl ?? 0);
};

/**
 * Calculates the total amount spent on trades.
 *
 * Multiplies price by quantity for each trade and sums the results.
 * Used for calculating total investment or capital used in trading.
 *
 * @param groupedTrades - Array of GroupedTradeFinal objects
 * @returns Total spend amount rounded down to nearest integer
 */
export const getTotalSpend = (groupedTrades: GroupedTradeFinal[]): number | null => {
  const totalSpend = groupedTrades.reduce((total, trade) => {
    const price = Number(trade.price) || 0;
    const qty = Number(trade.qty) || 0;
    return total + (price * qty);
  }, 0);
  return Math.floor(totalSpend);
};

/**
 * Generates a unique ID for monthly report data.
 *
 * Creates an ID by combining a base ID with formatted month and year.
 * Format: "{baseId}-{MM}-{YYYY}"
 *
 * @param baseId - Base identifier (typically user ID or account ID)
 * @param month - Month number (1-12)
 * @param year - Year number (e.g., 2024)
 * @returns Formatted ID string
 */
export function newDataId(baseId: string, month: number, year: number): string {
  const monthFormatted = month.toString().padStart(2, '0');
  return `${baseId}-${monthFormatted}-${year}`;
}
