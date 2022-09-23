import { BollingerBandsOutput } from "technicalindicators/declarations/volatility/BollingerBands";
import { ChartTimeframe } from "../enums/chart-timeframes.enum";
import { RsiWithPrice } from "../models/rsi-with-price.mode";
import { AnalyzeResult } from "../models/analyze-result.model";
import { AnalyzeStrategy } from "../enums/analyze-strategies.enum";
import { TrendDirection } from "../enums/trend-direction.enum";
import { PriceRecordDto } from "../models/price-record.dto";
import { time } from "console";

export class AnalyzeStrategyService {
  // singleton
  private static _instance: AnalyzeStrategyService;
  public static getInstance() {
    return this._instance || (this._instance = new this());
  }

  public findOppoprtunity(
    symbol: string,
    timeFrame: ChartTimeframe,
    candleData: PriceRecordDto[],
    inputValues: number[],
    rsiResults: number[],
    bbResults: BollingerBandsOutput[]
  ): AnalyzeResult | null {
    let swingPatternConfirmed = false;
    let rsiDivergenceOpportunity = this.findRsiDivergenceOpportunity(
      symbol,
      timeFrame,
      inputValues,
      rsiResults
    );
    swingPatternConfirmed = this.formedSwingHighOrLow(
      candleData,
      rsiDivergenceOpportunity?.direction
    );

    if (rsiDivergenceOpportunity && swingPatternConfirmed) {
      return rsiDivergenceOpportunity;
    }

    let rsiOpportunity = this.findRsiOpportunity(symbol, timeFrame, rsiResults);
    let bbOpportunity = this.findBollingerBandOpportunity(
      symbol,
      timeFrame,
      inputValues,
      bbResults,
      rsiResults
    );
    swingPatternConfirmed = this.formedSwingHighOrLow(
      candleData,
      bbOpportunity?.direction
    );

    // return this.overExtendedCandle(symbol, timeFrame, candleData, bbResults);

    if (rsiOpportunity && bbOpportunity && swingPatternConfirmed) {
      return <AnalyzeResult>{
        symbol: rsiOpportunity.symbol,
        strategy: AnalyzeStrategy.RSI_WITH_BB,
        direction: rsiOpportunity.direction,
        timeFrame: rsiOpportunity.timeFrame,
      };
    } else {
      return null;
    }
  }

  private findRsiOpportunity(
    symbol: string,
    timeFrame: ChartTimeframe,
    rsiResults: number[]
  ): AnalyzeResult | null {
    if (rsiResults.length > 10) {
      let lastClosed2ndRsiValue = rsiResults[rsiResults.length - 5];
      let lastClosedValue = rsiResults[rsiResults.length - 4];
      let selectedCandle = rsiResults[rsiResults.length - 3];

      if (selectedCandle < 27.5) {
        return <AnalyzeResult>{
          symbol: symbol,
          strategy: AnalyzeStrategy.RSI,
          direction: TrendDirection.BULLISH,
          timeFrame: timeFrame,
        };
      } else if (selectedCandle > 72.5) {
        return <AnalyzeResult>{
          symbol: symbol,
          strategy: AnalyzeStrategy.RSI,
          direction: TrendDirection.BEARISH,
          timeFrame: timeFrame,
        };
      } else {
        return null;
      }
    } else {
      return null;
    }
  }

