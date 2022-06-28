import { BollingerBandsOutput } from "technicalindicators/declarations/volatility/BollingerBands";
import { ChartTimeframe } from "../enums/chart-timeframes.enum";
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

      let lastClosedCandleIsOverSold = lastClosedValue < 31;
      let currentCandleShowsStrength = currentValue > lastClosedValue;
      let currentValueIsNearOversold = currentValue < 33;

      if (
        lastClosedCandleIsOverSold &&
        currentCandleShowsStrength &&
        currentValueIsNearOversold
      ) {
        return true;
      } else {
        return false;
      }
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
    if (bbResults.length > 12) {
      // filter bearish trend along the bollinger band bottom
      let bearishCandleCount = 0;
      for (let index = 2; index < 10; index++) {
        let tmpPrice = inputValues[inputValues.length - index];
        let tmpBbLowerValue = bbResults[bbResults.length - index].lower;
        if (tmpPrice < tmpBbLowerValue) {
          bearishCandleCount += 1;
        }
      }

      let tradingBelowBbBottom = bearishCandleCount > 0;

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

  public ema9Cross18Upwards(
    inputValues: number[],
    ema9Results: number[],
    ema18Results: number[],
    symbol: string,
    timeFrame: ChartTimeframe
  ): boolean {
    if (ema9Results.length > 20 && ema18Results.length > 20) {
      let currentEma9 = ema9Results[ema9Results.length - 1];
      let currentEma18 = ema18Results[ema18Results.length - 1];
      let lastEma9_1 = ema9Results[ema9Results.length - 2];
      let lastEma18_1 = ema18Results[ema18Results.length - 2];
      let lastEma9_2 = ema9Results[ema9Results.length - 3];
      let lastEma18_2 = ema18Results[ema18Results.length - 3];

      let bullishCrossHappened =
        currentEma9 >= currentEma18 &&
        lastEma9_1 < lastEma18_1 &&
        lastEma9_2 < lastEma18_2;

      let recentHistoryIsAlsoDown = true;
      for (let index = 2; index < 18; index++) {
        let tmp9Val = ema9Results[ema9Results.length - index];
        let tmp18Val = ema18Results[ema18Results.length - index];
        if (tmp9Val > tmp18Val) {
          recentHistoryIsAlsoDown = false;
        }
      }

      let emaCrossUpwardConfirmed =
        bullishCrossHappened && recentHistoryIsAlsoDown;

      if (emaCrossUpwardConfirmed) {
        this.messageConstructService.addToSessionEMAList(symbol, timeFrame);
      }

      return emaCrossUpwardConfirmed;
    } else {
      return false;
    }
  }
}
