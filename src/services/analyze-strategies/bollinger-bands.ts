import { ChartTimeFrame } from "../../enums/chart-timeframes.enum";
import { PriceRecordDto } from "../../models/price-record.dto";
import { BollingerBandsOutput } from "technicalindicators/declarations/volatility/BollingerBands";
import { AnalyzeResult } from "../../models/analyze-result.model";
import { AnalyzeStrategy } from "../../enums/analyze-strategies.enum";
import { TrendDirection } from "../../enums/trend-direction.enum";

export function findOpportunity(
  symbol: string,
  timeFrame: ChartTimeFrame,
  candleData: PriceRecordDto[],
  bbResults: BollingerBandsOutput[],
  rsiResults: number[]
): AnalyzeResult | null {
  let timeFrameIsAbove1h =
    timeFrame == ChartTimeFrame.ONE_HOUR ||
    timeFrame == ChartTimeFrame.TWO_HOUR ||
    timeFrame == ChartTimeFrame.FOUR_HOUR ||
    timeFrame == ChartTimeFrame.TWELVE_HOUR ||
    timeFrame == ChartTimeFrame.ONE_DAY;

  if (bbResults.length > 5 && timeFrameIsAbove1h) {
    let currentRsiValue = rsiResults[rsiResults.length - 2];
    let currentBbValue = bbResults[bbResults.length - 2];

    // let bbCurrentLowerLimit =
    //   currentBbValue.middle -
    //   ((currentBbValue.middle - currentBbValue.lower) / 100) * 90;
    // let bbLoweBandLowerLimit =
    //   currentBbValue.middle -
    //   ((currentBbValue.middle - currentBbValue.lower) / 100) * 120;

    let eventNumber = candleData[candleData.length - 2].event_number;
    let currentCandleLow = candleData[candleData.length - 2].low;
    let bbLowerBand = bbResults[bbResults.length - 2].lower;

    let bbCurrentIsBelowLimit =
      currentCandleLow < bbLowerBand && currentRsiValue < 27.5;

    // bearish logic

    // let bbCurrentUpperLimit =
    //   currentBbValue.middle +
    //   ((currentBbValue.upper - currentBbValue.middle) / 100) * 90;

    // let bbUpperBandUpperLimit =
    //   currentBbValue.middle +
    //   ((currentBbValue.upper - currentBbValue.middle) / 100) * 120;

    let currentCandleHigh = candleData[candleData.length - 2].high;
    let bbUpperBand = bbResults[bbResults.length - 2].upper;

    let bbCurrentIsAboveLimit =
      currentCandleHigh > bbUpperBand && currentRsiValue > 72.5;

    if (bbCurrentIsBelowLimit) {
      return <AnalyzeResult>{
        symbol: symbol,
        strategy: AnalyzeStrategy.RSI_WITH_BB,
        direction: TrendDirection.BULLISH,
        timeFrame: timeFrame,
        eventNumber: eventNumber,
      };
    } else if (bbCurrentIsAboveLimit) {
      return <AnalyzeResult>{
        symbol: symbol,
        strategy: AnalyzeStrategy.RSI_WITH_BB,
        direction: TrendDirection.BEARISH,
        timeFrame: timeFrame,
        eventNumber: eventNumber,
      };
    } else {
      return null;
    }
  } else {
    return null;
  }
}

export function findBollingerBandPercentage(
  direction: TrendDirection,
  tradingPrice: number,
  bbValue: BollingerBandsOutput
): number {
  if (direction === TrendDirection.BULLISH) {
    return (
      ((bbValue.middle - tradingPrice) / (bbValue.middle - bbValue.lower)) * 100
    );
  } else if (direction === TrendDirection.BEARISH) {
    return (
      ((tradingPrice - bbValue.middle) / (bbValue.upper - bbValue.middle)) * 100
    );
  } else {
    return 0;
  }
}
