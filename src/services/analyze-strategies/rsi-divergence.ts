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
  rsiResults: number[]
): AnalyzeResult | null {
  if (rsiResults.length > 70) {
    //

    let rsiWithPriceList: RsiWithPrice[] = [];

    let percentageLimit = getPercentageLimit(timeFrame);

    for (let index = 1; index < 66; index++) {
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
      rsiWithPriceList[rsiWithPriceList.length - 3];

    // 1st condition
    let lastClosedCandleFormedSecondLowestBottom =
      rsiResults[rsiResults.length - 2] > rsiResults[rsiResults.length - 3] &&
      rsiResults[rsiResults.length - 3] < rsiResults[rsiResults.length - 4] &&
      rsiResults[rsiResults.length - 4] < rsiResults[rsiResults.length - 5];

    // 2nd condition
    let bottomsAreInOversoldRegion =
      rsiLowestBottom.rsiValue < 27 && rsiSecondLowestBottom.rsiValue < 37;

    // 3rd condition
    let bottomsHasEnoughCandleGap =
      rsiSecondLowestBottom.eventNumber - rsiLowestBottom.eventNumber > 10;

    // 4th condition
    let rsiBottomsShowAscendingOrder =
      rsiSecondLowestBottom.rsiValue > rsiLowestBottom.rsiValue;

    // 5th condition
    let pricesShowDescendingOrder =
      rsiSecondLowestBottom.closePrice < rsiLowestBottom.closePrice;

    // 6th condition
    let noCandlesBrokeBottomTouchingLine = true;

    let bulGradient =
      (rsiLowestBottom.closePrice - rsiSecondLowestBottom.closePrice) /
      (rsiLowestBottom.eventNumber - rsiSecondLowestBottom.eventNumber); // gradient is (m) in y = mx + c

    let bulIntercept =
      rsiLowestBottom.closePrice - bulGradient * rsiLowestBottom.eventNumber; // intercept is (c) in y = mx + c

    let bottomsTouchingLine: number[] = [];

    rsiWithPriceList.forEach((rsiWithPrice: RsiWithPrice) => {
      bottomsTouchingLine.push(
        bulGradient * rsiWithPrice.eventNumber + bulIntercept
      );
    });

    for (
      let index = rsiLowestBottomIndex + 1;
      index < rsiWithPriceList.length - 3;
      index++
    ) {
      if (rsiWithPriceList[index].closePrice < bottomsTouchingLine[index]) {
        noCandlesBrokeBottomTouchingLine = false;
      }
    }

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

    // bearish logic
    let rsiHighestTopIndex = rsiWithPriceList.length - 1;
    let rsiHighestTop: RsiWithPrice = rsiWithPriceList[rsiHighestTopIndex];

    rsiWithPriceList.forEach((item, index) => {
      if (item.rsiValue > rsiHighestTop.rsiValue) {
        rsiHighestTop = item;
        rsiHighestTopIndex = index;
      }
    });

    let rsiSecondHighestTop: RsiWithPrice =
      rsiWithPriceList[rsiWithPriceList.length - 3];

    // 1st condition
    let lastClosedCandleFormedLowerHigh =
      rsiResults[rsiResults.length - 2] < rsiResults[rsiResults.length - 3] &&
      rsiResults[rsiResults.length - 3] > rsiResults[rsiResults.length - 4] &&
      rsiResults[rsiResults.length - 4] > rsiResults[rsiResults.length - 5];

    // 2nd condition
    let topsAreInOverboughtRegion =
      rsiHighestTop.rsiValue > 73 && rsiSecondHighestTop.rsiValue > 63;

    // 3rd condition
    let topsHasEnoughCandleGap =
      rsiSecondHighestTop.eventNumber - rsiHighestTop.eventNumber > 10;

    // 4th condition
    let rsiTopsShowDescendingOrder =
      rsiHighestTop.rsiValue > rsiSecondHighestTop.rsiValue;

    // 5th condition
    let pricesShowAscendingOrder =
      rsiSecondHighestTop.closePrice > rsiHighestTop.closePrice;

    // 6th condition
    let noCandlesBrokeTopsTouchingLine = true;

    let bearGradient =
      (rsiHighestTop.closePrice - rsiSecondHighestTop.closePrice) /
      (rsiHighestTop.eventNumber - rsiSecondHighestTop.eventNumber); // gradient is (m) in y = mx + c

    let bearIntercept =
      rsiHighestTop.closePrice - bearGradient * rsiHighestTop.eventNumber; // intercept is (c) in y = mx + c

    let topsTouchingLine: number[] = [];

    rsiWithPriceList.forEach((rsiWithPrice: RsiWithPrice) => {
      topsTouchingLine.push(
        bearGradient * rsiWithPrice.eventNumber + bearIntercept
      );
    });

    for (
      let index = rsiHighestTopIndex + 1;
      index < rsiWithPriceList.length - 3;
      index++
    ) {
      if (rsiWithPriceList[index].closePrice > topsTouchingLine[index]) {
        noCandlesBrokeTopsTouchingLine = false;
      }
    }

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

    let lowerTimeFrame = ChartTimeFrame.FIFTEEN_MINUTE;
    let lowerTimeFrameEventNumber = rsiSecondLowestBottom.eventNumber;
    if (timeFrame === ChartTimeFrame.ONE_HOUR) {
      lowerTimeFrameEventNumber = rsiSecondLowestBottom.eventNumber * 4;
    } else if (timeFrame === ChartTimeFrame.TWO_HOUR) {
      lowerTimeFrameEventNumber = rsiSecondLowestBottom.eventNumber * 8;
    } else if (timeFrame === ChartTimeFrame.FOUR_HOUR) {
      lowerTimeFrame = ChartTimeFrame.ONE_HOUR;
      lowerTimeFrameEventNumber = rsiSecondLowestBottom.eventNumber * 4;
    }

    if (rsiBullishDivergenceFormed) {
      return <AnalyzeResult>{
        symbol: symbol,
        strategy: AnalyzeStrategy.RSI_DIVERGENCE,
        direction: TrendDirection.BULLISH,
        timeFrame: timeFrame,
        lowerTimeFrame: lowerTimeFrame,
        eventNumber: rsiSecondLowestBottom.eventNumber,
        lowerTimeFrameEventNumber: lowerTimeFrameEventNumber,
        rsiValue: rsiSecondLowestBottom.rsiValue,
        targetPrice: rsiSecondLowestBottom.closePrice,
      };
    } else if (rsiBearishDivergenceFormed) {
      return <AnalyzeResult>{
        symbol: symbol,
        strategy: AnalyzeStrategy.RSI_DIVERGENCE,
        direction: TrendDirection.BEARISH,
        timeFrame: timeFrame,
        lowerTimeFrame: lowerTimeFrame,
        eventNumber: rsiSecondHighestTop.eventNumber,
        lowerTimeFrameEventNumber: lowerTimeFrameEventNumber,
        rsiValue: rsiSecondHighestTop.rsiValue,
        targetPrice: rsiSecondHighestTop.closePrice,
      };
    } else {
      return null;
    }
  } else {
    return null;
  }
}

export function rsiTripleDivergenceFormed(
  candleData: PriceRecordDto[],
  rsiResults: number[],
  lastDivergence: AnalyzeResult
): boolean {
  let percentageLimit = getPercentageLimit(lastDivergence.timeFrame);

  if (lastDivergence.direction === TrendDirection.BULLISH) {
    // bullish logic
    let rsiLowestBottom: RsiWithPrice = {
      rsiValue: lastDivergence.rsiValue,
      eventNumber: lastDivergence.eventNumber,
      closePrice: lastDivergence.targetPrice,
    };

    let rsiSecondLowestBottom: RsiWithPrice = {
      rsiValue: rsiResults[rsiResults.length - 3],
      eventNumber: candleData[candleData.length - 3].event_number,
      closePrice: candleData[candleData.length - 3].close,
    };

    // 1st condition
    let lastClosedCandleFormedSecondLowestBottom =
      rsiResults[rsiResults.length - 2] > rsiResults[rsiResults.length - 3] &&
      rsiResults[rsiResults.length - 3] < rsiResults[rsiResults.length - 4] &&
      rsiResults[rsiResults.length - 4] < rsiResults[rsiResults.length - 5];

    // 3rd condition
    let bottomsHasEnoughCandleGap =
      rsiSecondLowestBottom.eventNumber - rsiLowestBottom.eventNumber > 10;

    // 4th condition
    let rsiBottomsShowAscendingOrder =
      rsiSecondLowestBottom.rsiValue > rsiLowestBottom.rsiValue;

    // 5th condition
    let pricesShowDescendingOrder =
      rsiSecondLowestBottom.closePrice < rsiLowestBottom.closePrice;

    // 6th condition
    let noCandlesClosedBelowRsiSecondLowestBottom = true;

    for (
      let index = candleData.length - 4;
      candleData[index].event_number > rsiLowestBottom.eventNumber;
      index--
    ) {
      if (candleData[index].close < rsiSecondLowestBottom.closePrice) {
        noCandlesClosedBelowRsiSecondLowestBottom = false;
      }
    }

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

    let rsiBullishDivergenceFormed =
      bottomsHasEnoughCandleGap &&
      rsiBottomsShowAscendingOrder &&
      pricesShowDescendingOrder &&
      lastClosedCandleFormedSecondLowestBottom &&
      noCandlesClosedBelowRsiSecondLowestBottom &&
      rsiBottomValuesOrPricesHasConsiderableDiff;

    if (rsiBullishDivergenceFormed) {
      return true;
    } else {
      return false;
    }
  } else {
    // bearish logic
    let rsiHighestTop: RsiWithPrice = {
      rsiValue: lastDivergence.rsiValue,
      eventNumber: lastDivergence.eventNumber,
      closePrice: lastDivergence.targetPrice,
    };

    let rsiSecondHighestTop: RsiWithPrice = {
      rsiValue: rsiResults[rsiResults.length - 3],
      eventNumber: candleData[candleData.length - 3].event_number,
      closePrice: candleData[candleData.length - 3].close,
    };

    // 1st condition
    let lastClosedCandleFormedLowerHigh =
      rsiResults[rsiResults.length - 2] < rsiResults[rsiResults.length - 3] &&
      rsiResults[rsiResults.length - 3] > rsiResults[rsiResults.length - 4] &&
      rsiResults[rsiResults.length - 4] > rsiResults[rsiResults.length - 5];

    // 3rd condition
    let topsHasEnoughCandleGap =
      rsiSecondHighestTop.eventNumber - rsiHighestTop.eventNumber > 10;

    // 4th condition
    let rsiTopsShowDescendingOrder =
      rsiHighestTop.rsiValue > rsiSecondHighestTop.rsiValue;

    // 5th condition
    let pricesShowAscendingOrder =
      rsiSecondHighestTop.closePrice > rsiHighestTop.closePrice;

    // 6th condition
    let noCandlesClosedAboveRsiSecondHighestTop = true;

    for (
      let index = candleData.length - 4;
      candleData[index].event_number > rsiHighestTop.eventNumber;
      index--
    ) {
      if (candleData[index].close > rsiSecondHighestTop.closePrice) {
        noCandlesClosedAboveRsiSecondHighestTop = false;
      }
    }

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

    let rsiBearishDivergenceFormed =
      topsHasEnoughCandleGap &&
      rsiTopsShowDescendingOrder &&
      pricesShowAscendingOrder &&
      lastClosedCandleFormedLowerHigh &&
      noCandlesClosedAboveRsiSecondHighestTop &&
      rsiTopsValuesOrPricesHasConsiderableDiff;

    if (rsiBearishDivergenceFormed) {
      return true;
    } else {
      return false;
    }
  }
}

function getPercentageLimit(timeFrame: ChartTimeFrame) {
  let percentageLimit = 1;

  if (timeFrame === ChartTimeFrame.THIRTY_MINUTE) {
    percentageLimit = 2;
  } else if (timeFrame === ChartTimeFrame.ONE_HOUR) {
    percentageLimit = 4;
  } else if (timeFrame === ChartTimeFrame.TWO_HOUR) {
    percentageLimit = 6;
  } else if (timeFrame === ChartTimeFrame.FOUR_HOUR) {
    percentageLimit = 10;
  } else if (timeFrame === ChartTimeFrame.TWELVE_HOUR) {
    percentageLimit = 15;
  } else if (timeFrame === ChartTimeFrame.ONE_DAY) {
    percentageLimit = 20;
  }
  return percentageLimit;
}
