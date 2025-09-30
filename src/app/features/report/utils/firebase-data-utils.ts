import { GroupedTrade, GroupedTradeFinal } from '../models/report.model';

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

export const getTotalSpend = (groupedTrades: GroupedTradeFinal[]): number | null => {
  const totalSpend = groupedTrades.reduce((total, trade) => {
    const price = Number(trade.price) || 0;
    const qty = Number(trade.qty) || 0;
    return total + (price * qty);
  }, 0);
  return Math.floor(totalSpend);
};

export function newDataId(baseId: string, month: number, year: number): string {
  const monthFormatted = month.toString().padStart(2, '0');
  return `${baseId}-${monthFormatted}-${year}`;
}
