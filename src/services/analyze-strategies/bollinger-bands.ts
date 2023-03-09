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
  if (bbResults.length > 5) {
    let lastClosedRsiValue = rsiResults[rsiResults.length - 2];
    let lastClosedBbValue = bbResults[bbResults.length - 2];

    // let bbCurrentLowerLimit =
    //   currentBbValue.middle -
    //   ((currentBbValue.middle - currentBbValue.lower) / 100) * 90;
    // let bbLoweBandLowerLimit =
    //   lastClosedBbValue.middle -
    //   ((lastClosedBbValue.middle - lastClosedBbValue.lower) / 100) * 150;

    let eventNumber = candleData[candleData.length - 2].event_number;
    let lastClosedCandle = candleData[candleData.length - 2];

    let recentCandlesBrokeBbLower = false;

    for (let index = 3; index < 15; index++) {
      if (
        candleData[candleData.length - index].low <
        bbResults[bbResults.length - index].lower
      ) {
        recentCandlesBrokeBbLower = true;
      }
    }

    let bbCurrentIsBelowLimit =
      lastClosedCandle.low <= lastClosedBbValue.lower &&
      lastClosedCandle.close > lastClosedBbValue.lower &&
      lastClosedRsiValue < 35 &&
      recentCandlesBrokeBbLower === false;

    // bearish logic

    // let bbCurrentUpperLimit =
    //   currentBbValue.middle +
    //   ((currentBbValue.upper - currentBbValue.middle) / 100) * 90;

    // let bbUpperBandUpperLimit =
    //   lastClosedBbValue.middle +
    //   ((lastClosedBbValue.upper - lastClosedBbValue.middle) / 100) * 150;

    let lastClosedCandle2 = candleData[candleData.length - 2];

    let recentCandlesBrokeBbUpper = false;

    for (let index = 3; index < 15; index++) {
      if (
        candleData[candleData.length - index].high >
        bbResults[bbResults.length - index].upper
      ) {
        recentCandlesBrokeBbUpper = true;
      }
    }

    let bbCurrentIsAboveLimit =
      lastClosedCandle2.high >= lastClosedBbValue.upper &&
      lastClosedCandle2.close < lastClosedBbValue.upper &&
      lastClosedRsiValue > 65 &&
      recentCandlesBrokeBbUpper === false;

    if (bbCurrentIsBelowLimit) {
      return <AnalyzeResult>{
        symbol: symbol,
        strategy: AnalyzeStrategy.RSI_WITH_BB,
        direction: TrendDirection.BULLISH,
        timeFrame: timeFrame,
        eventNumber: eventNumber,
        rsiValue: lastClosedRsiValue,
        targetPrice: candleData[candleData.length - 2].close,
      };
    } else if (bbCurrentIsAboveLimit) {
      return <AnalyzeResult>{
        symbol: symbol,
        strategy: AnalyzeStrategy.RSI_WITH_BB,
        direction: TrendDirection.BEARISH,
        timeFrame: timeFrame,
        eventNumber: eventNumber,
        rsiValue: lastClosedRsiValue,
        targetPrice: candleData[candleData.length - 2].close,
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

export function bollingerBandScore(
  tradingPrice: number,
  bbValue: BollingerBandsOutput,
  rsiValue: number
): number {
  let bbPercentage = 0;

  if (tradingPrice < bbValue.middle) {
    bbPercentage =
      ((bbValue.middle - tradingPrice) / (bbValue.middle - bbValue.lower)) * -1;
  } else if (tradingPrice > bbValue.middle) {
    bbPercentage =
      (tradingPrice - bbValue.middle) / (bbValue.upper - bbValue.middle);
  }

  return bbPercentage;
}
