import { ChartTimeframe } from "../enums/chart-timeframes.enum";
import { PriceRecordDto } from "./price-record.dto";

export interface BearishCandidate {
  symbol: string;
  timeFrame: ChartTimeframe;
  lastPriceRecord: PriceRecordDto;
}
