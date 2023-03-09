import { ChartTimeFrame } from "../../enums/chart-timeframes.enum";
import { AnalyzeResult } from "../../models/analyze-result.model";
import { RsiWithPrice } from "../../models/rsi-with-price.mode";
import { AnalyzeStrategy } from "../../enums/analyze-strategies.enum";
import { TrendDirection } from "../../enums/trend-direction.enum";
import { PriceRecordDto } from "../../models/price-record.dto";

export function findOpportunity(
  symbol: string,
  timeFrame: ChartTimeFrame,
  candleData: PriceRecordDto[],
  rsiResults: number[],
  rsi14PeriodResults: number[]
): AnalyzeResult | null {
  if (rsiResults.length > 55) {
    //

    let lastClosedRsi14Value =
      rsi14PeriodResults[rsi14PeriodResults.length - 2];

    let rsiWithPriceList: RsiWithPrice[] = [];

    let percentageLimit = getPercentageLimit(timeFrame);

    for (let index = 1; index < 10; index++) {
      rsiWithPriceList.unshift({
        rsiValue: rsiResults[rsiResults.length - index],
        closePrice: candleData[candleData.length - index].close,
        eventNumber: candleData[candleData.length - index].event_number,
      });
    }

    //////////////////////
    // bullish logic
    //////////////////////
    let rsiLowestBottomIndex = rsiWithPriceList.length - 1;
    let rsiLowestBottom: RsiWithPrice = rsiWithPriceList[rsiLowestBottomIndex];

    rsiWithPriceList.forEach((item, index) => {
      if (item.rsiValue < rsiLowestBottom.rsiValue) {
        rsiLowestBottom = item;
        rsiLowestBottomIndex = index;
      }
    });

    let rsiSecondLowestBottom: RsiWithPrice =
      rsiWithPriceList[rsiWithPriceList.length - 2];

    // 1st condition
    let lastClosedCandleFormedSecondLowestBottom =
      rsiResults[rsiResults.length - 2] < rsiResults[rsiResults.length - 3] &&
      rsiResults[rsiResults.length - 3] < rsiResults[rsiResults.length - 4];

    // 2nd condition
    let bottomsAreInOversoldRegion =
      rsiLowestBottom.rsiValue < 5 && rsiSecondLowestBottom.rsiValue < 20;

    // 3rd condition
    let bottomsHasEnoughCandleGap =
      rsiSecondLowestBottom.eventNumber - rsiLowestBottom.eventNumber > 2;

    // 4th condition
    let rsiBottomsShowAscendingOrder =
      rsiSecondLowestBottom.rsiValue > rsiLowestBottom.rsiValue;

    // 5th condition
    let pricesShowDescendingOrder =
      rsiSecondLowestBottom.closePrice < rsiLowestBottom.closePrice;

    // 6th condition
    let noCandlesBrokeBottomTouchingLine = true;

    // let bulGradient =
    //   (rsiLowestBottom.closePrice - rsiSecondLowestBottom.closePrice) /
    //   (rsiLowestBottom.eventNumber - rsiSecondLowestBottom.eventNumber); // gradient is (m) in y = mx + c

    // let bulIntercept =
    //   rsiLowestBottom.closePrice - bulGradient * rsiLowestBottom.eventNumber; // intercept is (c) in y = mx + c

    // let bottomsTouchingLine: number[] = [];

    // rsiWithPriceList.forEach((rsiWithPrice: RsiWithPrice) => {
    //   bottomsTouchingLine.push(
    //     bulGradient * rsiWithPrice.eventNumber + bulIntercept
    //   );
    // });

    // for (
    //   let index = rsiLowestBottomIndex + 1;
    //   index < rsiWithPriceList.length - 3;
    //   index++
    // ) {
    //   if (rsiWithPriceList[index].closePrice < bottomsTouchingLine[index]) {
    //     noCandlesBrokeBottomTouchingLine = false;
    //   }
    // }

    // 7th condition
    let onePercentBelowPriceFromRsiLowestBottom =
      rsiLowestBottom.closePrice -
      (rsiLowestBottom.closePrice / 100) * percentageLimit;

    let rsiBottomsHasConsiderableDiff =
      rsiSecondLowestBottom.rsiValue > rsiLowestBottom.rsiValue + 10;

    let bottomPricesHasConsiderableDiff =
      rsiSecondLowestBottom.closePrice <
      onePercentBelowPriceFromRsiLowestBottom;

    let rsiBottomValuesOrPricesHasConsiderableDiff =
      bottomPricesHasConsiderableDiff || rsiBottomsHasConsiderableDiff;

    // Check all conditions are passed
    let rsiBullishDivergenceFormed =
      bottomsAreInOversoldRegion &&
      bottomsHasEnoughCandleGap &&
      rsiBottomsShowAscendingOrder &&
      pricesShowDescendingOrder &&
      lastClosedCandleFormedSecondLowestBottom &&
      noCandlesBrokeBottomTouchingLine &&
      rsiBottomValuesOrPricesHasConsiderableDiff;

    //////////////////////
    // bearish logic
    //////////////////////
    let rsiHighestTopIndex = rsiWithPriceList.length - 1;
    let rsiHighestTop: RsiWithPrice = rsiWithPriceList[rsiHighestTopIndex];

    rsiWithPriceList.forEach((item, index) => {
      if (item.rsiValue > rsiHighestTop.rsiValue) {
        rsiHighestTop = item;
        rsiHighestTopIndex = index;
      }
    });

    let rsiSecondHighestTop: RsiWithPrice =
      rsiWithPriceList[rsiWithPriceList.length - 2];

    // 1st condition
    let lastClosedCandleFormedLowerHigh =
      rsiResults[rsiResults.length - 2] > rsiResults[rsiResults.length - 3] &&
      rsiResults[rsiResults.length - 3] > rsiResults[rsiResults.length - 4];

    // 2nd condition
    let topsAreInOverboughtRegion =
      rsiHighestTop.rsiValue > 95 && rsiSecondHighestTop.rsiValue > 80;

    // 3rd condition
    let topsHasEnoughCandleGap =
      rsiSecondHighestTop.eventNumber - rsiHighestTop.eventNumber > 2;

    // 4th condition
    let rsiTopsShowDescendingOrder =
      rsiHighestTop.rsiValue > rsiSecondHighestTop.rsiValue;

    // 5th condition
    let pricesShowAscendingOrder =
      rsiSecondHighestTop.closePrice > rsiHighestTop.closePrice;

    // 6th condition
    let noCandlesBrokeTopsTouchingLine = true;

    // let bearGradient =
    //   (rsiHighestTop.closePrice - rsiSecondHighestTop.closePrice) /
    //   (rsiHighestTop.eventNumber - rsiSecondHighestTop.eventNumber); // gradient is (m) in y = mx + c

    // let bearIntercept =
    //   rsiHighestTop.closePrice - bearGradient * rsiHighestTop.eventNumber; // intercept is (c) in y = mx + c

    // let topsTouchingLine: number[] = [];

    // rsiWithPriceList.forEach((rsiWithPrice: RsiWithPrice) => {
    //   topsTouchingLine.push(
    //     bearGradient * rsiWithPrice.eventNumber + bearIntercept
    //   );
    // });

    // for (
    //   let index = rsiHighestTopIndex + 1;
    //   index < rsiWithPriceList.length - 3;
    //   index++
    // ) {
    //   if (rsiWithPriceList[index].closePrice > topsTouchingLine[index]) {
    //     noCandlesBrokeTopsTouchingLine = false;
    //   }
    // }

    // 7th condition
    let onePercentAbovePriceFromRsiHighestTop =
      rsiHighestTop.closePrice +
      (rsiHighestTop.closePrice / 100) * percentageLimit;

    let rsiTopsHasConsiderableDiff =
      rsiSecondHighestTop.rsiValue < rsiHighestTop.rsiValue - 10;

    let topsPricesHasConsiderableDiff =
      rsiSecondHighestTop.closePrice > onePercentAbovePriceFromRsiHighestTop;

    let rsiTopsValuesOrPricesHasConsiderableDiff =
      topsPricesHasConsiderableDiff || rsiTopsHasConsiderableDiff;

    // Check all conditions are passed
    let rsiBearishDivergenceFormed =
      topsAreInOverboughtRegion &&
      topsHasEnoughCandleGap &&
      rsiTopsShowDescendingOrder &&
      pricesShowAscendingOrder &&
      lastClosedCandleFormedLowerHigh &&
      noCandlesBrokeTopsTouchingLine &&
      rsiTopsValuesOrPricesHasConsiderableDiff;

    if (rsiBullishDivergenceFormed) {
      return <AnalyzeResult>{
        symbol: symbol,
        strategy: AnalyzeStrategy.RSI_3_DIVERGENCE,
        direction: TrendDirection.BULLISH,
        timeFrame: timeFrame,
        eventNumber: rsiSecondLowestBottom.eventNumber,
        rsiValue: lastClosedRsi14Value,
        targetPrice: rsiSecondLowestBottom.closePrice,
      };
    } else if (rsiBearishDivergenceFormed) {
      return <AnalyzeResult>{
        symbol: symbol,
        strategy: AnalyzeStrategy.RSI_3_DIVERGENCE,
        direction: TrendDirection.BEARISH,
        timeFrame: timeFrame,
        eventNumber: rsiSecondHighestTop.eventNumber,
        rsiValue: lastClosedRsi14Value,
        targetPrice: rsiSecondHighestTop.closePrice,
      };
    } else {
      return null;
    }
  } else {
    return null;
  }
}

