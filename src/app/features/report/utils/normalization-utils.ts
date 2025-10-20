import { GroupedTrade, GroupedTradeFinal, historyTrade } from '../models/report.model';

export function arrayToHistoryTrade(arr: any[]): historyTrade {
  // Mapeo según la configuración de la API:
  // 0: id, 1: tradableInstrumentId, 2: routeId, 3: qty, 4: side, 5: type, 6: status, 7: filledQty, 8: avgPrice, 9: price, 10: stopPrice, 11: validity, 12: expireDate, 13: createdDate, 14: lastModified, 15: isOpen, 16: positionId, 17: stopLoss, 18: stopLossType, 19: takeProfit, 20: takeProfitType, 21: strategyId
  
  return {
    id: arr[0], // id
    tradableInstrumentId: arr[1], // tradableInstrumentId
    routeId: arr[2], // routeId
    qty: arr[3], // qty
    side: arr[4], // side
    type: arr[5], // type
    status: arr[6], // status
    filledQty: arr[7], // filledQty
    avgPrice: arr[8], // avgPrice
    price: arr[9], // price
    stopPrice: arr[10], // stopPrice
    validity: arr[11], // validity
    expireDate: arr[12], // expireDate
    createdDate: arr[13], // createdDate
    lastModified: arr[14], // lastModified
    isOpen: arr[15], // isOpen
    positionId: arr[16], // positionId
    stopLoss: arr[17], // stopLoss
    stopLossType: arr[18], // stopLossType
    takeProfit: arr[19], // takeProfit
    takeProfitType: arr[20], // takeProfitType
    strategyId: arr[21], // strategyId
  };
}

export async function groupOrdersByPosition(orders: historyTrade[], reportService: any, accessToken: string, accNum: number): Promise<GroupedTradeFinal[]> {
  // Filtrar solo trades que no estén cancelados y que tengan status 'Filled' (case insensitive)
  const validOrders = orders.filter(order => {
    const hasValidStatus = order.status && (
      order.status.toLowerCase() === 'filled' || 
      order.status === 'Filled' || 
      order.status === 'filled'
    );
    const hasValidPositionId = order.positionId && 
      order.positionId !== 'null' && 
      order.positionId !== '' &&
      order.positionId !== null &&
      order.positionId !== undefined;
    
    return hasValidStatus && hasValidPositionId;
  });
  
  // Agrupar órdenes por positionId
  const ordersByPosition: { [positionId: string]: historyTrade[] } = {};
  
  validOrders.forEach(order => {
    const positionId = order.positionId;
    if (!ordersByPosition[positionId]) {
      ordersByPosition[positionId] = [];
    }
    ordersByPosition[positionId].push(order);
  });
  
  // Obtener lotSize de todos los instrumentos únicos ANTES de procesar trades
  const instrumentDetailsMap = await fetchInstrumentDetails(validOrders, reportService, accessToken, accNum);
  
  // Procesar cada posición para crear un trade final
  const finalTrades: GroupedTradeFinal[] = [];
  let totalWins = 0;
  let totalLosses = 0;
  
  Object.entries(ordersByPosition).forEach(([positionId, positionOrders]) => {
    // Ordenar por fecha de creación para asegurar orden correcto
    positionOrders.sort((a, b) => new Date(a.createdDate).getTime() - new Date(b.createdDate).getTime());
    
    // Buscar la orden de apertura (isOpen: true) y la de cierre (isOpen: false)
    const openOrder = positionOrders.find(order => order.isOpen === 'true');
    const closeOrder = positionOrders.find(order => order.isOpen === 'false');
    
    if (openOrder && closeOrder) {
      // Calcular P&L
      const tradeKey = `${openOrder.tradableInstrumentId}-${openOrder.routeId}`;
      const instrumentDetails = instrumentDetailsMap.get(tradeKey);
      const lotSize = instrumentDetails?.lotSize || 1;
      
      const entryPrice = Number(openOrder.price);
      const exitPrice = Number(closeOrder.price);
      const quantity = Number(openOrder.qty);
      
      // Calcular P&L según el tipo de trade
      let pnl: number;
      let isWin = false;
      
      if (openOrder.side === 'buy' && closeOrder.side === 'sell') {
        // BUY → SELL: Ganas si vendes más caro de lo que compraste
        pnl = (exitPrice - entryPrice) * (quantity * lotSize);
        isWin = exitPrice > entryPrice;
      } else if (openOrder.side === 'sell' && closeOrder.side === 'buy') {
        // SELL → BUY: Ganas si compras más barato de lo que vendiste
        pnl = (entryPrice - exitPrice) * (quantity * lotSize);
        isWin = entryPrice > exitPrice;
      } else {
        // Fallback (no debería pasar)
        pnl = (exitPrice - entryPrice) * (quantity * lotSize);
        isWin = pnl > 0;
      }
      
      // Crear el trade final usando la orden de apertura como base
      const finalTrade: GroupedTradeFinal = {
        ...openOrder,
        instrument: instrumentDetails?.name || openOrder.tradableInstrumentId,
        pnl: pnl,
        isWon: isWin,
        isOpen: false, // Ya está cerrado
        lastModified: closeOrder.lastModified, // Usar la fecha de cierre
      };
      
      // Validar que el trade final tenga positionId válido
      if (finalTrade.positionId && finalTrade.positionId !== 'null' && finalTrade.positionId !== '') {
        finalTrades.push(finalTrade);
      }
      
      // Contar wins y losses
      if (isWin) {
        totalWins++;
      } else {
        totalLosses++;
      }
    } else {
      // Si no se encuentran ambos trades, agregar la orden de apertura si existe
      if (openOrder) {
        const tradeKey = `${openOrder.tradableInstrumentId}-${openOrder.routeId}`;
        const instrumentDetails = instrumentDetailsMap.get(tradeKey);
        
        const finalTrade: GroupedTradeFinal = {
          ...openOrder,
          instrument: instrumentDetails?.name || openOrder.tradableInstrumentId,
          pnl: 0,
          isWon: false,
          isOpen: true,
        };
        
        // Validar que el trade final tenga positionId válido
        if (finalTrade.positionId && finalTrade.positionId !== 'null' && finalTrade.positionId !== '') {
          finalTrades.push(finalTrade);
        }
      }
    }
  });
  
  return finalTrades;
}

