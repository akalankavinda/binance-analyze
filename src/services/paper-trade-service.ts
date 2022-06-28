import { ChartData } from "../models/chart-data";
import { PaperTrade } from "../models/paper-trade";
import { BullishCandidate } from "../models/bullish-candidate.model";
import { PriceRecordDto } from "../models/price-record.dto";
import { DataAnalyzeService } from "./data-analyze.service";
import { DataStorageService } from "./data-storage.service";
import { LogWriterService } from "./log-writer.service";
import * as Utils from "./utils";
import { PaperTradeSouce } from "../models/paper-trade-source.model";
import { BearishCandidate } from "../models/bearish-candidate.model";
import { ChartTimeframe } from "../enums/chart-timeframes.enum";
import { MessageConstructService } from "./message-construct-service";

export class PaperTradeService {
  private static _instance: PaperTradeService;

  public static getInstance() {
    return this._instance || (this._instance = new this());
  }

  private dataAnalyzeService: DataAnalyzeService =
    DataAnalyzeService.getInstance();

  private dataStorageService: DataStorageService =
    DataStorageService.getInstance();

  private messageConstructService = MessageConstructService.getInstance();
  private logWriter = LogWriterService.getInstance();

  private minTradeAmountUsd: number = 20;
  private startingAmountUsd: number = 1000;
  private currentBalanceUsd!: number;
  private minProfitPrecentage = 0.5;
  private tradeFeePrecentage: number = 0.1;
  private buyBuffer: number = 0.15;
  private profitTradeCount = 0;
  private totalTradeCount = 0;
  private totalProfit = 0;
  private tradeExpireTime = 1000 * 60 * 60; // one hour

  private bollingerBandProfitPrecentage = 20;
  private bollingerBandLossPrecentage = 35;

  private pendingBuyOrders: PaperTrade[] = [];
  private pendingSellOrders: PaperTrade[] = [];
  private recentlyLostList: string[] = [];

  constructor() {
    this.currentBalanceUsd = this.startingAmountUsd;
    this.startPaperTrading();
  }

  public startPaperTrading() {
    this.dataAnalyzeService.oppotunityBroadcaster$.subscribe(
      async (tradeSource: PaperTradeSouce) => {
        await this.sellIfTimeFrameIsBearish(tradeSource.bearishList);

        tradeSource.bullishList.forEach((tradeSource: BullishCandidate) => {
          this.placePendingBuyOrder(tradeSource);
        });
      }
    );

    this.dataStorageService.data1MinuteBroadcaster$.subscribe(
      async (latestData: ChartData) => {
        await this.triggerActiveSellOrders(latestData);
        await this.triggerPendingBuyOrders(latestData);
      }
    );

    this.dataAnalyzeService.sessionFinishBroadcaster$.subscribe((val) => {
      this.sendAccountUpdate();
    });

    this.logWriter.info("started paper trading");
  }

