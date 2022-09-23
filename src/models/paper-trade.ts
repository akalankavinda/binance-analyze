import { AnalyzeStrategy } from "../enums/analyze-strategies.enum";
import { ChartTimeframe } from "../enums/chart-timeframes.enum";

export interface PaperTrade {
  symbol: string;
  amount: number;
  buyPrice: number;
  currentPrice: number;
  stopLoss: number;
  stopProfit: number;
  zeroLossLimit: number;
  isHiddenTrade: boolean;
  timeFrame: ChartTimeframe;
  strategy: AnalyzeStrategy;
  timestamp: number;
}