  private findRsiDivergenceOpportunity(
    symbol: string,
    timeFrame: ChartTimeframe,
    inputValues: number[],
    rsiResults: number[]
  ): AnalyzeResult | null {
    if (rsiResults.length > 55) {
      //

      let rsiWithPriceList: RsiWithPrice[] = [];

      for (let index = 1; index < 50; index++) {
        rsiWithPriceList.push({
          rsiValue: rsiResults[rsiResults.length - index],
          closePrice: inputValues[inputValues.length - index],
          candleIndex: rsiResults.length - index,
        });
      }

      // bullish logic
      let lowestBottom: RsiWithPrice = rsiWithPriceList[0];
      rsiWithPriceList.forEach((item) => {
        if (item.rsiValue < lowestBottom.rsiValue) {
          lowestBottom = item;
        }
      });

      let secondLowestBottom: RsiWithPrice = {
        rsiValue: rsiResults[rsiResults.length - 3],
        closePrice: inputValues[rsiResults.length - 3],
        candleIndex: rsiResults.length - 3,
      };

      let lastClosedCandleFormedShallowBottom =
        rsiResults[rsiResults.length - 2] > rsiResults[rsiResults.length - 3] &&
        rsiResults[rsiResults.length - 3] < rsiResults[rsiResults.length - 4] &&
        rsiResults[rsiResults.length - 4] < rsiResults[rsiResults.length - 5];

      let bottomsAreInOversoldRegion =
        lowestBottom.rsiValue < 30 && secondLowestBottom.rsiValue < 35;

      let bottomsHasEnoughCandleGap =
        secondLowestBottom.candleIndex - lowestBottom.candleIndex > 5;

      let rsiBottomsShowAscendingOrder =
        secondLowestBottom.rsiValue > lowestBottom.rsiValue + 1;

      let pricesShowDescendingOrder =
        secondLowestBottom.closePrice < lowestBottom.closePrice;

      let rsiBullishDivergenceFormed =
        bottomsAreInOversoldRegion &&
        bottomsHasEnoughCandleGap &&
        rsiBottomsShowAscendingOrder &&
        pricesShowDescendingOrder &&
        lastClosedCandleFormedShallowBottom;

      // bearish logic
      let highestTop: RsiWithPrice = rsiWithPriceList[0];
      rsiWithPriceList.forEach((item) => {
        if (item.rsiValue > highestTop.rsiValue) {
          highestTop = item;
        }
      });

      let secondHighestTop: RsiWithPrice = {
        rsiValue: rsiResults[rsiResults.length - 3],
        closePrice: inputValues[rsiResults.length - 3],
        candleIndex: rsiResults.length - 3,
      };

      let lastClosedCandleFormedLowerHigh =
        rsiResults[rsiResults.length - 2] < rsiResults[rsiResults.length - 3] &&
        rsiResults[rsiResults.length - 3] > rsiResults[rsiResults.length - 4] &&
        rsiResults[rsiResults.length - 4] > rsiResults[rsiResults.length - 5];

      let topsAreInOverboughtRegion =
        highestTop.rsiValue > 70 && secondHighestTop.rsiValue > 65;

      let topsHasEnoughCandleGap =
        secondHighestTop.candleIndex - highestTop.candleIndex > 5;

      let rsiTopsShowDescendingOrder =
        highestTop.rsiValue > secondHighestTop.rsiValue + 1;

      let pricesShowAscendingOrder =
        secondHighestTop.closePrice > highestTop.closePrice;

      let rsiBearishDivergenceFormed =
        topsAreInOverboughtRegion &&
        topsHasEnoughCandleGap &&
        rsiTopsShowDescendingOrder &&
        pricesShowAscendingOrder &&
        lastClosedCandleFormedLowerHigh;

      if (rsiBullishDivergenceFormed) {
        return <AnalyzeResult>{
          symbol: symbol,
          strategy: AnalyzeStrategy.RSI_DIVERGENCE,
          direction: TrendDirection.BULLISH,
          timeFrame: timeFrame,
        };
      } else if (rsiBearishDivergenceFormed) {
        return <AnalyzeResult>{
          symbol: symbol,
          strategy: AnalyzeStrategy.RSI_DIVERGENCE,
          direction: TrendDirection.BEARISH,
          timeFrame: timeFrame,
        };
      } else {
        return null;
      }
    } else {
      return null;
    }
  }

  private findBollingerBandOpportunity(
    symbol: string,
    timeFrame: ChartTimeframe,
    inputValues: number[],
    bbResults: BollingerBandsOutput[],
    rsiResults: number[]
  ): AnalyzeResult | null {
    let timeFrameIsAbove1h =
      timeFrame == ChartTimeframe.ONE_HOUR ||
      timeFrame == ChartTimeframe.TWO_HOUR ||
      timeFrame == ChartTimeframe.FOUR_HOUR ||
      timeFrame == ChartTimeframe.TWELVE_HOUR ||
      timeFrame == ChartTimeframe.ONE_DAY;

    if (bbResults.length > 60 && timeFrameIsAbove1h) {
      let bbLowerValues: number[] = [];
      let bbUpperValues: number[] = [];

      for (let index = 55; index > 0; index--) {
        bbLowerValues.push(bbResults[bbResults.length - index].lower);
        bbUpperValues.push(bbResults[bbResults.length - index].upper);
      }

      let currentRsiValue = rsiResults[rsiResults.length - 2];
      let currentBbValue = bbResults[bbResults.length - 2];
      let currentTradingPrice = inputValues[inputValues.length - 2];

      // let bbCurrentlowerLimit =
      //   currentBbValue.middle -
      //   ((currentBbValue.middle - currentBbValue.lower) / 100) * 95;
      // let bbLoweBandLowerLimit =
      //   currentBbValue.middle -
      //   ((currentBbValue.middle - currentBbValue.lower) / 100) * 120;

      let bbCurrentIsBelowLimit =
        // currentTradingPrice < bbCurrentlowerLimit &&
        // currentTradingPrice > bbLoweBandLowerLimit &&
        currentTradingPrice < currentBbValue.lower && currentRsiValue < 27;

      // bearish logic

      // let bbCurrentUpperLimit =
      //   currentBbValue.middle +
      //   ((currentBbValue.upper - currentBbValue.middle) / 100) * 95;

      // let bbUpperBandUpperLimit =
      //   currentBbValue.middle +
      //   ((currentBbValue.upper - currentBbValue.middle) / 100) * 120;

      let bbCurrentIsAboveLimit =
        // currentTradingPrice > bbCurrentUpperLimit &&
        // currentTradingPrice < bbUpperBandUpperLimit &&
        currentTradingPrice > currentBbValue.upper && currentRsiValue > 73;

      if (bbCurrentIsBelowLimit) {
        return <AnalyzeResult>{
          symbol: symbol,
          strategy: AnalyzeStrategy.BOLLINGER_BAND,
          direction: TrendDirection.BULLISH,
          timeFrame: timeFrame,
        };
      } else if (bbCurrentIsAboveLimit) {
        return <AnalyzeResult>{
          symbol: symbol,
          strategy: AnalyzeStrategy.BOLLINGER_BAND,
          direction: TrendDirection.BEARISH,
          timeFrame: timeFrame,
        };
      } else {
        return null;
      }
    } else {
      return null;
    }
  }

