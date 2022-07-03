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
      let lastClosedValue = rsiResults[rsiResults.length - 2];
      let currentValue = rsiResults[rsiResults.length - 1];

      let lastClosedCandleIsBullish = lastClosedValue < 30;
      let currentCandlesIsBullish = currentValue > lastClosedValue;
      let currentValueIsCrossingBottomLine = currentValue > 29;
      let currentValueIsStillGoodToBuy = currentValue < 33;

      if (
        lastClosedCandleIsBullish &&
        currentCandlesIsBullish &&
        currentValueIsCrossingBottomLine &&
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
      for (let index = 0; index < 55; index++) {
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
}
