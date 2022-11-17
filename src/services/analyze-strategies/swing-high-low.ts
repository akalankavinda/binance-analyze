import { PriceRecordDto } from "../../models/price-record.dto";
import { TrendDirection } from "../../enums/trend-direction.enum";
import { AnalyzeResult } from "../../models/analyze-result.model";

export function formedSwingHighOrLow(
  candlestickData: PriceRecordDto[],
  candidate: AnalyzeResult
): boolean {
  if (candlestickData.length > 5) {
    let lastClosedPrevCandle = candlestickData[candlestickData.length - 3];
    let lastClosedCandle = candlestickData[candlestickData.length - 2];

    if (candidate.direction === TrendDirection.BULLISH) {
      if (
        lastClosedCandle.high > lastClosedPrevCandle.high //&&
        // lastClosedCandle.close > lastClosedCandle.open
      ) {
        return true;
      } else {
        return false;
      }
    } else if (candidate.direction === TrendDirection.BEARISH) {
      if (
        lastClosedCandle.low < lastClosedPrevCandle.low //&&
        //lastClosedCandle.close < lastClosedCandle.open
      ) {
        return true;
      } else {
        return false;
      }
    } else {
      return false;
    }
  }
  return false;
}
