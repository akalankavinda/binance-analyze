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

    let bbLowerBandLowerLimit =
      lastClosedBbValue.middle -
      ((lastClosedBbValue.middle - lastClosedBbValue.lower) / 100) * 150;

    let eventNumber = candleData[candleData.length - 2].event_number;
    let lastClosedCandle = candleData[candleData.length - 2];

    let bbCurrentIsBelowLimit =
      lastClosedCandle.low <= bbLowerBandLowerLimit &&
      lastClosedCandle.close < lastClosedBbValue.lower;

    // bearish logic

    // let bbCurrentUpperLimit =
    //   currentBbValue.middle +
    //   ((currentBbValue.upper - currentBbValue.middle) / 100) * 90;

    let bbUpperBandUpperLimit =
      lastClosedBbValue.middle +
      ((lastClosedBbValue.upper - lastClosedBbValue.middle) / 100) * 150;

    let lastClosedCandle2 = candleData[candleData.length - 2];

    let bbCurrentIsAboveLimit =
      lastClosedCandle2.high >= bbUpperBandUpperLimit &&
      lastClosedCandle2.close > lastClosedBbValue.upper;

    if (bbCurrentIsBelowLimit) {
      return <AnalyzeResult>{
        symbol: symbol,
        strategy: AnalyzeStrategy.PUMP_OR_DUMP,
        direction: TrendDirection.BEARISH,
        timeFrame: timeFrame,
        eventNumber: eventNumber,
        rsiValue: lastClosedRsiValue,
        targetPrice: candleData[candleData.length - 2].close,
      };
    } else if (bbCurrentIsAboveLimit) {
      return <AnalyzeResult>{
        symbol: symbol,
        strategy: AnalyzeStrategy.PUMP_OR_DUMP,
        direction: TrendDirection.BULLISH,
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
