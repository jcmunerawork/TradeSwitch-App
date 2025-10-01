
import { RuleType } from '../../strategy/models/strategy.model';

export interface historyTrade {
  id: string;
  tradableInstrumentId: string;
  routeId: string;
  qty: string;
  side: string;
  type: string;
  status: string;
  filledQty: string;
  avgPrice: string;
  price: string;
  stopPrice: string;
  validity: string;
  expireDate: string;
  createdDate: string;
  lastModified: string;
  isOpen: string;
  positionId: string;
  stopLoss: string;
  stopLossType: string;
  takeProfit: string;
  takeProfitType: string;
  strategyId: string;
}

export interface GroupedTrade {
  position_Id: string;
  quantity?: number;
  pnl?: number;
  buy_price?: string;
  sell_price?: string;
  totalSpend?: number;
  updatedAt: string;
  // Nuevas propiedades para claridad
  entryPrice?: string;
  exitPrice?: string;
  side?: string; // 'buy' o 'sell' de la posición
  isWon?: boolean;
  isOpen?: boolean;
  stopLoss?: string;
  takeProfit?: string;
  allTrades?: historyTrade[]; // Todos los trades de esta posición
}

export interface GroupedTradeFinal {
  id: string; // id
  tradableInstrumentId: string; // tradableInstrumentId
  routeId: string; // routeId
  qty: string; // qty
  side: string; // side
  type: string; // type
  status: string; // status
  filledQty: string; // filledQty
  avgPrice: string; // avgPrice
  price: string; // price
  stopPrice: string; // stopPrice
  validity: string; // validity
  expireDate: string; // expireDate
  createdDate: string; // createdDate
  lastModified: string; // lastModified
  isOpen: boolean; // isOpen
  positionId: string; // positionId
  stopLoss: string; // stopLoss
  stopLossType: string; // stopLossType
  takeProfit: string; // takeProfit
  takeProfitType: string; // takeProfitType
  strategyId: string; // strategyId
  instrument?: string; // instrument
  pnl?: number; // pnl
  isWon?: boolean; // isWon
}

export interface BalanceData {
  balance: number, // balance
  projectedBalance: number, // projectedBalance
  availableFunds: number, // availableFunds
  blockedBalance: number, // blockedBalance
  cashBalance: number, // cashBalance
  unsettledCash: number, // unsettledCash
  withdrawalAvailable: number, // withdrawalAvailable
  stocksValue: number, // stocksValue 
  optionValue: number, // optionValue
  initialMarginReq: number, // initialMarginReq
  maintMarginReq: number, // maintMarginReq
  marginWarningLevel: number, // marginWarningLevel
  blockedForStocks: number, // blockedForStocks
  stockOrdersReq: number, // stockOrdersReq
  stopOutLevel: number, // stopOutLevel
  warningMarginReq: number, // warningMarginReq
  marginBeforeWarning: number, // marginBeforeWarning
  todayGross: number, // todayGross - A gross profit for today
  todayNet: number, // todayNet - A total profit or loss realized from positions today
  todayFees: number, // todayFees - Fees paid today
  todayVolume: number, // todayVolume - A total volume traded for today
  todayTradesCount: number, // todayTradesCount - A number of trades done for today
  openGrossPnL: number, // openGrossPnL - A profit or loss on all currently opened positions
  openNetPnL: number, // openNetPnL - A net profit or loss on open positions
  positionsCount: number, // positionsCount - A number of currently opened positions
  ordersCount: number // ordersCount - A number of currently placed pending orders
}

export interface InstrumentDetails {
  barSource: string; // "BID"
  baseCurrency: string; // "XMR"
  betSize: number | null; // null
  betStep: number | null; // null
  bettingCurrency: string | null; // null
  contractMonth: string | null; // null
  country: string | null; // null
  deliveryStatus: string | null; // null
  description: string; // ""
  exerciseStyle: string | null; // null
  firstTradeDate: string | null; // null
  hasDaily: boolean; // true
  hasIntraday: boolean; // true
  industry: string | null; // null
  isin: string; // ""
  lastTradeDate: string | null; // null
  leverage: string; // "2.00"
  localizedName: string; // "XMRUSD"
  logoUrl: string | null; // null
  lotSize: number; // 10
  lotStep: number; // 0.01
  margin_hedging_type: string; // "none"
  marketCap: number | null; // null
  marketDataExchange: string; // "Cryptos"
  maxLot: number | null; // null
  minLot: number; // 0.01
  name: string; // "XMRUSD"
  noticeDate: string | null; // null
  quotingCurrency: string; // "USD"
  sector: string | null; // null
  settlementDate: string | null; // null
  settlementSystem: string; // "Immediate"
  strikePrice: string | null; // null
  strikeType: string | null; // null
  symbolStatus: string; // "FULLY_OPEN"
  tickCost: Array<{
    leftRangeLimit: number | null;
    tickCost: number;
  }>; // Array(1) [{leftRangeLimit: null, tickCost: 0}]
  tickSize: Array<{
    leftRangeLimit: number | null;
    tickSize: number;
  }>; // Array(1) [{leftRangeLimit: null, tickSize: 0.01}]
  tradeSessionId: number; // 1547
  tradeSessionStatusId: number; // 20
  tradingExchange: string; // "Crypto"
  type: string; // "CRYPTO"
}

export interface Instrument {
  barSource: string;
  continuous: boolean;
  contractMonth: string;
  country: number;
  description: string;
  hasDaily: boolean;
  hasIntraday: boolean;
  id: number;
  localizedName: string;
  routes: Array<{
    id: string;
    type: string;
  }>;
  logoUrl: string;
  marketDataExchange: string;
  name: string;
  strikePrice: number;
  strikeType: string;
  tradableInstrumentId: number;
  tradingExchange: string;
  type: string;
  underlierId: number;
}

export interface StatConfig {
  netPnl: number;
  tradeWinPercent: number;
  profitFactor: number;
  avgWinLossTrades: number;
  totalTrades: number;
  activePositions: number;
}

export interface displayConfigData {
  title: string;
  type: RuleType;
  isActive: boolean;
}

export interface CalendarDay {
  date: Date;
  trades: GroupedTradeFinal[];
  pnlTotal: number;
  tradesCount: number;
  followedStrategy: boolean;
  tradeWinPercent: number;
}

export interface ReportState {
  groupedTrades: GroupedTradeFinal[];
  netPnL: number;
  tradeWin: number;
  profitFactor: number;
  AvgWnL: number;
  totalTrades: number;
  userKey: string;
}

export interface MonthlyReport {
  best_trade: string;
  netPnl: number;
  number_trades: number;
  profit: number;
  strategy_followed: number;
  total_spend: number;
  month: number;
  year: number;
  id: string;
}

export interface PluginHistoryRecord {
  isActive: boolean;
  updatedOn: string;
  id: string;
  tokenNeeded?: boolean;
}