function getPercentageLimit(timeFrame: ChartTimeFrame) {
  let percentageLimit = 1;

  if (timeFrame === ChartTimeFrame.THIRTY_MINUTE) {
    percentageLimit = 2;
  } else if (timeFrame === ChartTimeFrame.ONE_HOUR) {
    percentageLimit = 2;
  } else if (timeFrame === ChartTimeFrame.TWO_HOUR) {
    percentageLimit = 3;
  } else if (timeFrame === ChartTimeFrame.FOUR_HOUR) {
    percentageLimit = 4;
  } else if (timeFrame === ChartTimeFrame.TWELVE_HOUR) {
    percentageLimit = 6;
  } else if (timeFrame === ChartTimeFrame.ONE_DAY) {
    percentageLimit = 10;
  }
  return percentageLimit;
}

export function findOversoldOrOverboughtOpportunity(
  symbol: string,
  timeFrame: ChartTimeFrame,
  candleData: PriceRecordDto[],
  rsiResults: number[],
  rsi14PeriodResults: number[]
): AnalyzeResult | null {
  if (timeFrame === ChartTimeFrame.FOUR_HOUR) {
    let lastClose3PeriodRsi = rsiResults[rsiResults.length - 1];
    let lastClose14PeriodRsi = rsi14PeriodResults[rsiResults.length - 1];
    let lastClosedCandleEventNumber =
      candleData[candleData.length - 1].event_number;
    let lastClosedCandlePrice = candleData[candleData.length - 1].close;

    if (lastClose3PeriodRsi < 2.5) {
      return <AnalyzeResult>{
        symbol: symbol,
        strategy: AnalyzeStrategy.RSI_3PERIOD_OVEREXTEND,
        direction: TrendDirection.BULLISH,
        timeFrame: timeFrame,
        eventNumber: lastClosedCandleEventNumber,
        rsiValue: lastClose14PeriodRsi,
        targetPrice: lastClosedCandlePrice,
      };
    } else if (lastClose3PeriodRsi > 97.5) {
      return <AnalyzeResult>{
        symbol: symbol,
        strategy: AnalyzeStrategy.RSI_3PERIOD_OVEREXTEND,
        direction: TrendDirection.BEARISH,
        timeFrame: timeFrame,
        eventNumber: lastClosedCandleEventNumber,
        rsiValue: lastClose14PeriodRsi,
        targetPrice: lastClosedCandlePrice,
      };
    } else {
      return null;
    }
  } else {
    return null;
  }
}
