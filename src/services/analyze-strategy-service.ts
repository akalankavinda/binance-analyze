import { BollingerBandsOutput } from "technicalindicators/declarations/volatility/BollingerBands";
import { ChartTimeFrame } from "../enums/chart-timeframes.enum";
import { RsiWithPrice } from "../models/rsi-with-price.mode";
import { AnalyzeResult } from "../models/analyze-result.model";
import { AnalyzeStrategy } from "../enums/analyze-strategies.enum";
import { TrendDirection } from "../enums/trend-direction.enum";
import { PriceRecordDto } from "../models/price-record.dto";
import { time } from "console";
import { AnalyzedCandidate } from "../models/analyzed-candidate.model";

export class AnalyzeStrategyService {
  // singleton
  private static _instance: AnalyzeStrategyService;
  public static getInstance() {
    return this._instance || (this._instance = new this());
  }

  private analyzedCandidates: AnalyzedCandidate[] = [];

  public findOpportunity(
    symbol: string,
    timeFrame: ChartTimeFrame,
    candleData: PriceRecordDto[],
    closingPrices: number[],
    rsiResults: number[],
    bbResults: BollingerBandsOutput[]
  ): AnalyzeResult | null {
    let rsiDivergenceOpportunity = this.findRsiDivergenceOpportunity(
      symbol,
      timeFrame,
      closingPrices,
      rsiResults,
      candleData[candleData.length - 1].event_number
    );
    if (rsiDivergenceOpportunity) {
      // this.pushToCandidateList(<AnalyzedCandidate>{
      //   analyzeResult: rsiDivergenceOpportunity,
      //   eventNumber: candleData[candleData.length - 1].event_number,
      // });
      return rsiDivergenceOpportunity;
    }

    let bbOpportunity = this.findBollingerBandOpportunity(
      symbol,
      timeFrame,
      closingPrices,
      bbResults,
      rsiResults,
      candleData[candleData.length - 1].event_number
    );
    if (bbOpportunity) {
      this.pushToCandidateList(<AnalyzedCandidate>{
        analyzeResult: bbOpportunity,
        eventNumber: candleData[candleData.length - 1].event_number,
      });
    }

    let analyzedResult: AnalyzeResult | null = null;

    this.analyzedCandidates.forEach((candidate, index) => {
      let symbolMatched = symbol === candidate.analyzeResult.symbol;
      let timeFrameMatched = timeFrame === candidate.analyzeResult.timeFrame;
      let tooLate =
        candleData[candleData.length - 1].event_number - candidate.eventNumber >
        10;
      if (tooLate) {
        this.analyzedCandidates.splice(index, 1);
      } else {
        if (symbolMatched && timeFrameMatched) {
          let hasFormedSwingHighOrLow = this.formedSwingHighOrLow(
            candleData,
            candidate
          );
          if (hasFormedSwingHighOrLow) {
            analyzedResult = candidate.analyzeResult;
            this.analyzedCandidates.splice(index, 1);
          }
        }
      }
    });

    return analyzedResult;
  }

  private pushToCandidateList(newCandidate: AnalyzedCandidate): void {
    let alreadyInTheList = false;
    let listIndex = -1;
    this.analyzedCandidates.forEach((item, index) => {
      if (
        item.analyzeResult.strategy === newCandidate.analyzeResult.strategy &&
        item.analyzeResult.timeFrame === newCandidate.analyzeResult.timeFrame &&
        item.analyzeResult.direction === newCandidate.analyzeResult.direction
      ) {
        alreadyInTheList = true;
        listIndex = index;
      }
    });
    if (alreadyInTheList) {
      this.analyzedCandidates[listIndex] = newCandidate;
    } else {
      this.analyzedCandidates.push(newCandidate);
    }
  }