async function fetchInstrumentDetails(
  orders: historyTrade[],
  reportService: any,
  accessToken: string,
  accNum: number
): Promise<Map<string, { lotSize: number, name: string }>> {
  // Extraer tradableInstrumentId y routeId únicos
  const uniqueInstruments = new Map<string, { tradableInstrumentId: string, routeId: string }>();
  
  orders.forEach(order => {
    if (order.tradableInstrumentId && order.routeId) {
      const key = `${order.tradableInstrumentId}-${order.routeId}`;
      if (!uniqueInstruments.has(key)) {
        uniqueInstruments.set(key, {
          tradableInstrumentId: order.tradableInstrumentId,
          routeId: order.routeId
        });
      }
    }
  });
  
  // Hacer consultas a la API para obtener lotSize y name de cada instrumento
  const instrumentDetailsMap = new Map<string, { lotSize: number, name: string }>(); // key: tradableInstrumentId-routeId, value: {lotSize, name}

  // Procesar cada instrumento único de forma secuencial
  for (const [key, instrument] of uniqueInstruments) {
    try {
      // Hacer petición individual para cada instrumento
      const instrumentDetails = await reportService.getInstrumentDetails(
        accessToken,
        instrument.tradableInstrumentId,
        instrument.routeId,
        accNum
      ).toPromise();

      const lotSize = instrumentDetails.lotSize;
      const name = instrumentDetails.name;
      
      instrumentDetailsMap.set(key, { lotSize, name });

      // Pequeña pausa entre peticiones para evitar rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`❌ Error querying instrument ${key}:`, error);
      instrumentDetailsMap.set(key, { lotSize: 1, name: instrument.tradableInstrumentId }); // Default values si falla la consulta
    }
  }

  return instrumentDetailsMap;
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
