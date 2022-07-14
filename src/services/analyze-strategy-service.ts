import { BollingerBandsOutput } from "technicalindicators/declarations/volatility/BollingerBands";
import { ChartTimeframe } from "../enums/chart-timeframes.enum";
import { BearishCandidate } from "../models/bearish-candidate.model";
import { BullishCandidate } from "../models/bullish-candidate.model";
import { RsiWithPrice } from "../models/rsi-with-price.mode";
import { MessageConstructService } from "./message-construct-service";

export class AnalyzeStrategyService {
  // singleton
  private static _instance: AnalyzeStrategyService;
  public static getInstance() {
    return this._instance || (this._instance = new this());
  }

  private messageConstructService = MessageConstructService.getInstance();

  public rsiOverSoldAndTurningBullish(
    rsiResults: number[],
    symbol: string,
    timeFrame: ChartTimeframe
  ): boolean {
    if (rsiResults.length > 10) {
      let lastClosed2ndRsiValue = rsiResults[rsiResults.length - 3];
      let lastClosedValue = rsiResults[rsiResults.length - 2];
      let currentValue = rsiResults[rsiResults.length - 1];

      let lastClosed2ndCandleIsBearish =
        lastClosed2ndRsiValue > lastClosedValue;
      let lastClosedCandleIsOverSold = lastClosedValue < 27.5;
      let currentCandlesIsBullish = currentValue >= lastClosedValue + 2.5;
      let currentValueIsStillGoodToBuy = currentValue < 30;

      if (
        lastClosed2ndCandleIsBearish &&
        lastClosedCandleIsOverSold &&
        currentCandlesIsBullish &&
        currentValueIsStillGoodToBuy
      ) {
        return true;
      } else {
        return false;
      }
    } else {
      return false;
    }
  }

  public rsiBullishDivergenceFormed(
    inputValues: number[],
    rsiResults: number[],
    symbol: string,
    timeFrame: ChartTimeframe
  ): boolean {
    if (rsiResults.length > 55) {
      let rsiWithPriceList: RsiWithPrice[] = [];
      for (let index = 1; index < 50; index++) {
        rsiWithPriceList.push({
          rsiValue: rsiResults[rsiResults.length - index],
          closePrice: inputValues[inputValues.length - index],
          candleIndex: rsiResults.length - index,
        });
      }

      let deepBottom: RsiWithPrice = rsiWithPriceList[0];
      rsiWithPriceList.forEach((item) => {
        if (item.rsiValue < deepBottom.rsiValue) {
          deepBottom = item;
        }
      });

      let shallowBottom: RsiWithPrice = {
        rsiValue: rsiResults[rsiResults.length - 3],
        closePrice: inputValues[rsiResults.length - 3],
        candleIndex: rsiResults.length - 3,
      };

      let lastClosedCandleFormedShallowBottom =
        rsiResults[rsiResults.length - 1] > rsiResults[rsiResults.length - 2] &&
        rsiResults[rsiResults.length - 2] > rsiResults[rsiResults.length - 3] &&
        rsiResults[rsiResults.length - 3] < rsiResults[rsiResults.length - 4] &&
        rsiResults[rsiResults.length - 4] < rsiResults[rsiResults.length - 5];

      lastClosedCandleFormedShallowBottom ||=
        rsiResults[rsiResults.length - 1] > rsiResults[rsiResults.length - 2] &&
        rsiResults[rsiResults.length - 2] < rsiResults[rsiResults.length - 3] &&
        rsiResults[rsiResults.length - 3] > rsiResults[rsiResults.length - 4] &&
        rsiResults[rsiResults.length - 4] < rsiResults[rsiResults.length - 5] &&
        rsiResults[rsiResults.length - 5] < rsiResults[rsiResults.length - 6];

      let bottomsAreInOversoldRegion =
        deepBottom.rsiValue < 30 && shallowBottom.rsiValue < 35;

      let bottomsHasEnoughCandleGap =
        shallowBottom.candleIndex - deepBottom.candleIndex > 5;

      let rsiBottomsShowAccendingOrder =
        shallowBottom.rsiValue > deepBottom.rsiValue + 1;

      let pricesShowDescendingOrder =
        shallowBottom.closePrice <
        deepBottom.closePrice - (deepBottom.closePrice / 100) * 1;

      let rsiBullishDivergenceFormed =
        bottomsAreInOversoldRegion &&
        bottomsHasEnoughCandleGap &&
        rsiBottomsShowAccendingOrder &&
        pricesShowDescendingOrder &&
        lastClosedCandleFormedShallowBottom;

      // if (rsiBullishDivergenceFormed) {
      //   this.messageConstructService.notifyRsiBullishDivergence(
      //     symbol,
      //     timeFrame
      //   );
      // }

      return rsiBullishDivergenceFormed;
    } else {
      return false;
    }
  }

  public bollingerBandIsNotBearish(
    inputValues: number[],
    bbResults: BollingerBandsOutput[],
    symbol: string,
    timeFrame: ChartTimeframe,
    logMessage: boolean = false
  ): boolean {
    if (bbResults.length > 6) {
      // filter bearish trend along the bollinger band bottom
      let bearishCandleCount = 0;
      for (let index = 2; index < 5; index++) {
        let tmpPrice = inputValues[inputValues.length - index];
        let tmpBbLowerValue = bbResults[bbResults.length - index].lower;
        if (tmpPrice < tmpBbLowerValue) {
          bearishCandleCount += 1;
        }
      }

      let tradingBelowBbBottom = bearishCandleCount > 1;

      if (tradingBelowBbBottom && logMessage) {
        //this.messageConstructService.addToSessionBearishList(symbol, timeFrame);
      }

      return !tradingBelowBbBottom;
    } else {
      return false;
    }
  }