  private findRsiDivergenceOpportunity(
    symbol: string,
    timeFrame: ChartTimeFrame,
    closingPrices: number[],
    rsiResults: number[],
    eventNumber: number
  ): AnalyzeResult | null {
    if (rsiResults.length > 80) {
      //

      let rsiWithPriceList: RsiWithPrice[] = [];

      for (let index = 1; index < 66; index++) {
        rsiWithPriceList.push({
          rsiValue: rsiResults[rsiResults.length - index],
          closePrice: closingPrices[closingPrices.length - index],
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
        closePrice: closingPrices[rsiResults.length - 3],
        candleIndex: rsiResults.length - 3,
      };

      let lastClosedCandleFormedShallowBottom =
        rsiResults[rsiResults.length - 2] > rsiResults[rsiResults.length - 3] &&
        rsiResults[rsiResults.length - 3] < rsiResults[rsiResults.length - 4] &&
        rsiResults[rsiResults.length - 4] < rsiResults[rsiResults.length - 5];

      let bottomsAreInOversoldRegion =
        lowestBottom.rsiValue < 27 && secondLowestBottom.rsiValue < 37;

      let bottomsHasEnoughCandleGap =
        secondLowestBottom.candleIndex - lowestBottom.candleIndex > 10;

      let rsiBottomsShowAscendingOrder =
        secondLowestBottom.rsiValue > lowestBottom.rsiValue;

      let pricesShowDescendingOrder =
        secondLowestBottom.closePrice < lowestBottom.closePrice;

      let onePercentBelowPriceFromRsiLowestBottom =
        lowestBottom.closePrice - (lowestBottom.closePrice / 100) * 1;

      let rsiBottomsHasConsiderableDiff =
        secondLowestBottom.rsiValue > lowestBottom.rsiValue + 13;

      let bottomPricesHasConsiderableDiff =
        secondLowestBottom.closePrice < onePercentBelowPriceFromRsiLowestBottom;

      let rsiBottomValuesOrPricesHasConsiderableDiff =
        bottomPricesHasConsiderableDiff || rsiBottomsHasConsiderableDiff;

      let rsiBullishDivergenceFormed =
        bottomsAreInOversoldRegion &&
        bottomsHasEnoughCandleGap &&
        rsiBottomsShowAscendingOrder &&
        pricesShowDescendingOrder &&
        lastClosedCandleFormedShallowBottom &&
        rsiBottomValuesOrPricesHasConsiderableDiff;

      // bearish logic
      let highestTop: RsiWithPrice = rsiWithPriceList[0];
      rsiWithPriceList.forEach((item) => {
        if (item.rsiValue > highestTop.rsiValue) {
          highestTop = item;
        }
      });

      let secondHighestTop: RsiWithPrice = {
        rsiValue: rsiResults[rsiResults.length - 3],
        closePrice: closingPrices[rsiResults.length - 3],
        candleIndex: rsiResults.length - 3,
      };

      let lastClosedCandleFormedLowerHigh =
        rsiResults[rsiResults.length - 2] < rsiResults[rsiResults.length - 3] &&
        rsiResults[rsiResults.length - 3] > rsiResults[rsiResults.length - 4] &&
        rsiResults[rsiResults.length - 4] > rsiResults[rsiResults.length - 5];

      let topsAreInOverboughtRegion =
        highestTop.rsiValue > 73 && secondHighestTop.rsiValue > 63;

      let topsHasEnoughCandleGap =
        secondHighestTop.candleIndex - highestTop.candleIndex > 10;

      let rsiTopsShowDescendingOrder =
        highestTop.rsiValue > secondHighestTop.rsiValue;

      let pricesShowAscendingOrder =
        secondHighestTop.closePrice > highestTop.closePrice;

      let onePercentAbovePriceFromRsiHighestTop =
        highestTop.closePrice + (highestTop.closePrice / 100) * 1;

      let rsiTopsHasConsiderableDiff =
        secondHighestTop.rsiValue < highestTop.rsiValue - 13;

      let topsPricesHasConsiderableDiff =
        secondHighestTop.closePrice > onePercentAbovePriceFromRsiHighestTop;

      let rsiTopsValuesOrPricesHasConsiderableDiff =
        topsPricesHasConsiderableDiff || rsiTopsHasConsiderableDiff;

      let rsiBearishDivergenceFormed =
        topsAreInOverboughtRegion &&
        topsHasEnoughCandleGap &&
        rsiTopsShowDescendingOrder &&
        pricesShowAscendingOrder &&
        lastClosedCandleFormedLowerHigh &&
        rsiTopsValuesOrPricesHasConsiderableDiff;

      if (rsiBullishDivergenceFormed) {
        return <AnalyzeResult>{
          symbol: symbol,
          strategy: AnalyzeStrategy.RSI_DIVERGENCE,
          direction: TrendDirection.BULLISH,
          timeFrame: timeFrame,
          eventNumber: eventNumber,
        };
      } else if (rsiBearishDivergenceFormed) {
        return <AnalyzeResult>{
          symbol: symbol,
          strategy: AnalyzeStrategy.RSI_DIVERGENCE,
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

  private findBollingerBandOpportunity(
    symbol: string,
    timeFrame: ChartTimeFrame,
    closingPrices: number[],
    bbResults: BollingerBandsOutput[],
    rsiResults: number[],
    eventNumber: number
  ): AnalyzeResult | null {
    let timeFrameIsAbove1h =
      timeFrame == ChartTimeFrame.THIRTY_MINUTE ||
      timeFrame == ChartTimeFrame.ONE_HOUR ||
      timeFrame == ChartTimeFrame.TWO_HOUR ||
      timeFrame == ChartTimeFrame.FOUR_HOUR ||
      timeFrame == ChartTimeFrame.TWELVE_HOUR ||
      timeFrame == ChartTimeFrame.ONE_DAY;

    if (bbResults.length > 60 && timeFrameIsAbove1h) {
      let currentRsiValue = rsiResults[rsiResults.length - 2];
      let currentBbValue = bbResults[bbResults.length - 2];
      let currentTradingPrice = closingPrices[closingPrices.length - 2];

      let bbCurrentLowerLimit =
        currentBbValue.middle -
        ((currentBbValue.middle - currentBbValue.lower) / 100) * 90;
      let bbLoweBandLowerLimit =
        currentBbValue.middle -
        ((currentBbValue.middle - currentBbValue.lower) / 100) * 120;

      let bbCurrentIsBelowLimit =
        currentTradingPrice < bbCurrentLowerLimit &&
        currentTradingPrice > bbLoweBandLowerLimit &&
        currentTradingPrice < currentBbValue.lower &&
        currentRsiValue < 27;

      // bearish logic

      let bbCurrentUpperLimit =
        currentBbValue.middle +
        ((currentBbValue.upper - currentBbValue.middle) / 100) * 90;

      let bbUpperBandUpperLimit =
        currentBbValue.middle +
        ((currentBbValue.upper - currentBbValue.middle) / 100) * 120;

      let bbCurrentIsAboveLimit =
        currentTradingPrice > bbCurrentUpperLimit &&
        currentTradingPrice < bbUpperBandUpperLimit &&
        currentTradingPrice > currentBbValue.upper &&
        currentRsiValue > 73;

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

  private formedSwingHighOrLow(
    candlestickData: PriceRecordDto[],
    candidate: AnalyzedCandidate
  ): boolean {
    let direction = candidate.analyzeResult.direction;

    if (candlestickData.length > 5) {
      let selectedCandlePrev = candlestickData[candlestickData.length - 4];
      let selectedCandle = candlestickData[candlestickData.length - 3];
      let selectedCandleNext = candlestickData[candlestickData.length - 2];

      if (direction === TrendDirection.BULLISH) {
        if (
          selectedCandle.low < selectedCandlePrev.low &&
          selectedCandle.low < selectedCandleNext.low
        ) {
          return true;
        } else return false;
      } else if (direction === TrendDirection.BEARISH) {
        if (
          selectedCandle.high > selectedCandlePrev.high &&
          selectedCandle.high > selectedCandleNext.high
        ) {
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
