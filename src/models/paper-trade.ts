import { ChartTimeframe } from "../enums/chart-timeframes.enum";

export interface PaperTrade {
  symbol: string;
  amount: number;
  buyPrice: number;
  stopLoss: number;
  stopProfit: number;
  isHiddenTrade: boolean;
  timeFrame: ChartTimeframe;
  timestamp: number;
}
