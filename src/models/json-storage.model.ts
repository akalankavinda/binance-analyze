import { OrderCompleteStatus } from "../enums/order-complete-status.enum";
import { PaperTrade } from "./paper-trade";

export interface JsonStorage {
  profitTradeCount: number;
  totalTradeCount: number;
  totalProfit: number;
  pendingBuyOrders: PaperTrade[];
  pendingSellOrders: PaperTrade[];
  recentlyLostSymbolList: string[];
  placingRealOrdersAllowed: boolean;
  recentOrderStatusStack: OrderCompleteStatus[];
}
