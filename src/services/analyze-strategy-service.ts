import { BollingerBandsOutput } from "technicalindicators/declarations/volatility/BollingerBands";
import { ChartTimeFrame } from "../enums/chart-timeframes.enum";
import { RsiWithPrice } from "../models/rsi-with-price.mode";
import { AnalyzeResult } from "../models/analyze-result.model";
import { AnalyzeStrategy } from "../enums/analyze-strategies.enum";
import { TrendDirection } from "../enums/trend-direction.enum";
import { PriceRecordDto } from "../models/price-record.dto";
import { time } from "console";
import { AnalyzedCandidate } from "../models/analyzed-candidate.model";
import { LogWriterService } from "./log-writer.service";

export class AnalyzeStrategyService {
  // singleton
  private static _instance: AnalyzeStrategyService;
  public static getInstance() {
    return this._instance || (this._instance = new this());
  }

  private logWriter = LogWriterService.getInstance();

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
    if (rsiResults.length > 70) {
      //

      let rsiWithPriceList: RsiWithPrice[] = [];

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

      for (let index = 1; index < 66; index++) {
        rsiWithPriceList.unshift({
          rsiValue: rsiResults[rsiResults.length - index],
          closePrice: closingPrices[closingPrices.length - index],
          candleIndex: rsiResults.length - index,
        });
      }

      // bullish logic
      let rsiLowestBottomIndex = rsiWithPriceList.length - 1;
      let rsiLowestBottom: RsiWithPrice =
        rsiWithPriceList[rsiLowestBottomIndex];

      rsiWithPriceList.forEach((item, index) => {
        if (item.rsiValue < rsiLowestBottom.rsiValue) {
          rsiLowestBottom = item;
          rsiLowestBottomIndex = index;
        }
      });

      let rsiSecondLowestBottom: RsiWithPrice =
        rsiWithPriceList[rsiWithPriceList.length - 3];

      let lastClosedCandleFormedSecondLowestBottom =
        rsiResults[rsiResults.length - 2] > rsiResults[rsiResults.length - 3] &&
        rsiResults[rsiResults.length - 3] < rsiResults[rsiResults.length - 4] &&
        rsiResults[rsiResults.length - 4] < rsiResults[rsiResults.length - 5];

      let noCandlesBetweenRsiBottomsClosedBelowCurrentPrice = true;

      for (
        let index = rsiLowestBottomIndex + 1;
        index < rsiWithPriceList.length - 3;
        index++
      ) {
        if (
          rsiWithPriceList[index].closePrice < rsiSecondLowestBottom.closePrice
        ) {
          noCandlesBetweenRsiBottomsClosedBelowCurrentPrice = false;
        }
      }

      let bottomsAreInOversoldRegion =
        rsiLowestBottom.rsiValue < 27 && rsiSecondLowestBottom.rsiValue < 37;

      let bottomsHasEnoughCandleGap =
        rsiSecondLowestBottom.candleIndex - rsiLowestBottom.candleIndex > 10;

      let rsiBottomsShowAscendingOrder =
        rsiSecondLowestBottom.rsiValue > rsiLowestBottom.rsiValue;

      let pricesShowDescendingOrder =
        rsiSecondLowestBottom.closePrice < rsiLowestBottom.closePrice;

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
        bottomsAreInOversoldRegion &&
        bottomsHasEnoughCandleGap &&
        rsiBottomsShowAscendingOrder &&
        pricesShowDescendingOrder &&
        lastClosedCandleFormedSecondLowestBottom &&
        noCandlesBetweenRsiBottomsClosedBelowCurrentPrice &&
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

      let lastClosedCandleFormedLowerHigh =
        rsiResults[rsiResults.length - 2] < rsiResults[rsiResults.length - 3] &&
        rsiResults[rsiResults.length - 3] > rsiResults[rsiResults.length - 4] &&
        rsiResults[rsiResults.length - 4] > rsiResults[rsiResults.length - 5];

      let noCandlesBetweenRsiTopsClosedAboveCurrentPrice = true;

      for (
        let index = rsiHighestTopIndex + 1;
        index < rsiWithPriceList.length - 3;
        index++
      ) {
        if (
          rsiWithPriceList[index].closePrice > rsiSecondHighestTop.closePrice
        ) {
          noCandlesBetweenRsiTopsClosedAboveCurrentPrice = false;
        }
      }

      let topsAreInOverboughtRegion =
        rsiHighestTop.rsiValue > 73 && rsiSecondHighestTop.rsiValue > 63;

      let topsHasEnoughCandleGap =
        rsiSecondHighestTop.candleIndex - rsiHighestTop.candleIndex > 10;

      let rsiTopsShowDescendingOrder =
        rsiHighestTop.rsiValue > rsiSecondHighestTop.rsiValue;

      let pricesShowAscendingOrder =
        rsiSecondHighestTop.closePrice > rsiHighestTop.closePrice;

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
        topsAreInOverboughtRegion &&
        topsHasEnoughCandleGap &&
        rsiTopsShowDescendingOrder &&
        pricesShowAscendingOrder &&
        lastClosedCandleFormedLowerHigh &&
        noCandlesBetweenRsiTopsClosedAboveCurrentPrice &&
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

    if (bbResults.length > 5 && timeFrameIsAbove1h) {
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

      let timeFrameWeightA = 1;
      let timeFrameWeightB = 1;

      if (a.timeFrame === ChartTimeFrame.ONE_HOUR) {
        timeFrameWeightA = 1.1;
      } else if (a.timeFrame === ChartTimeFrame.TWO_HOUR) {
        timeFrameWeightA = 1.2;
      } else if (a.timeFrame === ChartTimeFrame.FOUR_HOUR) {
        timeFrameWeightA = 1.4;
      } else if (
        a.timeFrame === ChartTimeFrame.TWELVE_HOUR ||
        a.timeFrame === ChartTimeFrame.ONE_DAY
      ) {
        timeFrameWeightA = 1.5;
      }

      if (b.timeFrame === ChartTimeFrame.ONE_HOUR) {
        timeFrameWeightB = 1.1;
      } else if (b.timeFrame === ChartTimeFrame.TWO_HOUR) {
        timeFrameWeightB = 1.2;
      } else if (b.timeFrame === ChartTimeFrame.FOUR_HOUR) {
        timeFrameWeightB = 1.4;
      } else if (
        b.timeFrame === ChartTimeFrame.TWELVE_HOUR ||
        b.timeFrame === ChartTimeFrame.ONE_DAY
      ) {
        timeFrameWeightB = 1.5;
      }

      let sortCalculation: number =
        rsiValueB * b.bollingerBandPercentage * timeFrameWeightB -
        rsiValueA * a.bollingerBandPercentage * timeFrameWeightA;

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
