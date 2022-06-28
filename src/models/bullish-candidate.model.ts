import { BollingerBandsOutput } from "technicalindicators/declarations/volatility/BollingerBands";
import { ChartTimeframe } from "../enums/chart-timeframes.enum";
import { PriceRecordDto } from "./price-record.dto";

export interface BullishCandidate {
  priceRecord: PriceRecordDto;
  lastBollingerValue: BollingerBandsOutput;
  lastRsiValue: number;
  bollingerBandPercentage: number;
  emaCrossedBullish: boolean;
  rsiBullish: boolean;
  bollingerNearBottom: boolean;
  timeFrame: ChartTimeframe;
}
