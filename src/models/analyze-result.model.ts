import { AnalyzeStrategy } from "../enums/analyze-strategies.enum";
import { TrendDirection } from "../enums/trend-direction.enum";
import { ChartTimeframe } from "../enums/chart-timeframes.enum";

export interface AnalyzeResult {
  symbol: string;
  strategy: AnalyzeStrategy;
  direction: TrendDirection;
  timeFrame: ChartTimeframe;
  rsiValue: number;
  bollingerBandPercentage: number;
  continuousCandleCount: number;
}
