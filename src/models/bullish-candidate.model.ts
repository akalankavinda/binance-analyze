import { AnalyzeStrategy } from "../enums/analyze-strategies.enum";
import { ChartTimeframe } from "../enums/chart-timeframes.enum";
import { PriceRecordDto } from "./price-record.dto";

export interface BullishCandidate {
  priceRecord: PriceRecordDto;
  strategy: AnalyzeStrategy;
  timeFrame: ChartTimeframe;
  currentRsiValue: number;
  currentBollingerBandPercentageFromBottom: number;
}
