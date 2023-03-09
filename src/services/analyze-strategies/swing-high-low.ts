import { PriceRecordDto } from "../../models/price-record.dto";
import { TrendDirection } from "../../enums/trend-direction.enum";
import { AnalyzeResult } from "../../models/analyze-result.model";

export function formedSwingHighOrLow(
  candlestickData: PriceRecordDto[],
  candidate: AnalyzeResult
): boolean {
  if (candlestickData.length > 25) {
    if (candidate.direction === TrendDirection.BULLISH) {
      let lowestWigCandleIndex = candlestickData.length - 1;
      let lowestWigCandle = candlestickData[lowestWigCandleIndex];

      for (
        let index = candlestickData.length - 1;
        index > candlestickData.length - 20;
        index--
      ) {
        if (candlestickData[index].low < lowestWigCandle.low) {
          lowestWigCandleIndex = index;
          lowestWigCandle = candlestickData[index];
        }
      }

      let afterLowestWigCandleHighIsTakenOut = false;
      for (
        let index = lowestWigCandleIndex;
        index < candlestickData.length;
        index++
      ) {
        if (candlestickData[index - 1].high < candlestickData[index].high) {
          afterLowestWigCandleHighIsTakenOut = true;
        }
      }

      if (afterLowestWigCandleHighIsTakenOut) {
        return true;
      } else {
        return false;
      }
    } else if (candidate.direction === TrendDirection.BEARISH) {
      let highestWigCandleIndex = candlestickData.length - 1;
      let highestWigCandle = candlestickData[highestWigCandleIndex];

      for (
        let index = candlestickData.length - 1;
        index > candlestickData.length - 20;
        index--
      ) {
        if (candlestickData[index].high > highestWigCandle.high) {
          highestWigCandleIndex = index;
          highestWigCandle = candlestickData[index];
        }
      }

      let afterHighestWigCandleLowIsTakenOut = false;
      for (
        let index = highestWigCandleIndex;
        index < candlestickData.length;
        index++
      ) {
        if (candlestickData[index - 1].low > candlestickData[index].low) {
          afterHighestWigCandleLowIsTakenOut = true;
        }
      }

      if (afterHighestWigCandleLowIsTakenOut) {
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