  private placePendingBuyOrder(bullishCandidate: BullishCandidate) {
    let symbol = bullishCandidate.priceRecord.symbol;
    let currentPrice = bullishCandidate.priceRecord.close;
    let timeFrame = bullishCandidate.timeFrame;

    let recentlyLost = this.hasRecentlyLost(symbol);
    let noPendingBuyOrders = !this.hasPendingBuyOrder(symbol, timeFrame);
    let noPendingSellOrders = !this.hasPendingSellOrder(symbol, timeFrame);

    if (noPendingBuyOrders && noPendingSellOrders) {
      let canPlaceRSIOnlyTrade =
        bullishCandidate.rsiBullish && bullishCandidate.lastRsiValue < 30;

      let canPlaceEMAOnlyTrade = bullishCandidate.emaCrossedBullish;

      let canPlaceBollingerOnlyTrade =
        bullishCandidate.bollingerBandPercentage > 90;

      let canPlaceRSIAndBollingerCombinedTrade =
        bullishCandidate.rsiBullish && bullishCandidate.bollingerNearBottom;

      let atLeastOneConditionSatisfied =
        canPlaceRSIOnlyTrade ||
        canPlaceEMAOnlyTrade ||
        canPlaceBollingerOnlyTrade ||
        canPlaceRSIAndBollingerCombinedTrade;

      if (atLeastOneConditionSatisfied) {
        let buyPrice: number = (currentPrice / 100) * (100 - this.buyBuffer);

        let stopLoss: number = (buyPrice / 100) * (100 - 7.5); // default risk
        let stopProfit: number =
          (buyPrice / 100) * (100 + 1 + this.tradeFeePrecentage); // default reward;

        if (canPlaceRSIAndBollingerCombinedTrade) {
          let bollingerOnePrecent =
            (bullishCandidate.lastBollingerValue.middle -
              bullishCandidate.lastBollingerValue.lower) /
            100;

          stopLoss =
            buyPrice - bollingerOnePrecent * this.bollingerBandLossPrecentage;
          stopProfit =
            buyPrice + bollingerOnePrecent * this.bollingerBandProfitPrecentage;
        } else {
          if (timeFrame === ChartTimeframe.TWO_HOUR) {
            stopLoss = (buyPrice / 100) * (100 - 9.375); // risk
            stopProfit =
              (buyPrice / 100) * (100 + 1.25 + this.tradeFeePrecentage); // reward
          } else if (timeFrame === ChartTimeframe.FOUR_HOUR) {
            stopLoss = (buyPrice / 100) * (100 - 11.25); // risk
            stopProfit =
              (buyPrice / 100) * (100 + 1.5 + this.tradeFeePrecentage); // reward
          } else if (timeFrame === ChartTimeframe.TWELVE_HOUR) {
            stopLoss = (buyPrice / 100) * (100 - 13.125); // risk
            stopProfit =
              (buyPrice / 100) * (100 + 1.75 + this.tradeFeePrecentage); // reward
          } else if (timeFrame === ChartTimeframe.ONE_DAY) {
            stopLoss = (buyPrice / 100) * (100 - 14); // risk
            stopProfit = (buyPrice / 100) * (100 + 2 + this.tradeFeePrecentage); // reward
          }
        }

        let buyAmount = this.minTradeAmountUsd / buyPrice;
        let minProfitSellPrice =
          (buyPrice / 100) *
          (100 + this.minProfitPrecentage + this.tradeFeePrecentage);

        if (stopProfit >= minProfitSellPrice) {
          let newTrade: PaperTrade = {
            symbol: symbol,
            amount: Utils.roundNum(buyAmount),
            buyPrice: Utils.roundNum(buyPrice),
            stopLoss: Utils.roundNum(stopLoss),
            stopProfit: Utils.roundNum(stopProfit),
            isHiddenTrade: recentlyLost,
            timeFrame: bullishCandidate.timeFrame,
            timestamp: new Date().getTime(),
          };

          this.pendingBuyOrders.push(newTrade);

          if (!newTrade.isHiddenTrade) {
            this.messageConstructService.addToSessionSignalsList(newTrade);
          }
        }
      }
    }
  }

  private async sellActiveOrder(tradeIndex: number, sellPrice: number) {
    let trade = this.pendingSellOrders[tradeIndex];
    let stopLossIsHit = sellPrice <= trade.stopLoss;
    let stopProfitIsHit = sellPrice >= trade.stopProfit;

    if (stopLossIsHit) {
      this.addToRecentlyLostList(trade.symbol);
    } else if (stopProfitIsHit) {
      this.removeFromRecentlyLostList(trade.symbol);
    }

    if (!trade.isHiddenTrade) {
      let soldAmountUSD = Utils.roundNum(trade.amount * sellPrice);

      if (stopProfitIsHit) {
        this.profitTradeCount += 1;
      }
      this.totalTradeCount += 1;
      this.totalProfit += soldAmountUSD - this.minTradeAmountUsd;
      this.currentBalanceUsd += soldAmountUSD;

      this.logWriter.info(
        `PAPER TRADE: SELL ${Utils.trimUSDT(
          trade.symbol
        )} at price ${Utils.roundNum(sellPrice)} for ${Utils.roundNum(
          soldAmountUSD
        )}USD`
      );

      this.logWriter.info(
        `Total Profit: ${Utils.roundNum(
          this.totalProfit
        )}USD @ succress rate: ${this.profitTradeCount}/${this.totalTradeCount}`
      );

      await this.messageConstructService.notifySellTrade(
        trade,
        stopProfitIsHit
      );
    }

    // remove trade from active trade list
    this.pendingSellOrders.splice(tradeIndex, 1);
  }

