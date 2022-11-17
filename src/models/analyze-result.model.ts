import { AnalyzeStrategy } from "../enums/analyze-strategies.enum";
import { TrendDirection } from "../enums/trend-direction.enum";
import { ChartTimeFrame } from "../enums/chart-timeframes.enum";

export interface AnalyzeResult {
  symbol: string;
  strategy: AnalyzeStrategy;
  direction: TrendDirection;
  timeFrame: ChartTimeFrame;
  eventNumber: number;
  rsiValue: number;
  bollingerBandPercentage: number;
  continuousCandleCount: number;
  targetPrice: number;
}
