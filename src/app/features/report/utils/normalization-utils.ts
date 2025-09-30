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

  // Filtrar solo trades que no estén cancelados
  const validOrders = orders.filter(order => order.status !== 'cancelled');

  // Convertir cada orden a un trade individual
  const individualTrades: GroupedTradeFinal[] = validOrders.map((order, index) => {
    // Crear trade individual
    const trade: GroupedTradeFinal = {
      ...order,
      instrument: undefined, // Se asignará después de obtener los detalles del instrumento
      pnl: 0,
      isWon: false,
      isOpen: order.isOpen === 'false' ? false : true,
    };
    
    return trade;
  });
  
  // Agrupar trades por positionId
  const tradesByPosition: { [positionId: string]: GroupedTradeFinal[] } = {};
  
  individualTrades.forEach(trade => {
    const basePositionId = trade.positionId;
    if (!tradesByPosition[basePositionId]) {
      tradesByPosition[basePositionId] = [];
    }
    tradesByPosition[basePositionId].push(trade);
  });
  
  // Obtener lotSize de todos los instrumentos únicos ANTES de procesar trades
  const instrumentDetailsMap = await fetchInstrumentDetails(individualTrades, reportService, accessToken, accNum);
  
  // Calcular wins/losses y P&L
  const finalTrades: GroupedTradeFinal[] = [];
  let totalWins = 0;
  let totalLosses = 0;
  
  Object.values(tradesByPosition).forEach(positionTrades => {
    // El primer trade es el que tiene isOpen: true, no por fecha
    const firstTrade = positionTrades.find(trade => trade.isOpen === true);
    const secondTrade = positionTrades.find(trade => trade.isOpen === false);
    
    if (firstTrade && secondTrade) {
      // Verificar que ambos trades estén filled
      if (firstTrade.side && secondTrade.side) {
        let isWin = false;
        
        if (firstTrade.side === 'sell' && secondTrade.side === 'buy') {
          // Vendió primero, compró después
          // Gana si: precio_venta > precio_compra
          const sellPrice = Number(firstTrade.price);
          const buyPrice = Number(secondTrade.price);
          isWin = sellPrice > buyPrice;
        } else if (firstTrade.side === 'buy' && secondTrade.side === 'sell') {
          // Compró primero, vendió después
          // Gana si: precio_venta > precio_compra
          const buyPrice = Number(firstTrade.price);
          const sellPrice = Number(secondTrade.price);
          isWin = sellPrice > buyPrice;
        }
        
        // Calcular P&L aquí mismo
        const tradeKey = `${firstTrade.tradableInstrumentId}-${firstTrade.routeId}`;
        const instrumentDetails = instrumentDetailsMap.get(tradeKey);
        const lotSize = instrumentDetails?.lotSize || 1;
        
        // Asignar el nombre del instrumento al trade
        if (instrumentDetails?.name) {
          firstTrade.instrument = instrumentDetails.name;
        }
        
        const entryPrice = Number(firstTrade.price);
        const exitPrice = Number(secondTrade.price);
        const quantity = Number(firstTrade.qty);
        
        // Calcular P&L según el tipo de trade
        let pnl: number;
        if (firstTrade.side === 'buy' && secondTrade.side === 'sell') {
          // BUY → SELL: Ganas si vendes más caro de lo que compraste
          pnl = (exitPrice - entryPrice) * (quantity * lotSize);
        } else if (firstTrade.side === 'sell' && secondTrade.side === 'buy') {
          // SELL → BUY: Ganas si compras más barato de lo que vendiste
          pnl = (entryPrice - exitPrice) * (quantity * lotSize);
        } else {
          // Fallback (no debería pasar)
          pnl = (exitPrice - entryPrice) * (quantity * lotSize);
        }
        
        // Actualizar el primer trade con el resultado
        firstTrade.isWon = isWin;
        firstTrade.isOpen = false; // Ya está cerrado
        firstTrade.pnl = pnl; // Asignar P&L calculado
        
        // Agregar solo el primer trade (representa la posición completa)
        finalTrades.push(firstTrade);
        
        // Contar wins y losses
        if (isWin) {
          totalWins++;
        } else {
          totalLosses++;
        }
      } else {
        // Si no están filled, agregarlos como están
        finalTrades.push(...positionTrades);
      }
    } else {
      // Si no se encuentran ambos trades (isOpen true/false), agregar todos
      finalTrades.push(...positionTrades);
    }
  });
  
  return finalTrades;
}

async function fetchInstrumentDetails(
  trades: GroupedTradeFinal[],
  reportService: any,
  accessToken: string,
  accNum: number
): Promise<Map<string, { lotSize: number, name: string }>> {
  // Extraer tradableInstrumentId y routeId únicos
  const uniqueInstruments = new Map<string, { tradableInstrumentId: string, routeId: string }>();
  
  trades.forEach(trade => {
    if (trade.tradableInstrumentId && trade.routeId) {
      const key = `${trade.tradableInstrumentId}-${trade.routeId}`;
      if (!uniqueInstruments.has(key)) {
        uniqueInstruments.set(key, {
          tradableInstrumentId: trade.tradableInstrumentId,
          routeId: trade.routeId
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
