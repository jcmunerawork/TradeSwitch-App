import { GroupedTrade, historyTrade } from '../models/report.model';

export function arrayToHistoryTrade(arr: any[]): historyTrade {
  // Mapeo según la configuración de la API:
  // 0: id, 1: tradableInstrumentId, 2: routeId, 3: qty, 4: side, 5: type, 6: status, 7: filledQty, 8: avgPrice, 9: price, 10: stopPrice, 11: validity, 12: expireDate, 13: createdDate, 14: lastModified, 15: isOpen, 16: positionId, 17: stopLoss, 18: stopLossType, 19: takeProfit, 20: takeProfitType, 21: strategyId
  
  return {
    id: arr[0], // id
    userId: arr[1], // tradableInstrumentId (usando como userId temporalmente)
    accountId: arr[2], // routeId (usando como accountId temporalmente)
    quantity: arr[3], // qty
    side: arr[4], // side
    type_of_order: arr[5], // type
    status: arr[6], // status
    lots: arr[7], // filledQty
    price: arr[4] === 'buy' ? { buy_price: arr[8] } : { sell_price: arr[8] }, // avgPrice
    execution_price: arr[8], // avgPrice (precio de ejecución)
    isCloseAction: arr[15] === 'true', // isOpen (invertido)
    updatedAt: arr[14], // lastModified
    position_Id: arr[16], // positionId
    // Nuevos campos útiles
    stopLoss: arr[17], // stopLoss
    takeProfit: arr[19], // takeProfit
    strategyId: arr[21], // strategyId
    createdDate: arr[13], // createdDate
    filledQty: arr[7], // filledQty
    avgPrice: arr[8], // avgPrice
  };
}

export function groupOrdersByPosition(orders: historyTrade[]): GroupedTrade[] {
  
  const grouped: { [positionId: string]: GroupedTrade } = {};

  // Filtrar solo trades que no estén cancelados
  const validOrders = orders.filter(order => order.status !== 'cancelled');

  validOrders.forEach((order) => {
    const posId = order.position_Id;
    if (!grouped[posId]) {
      grouped[posId] = {
        position_Id: posId,
        quantity: parseFloat(order.quantity),
        updatedAt: order.updatedAt,
        isOpen: order.isCloseAction === false, // isOpen es true si isCloseAction es false
        stopLoss: order.stopLoss,
        takeProfit: order.takeProfit,
      };
    }
    
    // Usar avgPrice (precio promedio) para cálculos más precisos
    const executionPrice = order.avgPrice || order.execution_price;
    
    // Determinar el lado de la posición basado en el primer trade
    if (!grouped[posId].side) {
      grouped[posId].side = order.side;
    }
    
    // Para trades de compra (buy): este es el precio de entrada
    if (order.side === 'buy') {
      grouped[posId].entryPrice = executionPrice;
      grouped[posId].buy_price = executionPrice;
    } 
    // Para trades de venta (sell): este es el precio de salida
    else if (order.side === 'sell') {
      grouped[posId].exitPrice = executionPrice;
      grouped[posId].sell_price = executionPrice;
    }

    // Calculate total spend for this position using filledQty if available
    const qty = parseFloat(order.filledQty || order.quantity);
    grouped[posId].totalSpend = Number(executionPrice) * qty;
  });

  // Calculate PnL for each position
  Object.values(grouped).forEach((trade) => {
    // Calcular PnL basado en el lado de la posición
    if (trade.side === 'buy') {
      // Para posición de compra: PnL = (precio_salida - precio_entrada) * cantidad
      trade.pnl = calculatePnLByTrade(trade.entryPrice, trade.exitPrice, trade.quantity);
    } else if (trade.side === 'sell') {
      // Para posición de venta: PnL = (precio_entrada - precio_salida) * cantidad
      trade.pnl = calculatePnLByTrade(trade.exitPrice, trade.entryPrice, trade.quantity);
    }
    
    // Determinar si el trade fue ganador
    trade.isWon = trade.pnl !== undefined && trade.pnl > 0;
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
  
  // If there are no losses, profit factor should be calculated differently
  if (grossLoss === 0) {
    // If there are profits and no losses, return a high but finite number
    return grossProfit > 0 ? 999.99 : 0;
  }
  
  const profitFactor = grossProfit / grossLoss;
  return Math.round(profitFactor * 100) / 100;
}

export function calculateAvgWinLossTrades(trades: { pnl?: number }[]): number {
  const wins = trades.filter((t) => t.pnl !== undefined && t.pnl > 0);
  const losses = trades.filter((t) => t.pnl !== undefined && t.pnl < 0);

  // If there are no losses, we can't calculate a ratio
  if (losses.length === 0) {
    // If there are wins but no losses, return a high ratio
    return wins.length > 0 ? 999.99 : 0;
  }

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