  // when price hits the buying price, trigger the pending buy order
  private async triggerPendingBuyOrders(latestData: ChartData) {
    if (this.pendingBuyOrders.length > 0) {
      this.pendingBuyOrders.forEach(async (buyOrder, buyOrderIndex) => {
        if (latestData[buyOrder.symbol]) {
          let balanceIsEnough = this.balanceIsEnough();
          let livePrice = latestData[buyOrder.symbol][0].close;
          let buyPriceHit = livePrice <= buyOrder.buyPrice;
          let currenTimeStamp = new Date().getTime();

          if (balanceIsEnough && buyPriceHit) {
            this.pendingSellOrders.push(buyOrder);
            this.currentBalanceUsd -= this.minTradeAmountUsd;
            this.pendingBuyOrders.splice(buyOrderIndex, 1);

            if (!buyOrder.isHiddenTrade) {
              this.logWriter.info(
                `PAPER TRADE: BUY ${Utils.trimUSDT(buyOrder.symbol)} at price ${
                  buyOrder.buyPrice
                } | pending orders: ${this.pendingBuyOrders.length}`
              );
              this.messageConstructService.addToSessionBuyOrderHitList(
                buyOrder
              );
            }
          } else if (
            currenTimeStamp - buyOrder.timestamp >
            this.tradeExpireTime
          ) {
            // remove expired pending-buy-orders
            this.messageConstructService.addToSessionOrderExpiredList(buyOrder);
            this.pendingBuyOrders.splice(buyOrderIndex, 1);
          }
        }
      });

      await this.messageConstructService.constructAndSendBuyOrderHitMessage();
      await this.messageConstructService.constructAndSendOrderExpiredMessage();
    }
  }

  // when price hits stopLoss or stopProfit, sell the order
  private async triggerActiveSellOrders(latestData: ChartData) {
    if (this.pendingSellOrders.length > 0) {
      this.pendingSellOrders.forEach(
        async (trade: PaperTrade, index: number) => {
          if (latestData[trade.symbol]) {
            let livePrice = latestData[trade.symbol][0].close;
            let stopLossIsHit = livePrice <= trade.stopLoss;
            let stopProfitIsHit = livePrice >= trade.stopProfit;

            if (stopLossIsHit || stopProfitIsHit) {
              await this.sellActiveOrder(index, livePrice);
            }
          }
        }
      );
    }
  }

  // when timeframe get bearish, immediately sell active orders to minimize the loss
  private async sellIfTimeFrameIsBearish(bearishList: BearishCandidate[]) {
    bearishList.forEach((bearItem: BearishCandidate) => {
      this.pendingSellOrders.forEach(async (activeTrade, activeTradeIndex) => {
        if (
          activeTrade.symbol === bearItem.symbol &&
          activeTrade.timeFrame === bearItem.timeFrame
        ) {
          await this.sellActiveOrder(
            activeTradeIndex,
            bearItem.lastPriceRecord.close
          );
        }
      });
    });
  }

  ///////////////////////////////////////////

  public async sendAccountUpdate() {
    await this.messageConstructService.constructAndSendBuySignalMessage();
    await this.messageConstructService.notifyAccountUpdate(
      this.totalProfit,
      this.profitTradeCount,
      this.totalTradeCount,
      this.currentBalanceUsd,
      this.pendingSellOrders.length,
      this.pendingBuyOrders.length,
      this.minTradeAmountUsd
    );
  }

  private hasRecentlyLost(symbol: string): boolean {
    return this.recentlyLostList.includes(symbol);
  }

  private removeFromRecentlyLostList(symbol: string) {
    let index = this.recentlyLostList.indexOf(symbol);
    if (index > 0) {
      this.recentlyLostList.splice(index, 1);
    }
  }

  private addToRecentlyLostList(symbol: string) {
    if (!this.recentlyLostList.includes(symbol)) {
      this.recentlyLostList.push(symbol);
    }
  }

  private balanceIsEnough(): boolean {
    return this.currentBalanceUsd > this.minTradeAmountUsd;
  }

  private hasPendingSellOrder(
    symbol: string,
    timeframe: ChartTimeframe
  ): boolean {
    let hasTrades = false;
    this.pendingSellOrders.forEach((item) => {
      if (
        item.symbol === symbol &&
        item.timeFrame === timeframe &&
        item.isHiddenTrade === false
      ) {
        hasTrades = true;
      }
    });
    return hasTrades;
  }

  private hasPendingBuyOrder(
    symbol: string,
    timeframe: ChartTimeframe
  ): boolean {
    let hasTrades = false;
    this.pendingBuyOrders.forEach((item) => {
      if (
        item.symbol === symbol &&
        item.timeFrame === timeframe &&
        item.isHiddenTrade === false
      ) {
        hasTrades = true;
      }
    });
    return hasTrades;
  }
}
