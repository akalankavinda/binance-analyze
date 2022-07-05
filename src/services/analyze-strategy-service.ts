import { BollingerBandsOutput } from "technicalindicators/declarations/volatility/BollingerBands";
import { ChartTimeframe } from "../enums/chart-timeframes.enum";
import { RsiWithPrice } from "../models/rsi-with-price.mode";
import { MessageConstructService } from "./message-construct-service";

export class AnalyzeStrategyService {
  // singleton
  private static _instance: AnalyzeStrategyService;
  public static getInstance() {
    return this._instance || (this._instance = new this());
  }

  private messageConstructService = MessageConstructService.getInstance();

  public rsiOverSold(
    rsiResults: number[],
    symbol: string,
    timeFrame: ChartTimeframe
  ): boolean {
    let currentValue = rsiResults[rsiResults.length - 1];
    let currentValueIsOversold = currentValue < 30;

    if (currentValueIsOversold) {
      this.messageConstructService.addToSessionRSIList(
        symbol,
        timeFrame,
        currentValue
      );
    }

    return currentValueIsOversold;
  }

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
        shallowBottom.candleIndex - deepBottom.candleIndex > 10;

      let rsiBottomsShowAccendingOrder =
        shallowBottom.rsiValue > deepBottom.rsiValue;

      let pricesShowDescendingOrder =
        shallowBottom.closePrice < deepBottom.closePrice;

      let rsiBullishDivergenceFormed =
        bottomsAreInOversoldRegion &&
        bottomsHasEnoughCandleGap &&
        rsiBottomsShowAccendingOrder &&
        pricesShowDescendingOrder &&
        lastClosedCandleFormedShallowBottom;

      if (rsiBullishDivergenceFormed) {
        this.messageConstructService.notifyRsiBullishDivergence(
          symbol,
          timeFrame
        );
      }

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

  public bollingerBandNearBottom(
    inputValues: number[],
    bbResults: BollingerBandsOutput[],
    symbol: string,
    timeFrame: ChartTimeframe
  ): boolean {
    if (bbResults.length > 10) {
      let lastBbValue = bbResults[bbResults.length - 2];
      let currentBbValue = bbResults[bbResults.length - 1];
      let currentTradingPrice = inputValues[inputValues.length - 1];
      let lastTradingPrice = inputValues[inputValues.length - 2];

      if (currentBbValue && lastBbValue) {
        let bbCurrentlowerLimit =
          currentBbValue.middle -
          ((currentBbValue.middle - currentBbValue.lower) / 100) * 75;

        let bbCurrentIsBelowLimit = currentTradingPrice < bbCurrentlowerLimit;
        let downPrecentage =
          ((currentBbValue.middle - currentTradingPrice) /
            (currentBbValue.middle - currentBbValue.lower)) *
          100;

        let bbIsNearBottom = bbCurrentIsBelowLimit && downPrecentage < 110;

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
    } else {
      return false;
    }
  }

  public rsiWithMovingAverageIsBullish(
    rsiValues: number[],
    ma200Values: number[],
    symbol: string,
    timeFrame: ChartTimeframe
  ) {
    let ma200HasEnoughData = ma200Values.length > 10;
    let rsiHasEnoughData = rsiValues.length > 10;

    if (rsiHasEnoughData && ma200HasEnoughData) {
      let ma200IsNotBearish = this.linearRegressionIsNotBearish(ma200Values);

      let lastClosed2ndRsiValue = rsiValues[rsiValues.length - 3];
      let lastClosedRsiValue = rsiValues[rsiValues.length - 2];
      let currentRsiValue = rsiValues[rsiValues.length - 1];

      let lastClosed2ndCandleIsBearish =
        lastClosed2ndRsiValue > lastClosedRsiValue;
      let lastClosedCandleIsOverSold = lastClosedRsiValue < 37.5;
      let currentCandlesIsBullish = currentRsiValue > lastClosedRsiValue + 2.5;
      let currentValueIsStillGoodToBuy = currentRsiValue < 40;

      if (
        ma200IsNotBearish &&
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

  private linearRegressionIsNotBearish(trendLineData: number[]) {
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
    for (var v = 10; v > 0; v--) {
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
}
