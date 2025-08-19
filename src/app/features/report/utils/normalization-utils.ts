import { GroupedTrade, historyTrade } from '../models/report.model';

export function arrayToHistoryTrade(arr: any[]): historyTrade {
  const sell_price = arr[8];
  const buy_price = arr[8];
  return {
    id: arr[0],
    userId: arr[1],
    accountId: arr[2],
    quantity: arr[3],
    side: arr[4],
    type_of_order: arr[5],
    status: arr[6],
    lots: arr[7],
    price: arr[4] === 'buy' ? { sell_price } : { buy_price },
    execution_price: arr[9],
    isCloseAction: arr[15] === 'true',
    updatedAt: arr[14],
    position_Id: arr[16],
  };
}

export function groupOrdersByPosition(orders: historyTrade[]): GroupedTrade[] {
  const grouped: { [positionId: string]: GroupedTrade } = {};

  orders.forEach((order) => {
    const posId = order.position_Id;
    if (!grouped[posId]) {
      grouped[posId] = {
        position_Id: posId,
        quantity: parseFloat(order.quantity),
        updatedAt: order.updatedAt,
      };
    }
    if (order.side === 'buy') {
      grouped[posId].sell_price =
        order.price.buy_price || order.execution_price;
    } else if (order.side === 'sell') {
      grouped[posId].buy_price =
        order.price.sell_price || order.execution_price;
    }
  });

  Object.values(grouped).forEach((trade) => {
    trade.pnl = calculatePnLByTrade(
      trade.buy_price,
      trade.sell_price,
      trade.quantity
    );
  });

  return Object.values(grouped);
}

function calculatePnLByTrade(
  buyPriceStr?: string,
  sellPriceStr?: string,
  quantity: number = 1
): number | undefined {
  if (!buyPriceStr || !sellPriceStr) {
    return undefined;
  }

  const buyPrice = parseFloat(buyPriceStr);
  const sellPrice = parseFloat(sellPriceStr);

  if (isNaN(buyPrice) || isNaN(sellPrice)) {
    return undefined;
  }

  return (sellPrice - buyPrice) * quantity;
}

export function calculateNetPnl(trades: { pnl?: number }[]): number {
  const total = trades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
  return Math.round(total);
}

export function calculateTradeWinPercent(trades: { pnl?: number }[]): number {
  const wins = trades.filter((t) => t.pnl !== undefined && t.pnl > 0).length;
  return trades.length > 0 ? Math.round((wins / trades.length) * 100) : 0;
}

export function calculateProfitFactor(trades: { pnl?: number }[]): number {
  const grossProfit = trades
    .filter((t) => (t.pnl ?? 0) > 0)
    .reduce((sum, t) => sum + t.pnl!, 0);
  const grossLoss = trades
    .filter((t) => (t.pnl ?? 0) < 0)
    .reduce((sum, t) => sum + Math.abs(t.pnl!), 0);
  if (grossLoss > 0) return Math.round((grossProfit / grossLoss) * 100) / 100;
  else if (grossProfit > 0) return Infinity;
  else return 0;
}

export function calculateAvgWinLossTrades(trades: { pnl?: number }[]): number {
  const wins = trades.filter((t) => t.pnl !== undefined && t.pnl > 0);
  const losses = trades.filter((t) => t.pnl !== undefined && t.pnl < 0);

  if (losses.length === 0) return 0;

  const grossProfit = wins.reduce((sum, t) => sum + t.pnl!, 0);
  const grossLoss = losses.reduce((sum, t) => sum + Math.abs(t.pnl!), 0);

  const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
  const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;

  return avgLoss > 0 ? Math.round((avgWin / avgLoss) * 100) / 100 : 0;
}

export function calculateTotalTrades(trades: any[]): number {
  return trades.length;
}

export function getMonthlyPnL(trades: GroupedTrade[]): {
  [month: string]: number;
} {
  const monthlyPnL: { [month: string]: number } = {};

  trades.forEach((trade) => {
    const d = new Date(trade.updatedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      '0'
    )}`;
    monthlyPnL[key] = (monthlyPnL[key] ?? 0) + (trade.pnl ?? 0);
  });

  return monthlyPnL;
}
