
import { RuleType } from '../../strategy/models/strategy.model';

/**
 * Interface representing a historical trade record from the trading API.
 *
 * This interface maps the raw array data structure returned by the TradeLocker API
 * into a structured object with named properties for easier access and manipulation.
 *
 * @interface historyTrade
 */
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

/**
 * Interface representing a grouped trade with position information.
 *
 * This interface is used for intermediate processing of trades before final grouping.
 * It contains position-level data including entry/exit prices, PnL, and trade status.
 *
 * @interface GroupedTrade
 */
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

/**
 * Interface representing a final processed trade after grouping by position.
 *
 * This is the final structure used throughout the application to display trade information.
 * It includes all original trade data plus calculated fields like PnL and win status.
 *
 * Used in:
 * - ReportComponent: Main component displaying trades
 * - CalendarComponent: Calendar view of trades
 * - PnlGraphComponent: PnL chart visualization
 * - WinLossChartComponent: Win/loss ratio visualization
 *
 * @interface GroupedTradeFinal
 */
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

/**
 * Interface representing account balance and margin data from the trading API.
 *
 * Contains comprehensive balance information including available funds, margin requirements,
 * daily trading statistics, and open position data.
 *
 * Used in:
 * - ReportComponent: Displaying account balance information
 * - ReportService: Processing balance data from API
 *
 * @interface BalanceData
 */
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

/**
 * Interface representing detailed information about a trading instrument.
 *
 * Contains instrument metadata including currency, lot size, trading hours,
 * leverage, and market information.
 *
 * Used in:
 * - ReportService: Fetching instrument details for trade processing
 * - CalendarComponent: Displaying instrument names in calendar view
 *
 * @interface InstrumentDetails
 */
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

/**
 * Interface representing a trading instrument with basic information.
 *
 * Contains essential instrument data including ID, name, routes, and market information.
 * This is a simplified version compared to InstrumentDetails.
 *
 * Used in:
 * - ReportService: Fetching available instruments
 *
 * @interface Instrument
 */
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

/**
 * Interface representing trading statistics configuration.
 *
 * Contains calculated trading metrics including PnL, win rate, profit factor,
 * and trade counts. Used to display statistical cards in the report view.
 *
 * Used in:
 * - ReportComponent: Displaying trading statistics
 * - statCardComponent: Individual statistic card display
 *
 * @interface StatConfig
 */
export interface StatConfig {
  netPnl: number;
  tradeWinPercent: number;
  profitFactor: number;
  avgWinLossTrades: number;
  totalTrades: number;
  activePositions: number;
}

/**
 * Interface representing display configuration for trading rules.
 *
 * Contains information about which trading rules are active and should be displayed
 * in the report interface.
 *
 * Used in:
 * - ReportComponent: Managing rule display configuration
 *
 * @interface displayConfigData
 */
export interface displayConfigData {
  title: string;
  type: RuleType;
  isActive: boolean;
}

/**
 * Interface representing a day in the trading calendar.
 *
 * Contains aggregated trade data for a specific day including total PnL,
 * trade count, win percentage, and strategy compliance information.
 *
 * Used in:
 * - CalendarComponent: Calendar view of trades
 * - TradesPopupComponent: Displaying trades for a selected day
 *
 * @interface CalendarDay
 */
export interface CalendarDay {
  date: Date;
  trades: GroupedTradeFinal[];
  pnlTotal: number;
  tradesCount: number;
  followedStrategy: boolean;
  tradeWinPercent: number;
  strategyName?: string | null; // Nombre de la estrategia seguida en este día
  isCurrentMonth: boolean; // Indica si el día pertenece al mes actual
}

/**
 * Interface representing the NgRx store state for the report module.
 *
 * Contains all report-related state including grouped trades, statistics,
 * and user key for API authentication.
 *
 * Used in:
 * - report.reducer.ts: Reducer managing report state
 * - report.selectors.ts: Selectors for accessing report state
 * - report.actions.ts: Actions for updating report state
 *
 * @interface ReportState
 */
export interface ReportState {
  groupedTrades: GroupedTradeFinal[];
  netPnL: number;
  tradeWin: number;
  profitFactor: number;
  AvgWnL: number;
  totalTrades: number;
  userKey: string;
}

/**
 * Interface representing a monthly trading report.
 *
 * Contains aggregated monthly trading statistics including profit, trades count,
 * and strategy compliance percentage. Used for storing and displaying monthly summaries.
 *
 * Used in:
 * - ReportService: Updating monthly reports
 * - MonthlyReportsService: Managing monthly report data
 *
 * @interface MonthlyReport
 */
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

/**
 * Interface representing plugin usage history record.
 *
 * Tracks when the trading plugin was active or inactive, including date ranges
 * and token requirements. Used to determine strategy compliance for trades.
 *
 * Used in:
 * - CalendarComponent: Determining if trades followed strategies
 * - PluginHistoryService: Managing plugin history data
 *
 * @interface PluginHistoryRecord
 */
export interface PluginHistoryRecord {
  isActive: boolean;
  updatedOn: string;
  id: string;
  tokenNeeded?: boolean;
  dateActive: string[];
  dateInactive: string[];
}