  public bollingerBandBullishBottom(
    inputValues: number[],
    bbResults: BollingerBandsOutput[],
    symbol: string,
    timeFrame: ChartTimeframe
  ): boolean {
    if (bbResults.length > 55) {
      let bbBottomValues: number[] = [];

      for (let index = 55; index > 0; index--) {
        bbBottomValues.push(bbResults[bbResults.length - index].lower);
      }

      let bbBottomRegressionIsBullish = this.linearRegressionIsNotBearish(
        bbBottomValues,
        50
      );

      let currentBbValue = bbResults[bbResults.length - 1];
      let currentTradingPrice = inputValues[inputValues.length - 1];
      let lastTradingPrice = inputValues[inputValues.length - 2];
      let last2ndTradingPrice = inputValues[inputValues.length - 3];

      let bbCurrentlowerLimit =
        currentBbValue.middle -
        ((currentBbValue.middle - currentBbValue.lower) / 100) * 80;

      let bbCurrentIsBelowLimit = currentTradingPrice < bbCurrentlowerLimit;

      let downPrecentage =
        ((currentBbValue.middle - currentTradingPrice) /
          (currentBbValue.middle - currentBbValue.lower)) *
        100;

      let priceActionTurningBullish = currentTradingPrice > lastTradingPrice;
      priceActionTurningBullish &&= lastTradingPrice < last2ndTradingPrice;

      let bbIsNearBottom = bbCurrentIsBelowLimit && downPrecentage < 120;
      bbIsNearBottom &&=
        bbBottomRegressionIsBullish && priceActionTurningBullish;

      if (bbCurrentIsBelowLimit) {
        this.messageConstructService.addToSessionBBList(
          symbol,
          timeFrame,
          downPrecentage
        );
      }

      return bbIsNearBottom;
    } else {
      return false;
    }
  }

  public bollingerBandNearTopBand(
    inputValues: number[],
    bbResults: BollingerBandsOutput[]
  ): boolean {
    if (bbResults.length > 55) {
      let currentBbValue = bbResults[bbResults.length - 1];
      let currentTradingPrice = inputValues[inputValues.length - 1];

      let bbCurrentUpperLimit =
        currentBbValue.middle +
        ((currentBbValue.upper - currentBbValue.middle) / 100) * 50;

      let bbCurrentIsAboveLimit = currentTradingPrice > bbCurrentUpperLimit;

      return bbCurrentIsAboveLimit;
    } else {
      return false;
    }
  }

  public rsiWithMovingAverageIsBullish(
    rsiValues: number[],
    sma50Values: number[],
    sma200Values: number[],
    symbol: string,
    timeFrame: ChartTimeframe
  ) {
    let ma200HasEnoughData = sma200Values.length > 10;
    let rsiHasEnoughData = rsiValues.length > 10;

    if (rsiHasEnoughData && ma200HasEnoughData) {
      let sma50above200 =
        sma50Values[sma50Values.length - 1] >
        sma200Values[sma200Values.length - 1];

      let lastClosed2ndRsiValue = rsiValues[rsiValues.length - 3];
      let lastClosedRsiValue = rsiValues[rsiValues.length - 2];
      let currentRsiValue = rsiValues[rsiValues.length - 1];

      let lastClosed2ndCandleIsBearish =
        lastClosed2ndRsiValue > lastClosedRsiValue;
      let lastClosedCandleIsOverSold = lastClosedRsiValue < 37.5;
      let currentCandlesIsBullish = currentRsiValue > lastClosedRsiValue + 2.5;
      let currentValueIsStillGoodToBuy = currentRsiValue < 40;

      if (
        sma50above200 &&
        lastClosed2ndCandleIsBearish &&
        lastClosedCandleIsOverSold &&
        currentCandlesIsBullish &&
        currentValueIsStillGoodToBuy
      ) {
        return true;
      } else {
        return false;
      }
    } else {
      return false;
    }
  }

  private linearRegressionIsNotBearish(
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

    let trendLineIsNotBearish =
      result_values_y[result_values_y.length - 1] >= result_values_y[0];

    return trendLineIsNotBearish;
  }

  public findBestOpportunity(
    bullishList: BullishCandidate[],
    bearishList: BearishCandidate[],
    downCoinsOnly: boolean,
    limit: number = 1
  ) {
    // remove bearish trending items
    let filteredBullishList = bullishList.filter((bullItem) => {
      let isBullish = true;
      bearishList.forEach((bearItem) => {
        if (
          bullItem.priceRecord.symbol === bearItem.symbol &&
          bullItem.timeFrame === bearItem.timeFrame
        ) {
          isBullish = false;
        }
      });
      return isBullish;
    });

    // depending on the BTC position filter coins
    filteredBullishList = filteredBullishList.filter((bullItem) => {
      let allowedToPass = false;
      if (downCoinsOnly) {
        if (bullItem.priceRecord.symbol.includes("DOWN")) {
          allowedToPass = true;
        }
      } else {
        if (!bullItem.priceRecord.symbol.includes("DOWN")) {
          allowedToPass = true;
        }
      }
      return allowedToPass;
    });

    // sort by opportunity
    filteredBullishList.sort(function (a, b) {
      let calculatedValue: number =
        a.currentRsiValue * a.currentBollingerBandPercentageFromBottom -
        b.currentRsiValue * b.currentBollingerBandPercentageFromBottom;
      return calculatedValue;
    });

    return filteredBullishList.splice(0, limit);
  }
}