  private formedSwingHighOrLow(
    candlestickData: PriceRecordDto[],
    direction?: TrendDirection
  ): boolean {
    if (candlestickData.length > 5 && direction != null) {
      let selectedCandlePrev = candlestickData[candlestickData.length - 4];
      let selectedCandle = candlestickData[candlestickData.length - 3];
      let selectedCandleNext = candlestickData[candlestickData.length - 2];

      if (direction === TrendDirection.BULLISH) {
        if (selectedCandle.close < selectedCandleNext.close) {
          return true;
        } else return false;
      } else if (direction === TrendDirection.BEARISH) {
        if (selectedCandle.close > selectedCandleNext.close) {
          return true;
        } else return false;
      } else {
        return false;
      }
    }
    return false;
  }

  private linearRegressionHasTrend(
    trend: TrendDirection,
    trendLineData: number[],
    candleCount: number
  ) {
    let sum_x = 0;
    let sum_y = 0;
    let sum_xy = 0;
    let sum_xx = 0;
    let count = 0;

    /*
     * We'll use those variables for faster read/write access.
     */
    let x = 0;
    let y = 0;
    let values_length = trendLineData.length;

    /*
     * Calculate the sum for each of the parts necessary.
     */
    for (var v = candleCount; v > 0; v--) {
      x = trendLineData.length - v;
      y = trendLineData[trendLineData.length - v];
      sum_x += x;
      sum_y += y;
      sum_xx += x * x;
      sum_xy += x * y;
      count++;
    }

    /*
     * Calculate m and b for the formular:
     * y = x * m + b
     */
    var m = (count * sum_xy - sum_x * sum_y) / (count * sum_xx - sum_x * sum_x);
    var b = sum_y / count - (m * sum_x) / count;

    /*
     * We will make the x and y result line now
     */
    //var result_values_x = [];
    var result_values_y = [];

    for (var v = 0; v < values_length; v++) {
      x = v;
      y = x * m + b;
      //result_values_x.push(x);
      result_values_y.push(y);
    }

    if (
      trend === TrendDirection.BULLISH &&
      result_values_y[result_values_y.length - 1] > result_values_y[0]
    ) {
      return true;
    } else if (
      trend === TrendDirection.BEARISH &&
      result_values_y[result_values_y.length - 1] < result_values_y[0]
    ) {
      return true;
    } else {
      return false;
    }
  }

  public findBollingerBandPercentage(
    direction: TrendDirection,
    tradingPrice: number,
    bbValue: BollingerBandsOutput
  ): number {
    if (direction === TrendDirection.BULLISH) {
      return (
        ((bbValue.middle - tradingPrice) / (bbValue.middle - bbValue.lower)) *
        100
      );
    } else if (direction === TrendDirection.BEARISH) {
      return (
        ((tradingPrice - bbValue.middle) / (bbValue.upper - bbValue.middle)) *
        100
      );
    } else {
      return 0;
    }
  }

  public filterBestOpportunities(
    opportunityList: AnalyzeResult[],
    limit: number = 1
  ) {
    // remove bearish trending items
    // let filteredBullishList = opportunityList.filter(
    //   (item) => item.direction === TrendDirection.BULLISH
    // );
    // let filteredBearishList = opportunityList.filter(
    //   (item) => item.direction === TrendDirection.BEARISH
    // );

    opportunityList.sort(function (a, b) {
      // descending sort

      let rsiValueA =
        a.direction === TrendDirection.BULLISH ? 100 - a.rsiValue : a.rsiValue;
      let rsiValueB =
        b.direction === TrendDirection.BULLISH ? 100 - b.rsiValue : b.rsiValue;

      let sortCalculation: number =
        rsiValueB * b.bollingerBandPercentage -
        rsiValueA * a.bollingerBandPercentage;

      return sortCalculation;
    });

    // filteredBullishList.sort(function (a, b) {
    //   // descending sort
    //   let calculatedValue: number =
    //     (100 - b.rsiValue) * b.bollingerBandPercentage -
    //     (100 - a.rsiValue) * a.bollingerBandPercentage;

    //   return calculatedValue;
    // });

    // filteredBearishList.sort(function (a, b) {
    //   // descending sort
    //   let calculatedValue: number =
    //     a.rsiValue * a.bollingerBandPercentage -
    //     b.rsiValue * b.bollingerBandPercentage;
    //   return calculatedValue;
    // });

    // let combinedList = filteredBullishList
    //   .splice(0, limit)
    //   .concat(filteredBearishList.splice(0, limit));

    return opportunityList.splice(0, limit);
  }
}
