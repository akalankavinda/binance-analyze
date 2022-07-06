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
import { OrderCompleteStatus } from "../enums/order-complete-status.enum";
import { AnalyzeStrategy } from "../enums/analyze-strategies.enum";

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

  private minTradeAmountUsd: number = 50;
  private startingAmountUsd: number = 1000;
  private currentBalanceUsd!: number;
  private minProfitPercentage = 0.5;
  private tradeFeePercentage: number = 0.1;
  private buyBuffer: number = 0.125;
  private tradeExpireTime = 1000 * 60 * 60; // one hour

  private bollingerBandProfitPercentage = 20;
  private bollingerBandLossPercentage = 35;
  private rsiDivergenceProfitPercentage = 100;
  private rsiDivergenceLossPercentage = 30;

  // memory storage variables
  private profitTradeCount = 0;
  private totalTradeCount = 0;
  private totalProfit = 0;
  private pendingBuyOrders: PaperTrade[] = [];
  private pendingSellOrders: PaperTrade[] = [];
  private recentlyLostSymbolList: string[] = [];
  private placingRealOrdersAllowed: boolean = true;
  private recentOrderStatusStack: OrderCompleteStatus[] = [];

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

    let tradingIsPaused = !this.placingRealOrdersAllowed;
    let symbolRecentlyLost = this.hasRecentlyLost(symbol);
    let noPendingBuyOrders = !this.hasPendingBuyOrder(symbol, timeFrame);
    let noPendingSellOrders = !this.hasPendingSellOrder(symbol, timeFrame);

    if (noPendingBuyOrders && noPendingSellOrders) {
      let strategy = bullishCandidate.strategy;
      let buyPrice: number = (currentPrice / 100) * (100 - this.buyBuffer);

      let stopLoss: number = this.getStopLoss(buyPrice, timeFrame, strategy);
      let stopProfit: number = this.getStopProfit(
        buyPrice,
        timeFrame,
        strategy
      );

      let buyAmount = this.minTradeAmountUsd / buyPrice;
      let minProfitSellPrice =
        (buyPrice / 100) *
        (100 + this.minProfitPercentage + this.tradeFeePercentage);

      let tradeIsHidden = symbolRecentlyLost || tradingIsPaused;

      if (stopProfit >= minProfitSellPrice) {
        let newTrade: PaperTrade = {
          symbol: symbol,
          amount: Utils.roundNum(buyAmount),
          buyPrice: Utils.roundNum(buyPrice),
          stopLoss: Utils.roundNum(stopLoss),
          stopProfit: Utils.roundNum(stopProfit),
          isHiddenTrade: tradeIsHidden,
          timeFrame: bullishCandidate.timeFrame,
          timestamp: new Date().getTime(),
          strategy: strategy,
        };

        this.pendingBuyOrders.forEach((item, index) => {
          if (
            item.symbol === newTrade.symbol &&
            item.timeFrame === newTrade.timeFrame &&
            newTrade.buyPrice < item.buyPrice
          ) {
            this.pendingBuyOrders.splice(index, 1);
          }
        });

        this.pendingBuyOrders.push(newTrade);

        if (!tradeIsHidden) {
          this.messageConstructService.addToSessionSignalsList(
            newTrade,
            bullishCandidate
          );
        }
      }
    }
  }

  private async sellActiveOrder(tradeIndex: number, sellPrice: number) {
    let trade = this.pendingSellOrders[tradeIndex];
    let stopProfitIsHit = sellPrice >= trade.stopProfit;

    if (stopProfitIsHit) {
      this.removeFromRecentlyLostSymbolList(trade.symbol);
      this.pushToRecentOrderStatusStack(OrderCompleteStatus.success);
    } else {
      this.addToRecentlyLostSymbolList(trade.symbol);
      this.pushToRecentOrderStatusStack(OrderCompleteStatus.failed);
    }

    let soldAmountUSD = Utils.roundNum(trade.amount * sellPrice);

    let hiddenText = trade.isHiddenTrade ? " HIDDEN" : "";
    this.logWriter.info(
      `PAPER TRADE:${hiddenText} SELL ${Utils.trimUSDT(trade.symbol)}-${
        trade.timeFrame
      } at price ${Utils.roundNum(sellPrice)} for ${Utils.roundNum(
        soldAmountUSD
      )}USD`
    );

    // remove trade from active trade list
    this.pendingSellOrders.splice(tradeIndex, 1);

    if (!trade.isHiddenTrade) {
      if (stopProfitIsHit) {
        this.profitTradeCount += 1;
      }
      this.totalTradeCount += 1;
      this.totalProfit += soldAmountUSD - this.minTradeAmountUsd;
      this.currentBalanceUsd += soldAmountUSD;

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

    this.pauseOrResumePlacingNewOrders();
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
            this.pendingBuyOrders.splice(buyOrderIndex, 1);

            let hiddenText = buyOrder.isHiddenTrade ? " HIDDEN" : "";
            this.logWriter.info(
              `PAPER TRADE:${hiddenText} BUY ${Utils.trimUSDT(
                buyOrder.symbol
              )}-${buyOrder.timeFrame} at price ${buyOrder.buyPrice} | ${
                buyOrder.strategy
              }`
            );

            if (!buyOrder.isHiddenTrade) {
              this.currentBalanceUsd -= this.minTradeAmountUsd;

              this.messageConstructService.addToSessionBuyOrderHitList(
                buyOrder
              );
            }
          } else if (
            currenTimeStamp - buyOrder.timestamp >
            this.tradeExpireTime
          ) {
            // remove expired pending-buy-orders
            this.pendingBuyOrders.splice(buyOrderIndex, 1);
            if (this.placingRealOrdersAllowed) {
              this.messageConstructService.addToSessionOrderExpiredList(
                buyOrder
              );
            }
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
    let pendingSellOrderCount = 0;
    let pendingBuyOrderCount = 0;
    this.pendingSellOrders.forEach((item) => {
      if (!item.isHiddenTrade) {
        pendingSellOrderCount += 1;
      }
    });
    this.pendingBuyOrders.forEach((item) => {
      if (!item.isHiddenTrade) {
        pendingBuyOrderCount += 1;
      }
    });

    await this.messageConstructService.constructAndSendBuySignalMessage();
    await this.messageConstructService.notifyAccountUpdate(
      this.totalProfit,
      this.profitTradeCount,
      this.totalTradeCount,
      this.currentBalanceUsd,
      pendingSellOrderCount,
      pendingBuyOrderCount,
      this.minTradeAmountUsd
    );
  }

  private pauseOrResumePlacingNewOrders() {
    if (this.recentOrderStatusStack.length > 3) {
      if (this.placingRealOrdersAllowed) {
        let atLeastOneTradeSucceeded =
          this.recentOrderStatusStack[0] === OrderCompleteStatus.success ||
          this.recentOrderStatusStack[1] === OrderCompleteStatus.success ||
          this.recentOrderStatusStack[2] === OrderCompleteStatus.success;

        if (!atLeastOneTradeSucceeded) {
          this.placingRealOrdersAllowed = false;
          this.makeAllPendingOrdersHidden();
          this.reduceRiskForActiveTrades();
          this.logWriter.info(`PAUSED PLACING NEW ORDERS`);
          this.messageConstructService.notifyTradesPaused();
        }
      } else {
        let tradesSucceededInRow =
          this.recentOrderStatusStack[0] === OrderCompleteStatus.success &&
          this.recentOrderStatusStack[1] === OrderCompleteStatus.success &&
          this.recentOrderStatusStack[2] === OrderCompleteStatus.success;

        if (tradesSucceededInRow) {
          this.placingRealOrdersAllowed = true;
          this.makeAllPendingOrdersVisible();
          this.logWriter.info(`RESUMED PLACING NEW ORDERS`);
          this.messageConstructService.notifyTradesResumed();
        }
      }
    }
  }

  private makeAllPendingOrdersHidden() {
    // this.pendingBuyOrders.forEach((item, index) => {
    //   this.pendingBuyOrders[index].isHiddenTrade = true;
    // });
    this.pendingBuyOrders = [];
  }

  private makeAllPendingOrdersVisible() {
    this.pendingBuyOrders.forEach((item, index) => {
      this.pendingBuyOrders[index].isHiddenTrade = false;
    });
  }

  private reduceRiskForActiveTrades() {
    this.pendingSellOrders.forEach((item, index) => {
      let newStopLoss = (item.buyPrice / 100) * 98;
      this.pendingSellOrders[index].stopLoss = newStopLoss;
    });
  }

  private pushToRecentOrderStatusStack(status: OrderCompleteStatus) {
    this.recentOrderStatusStack.unshift(status);
    if (this.recentOrderStatusStack.length > 10) {
      this.recentOrderStatusStack = this.recentOrderStatusStack.slice(0, 9);
    }
  }

  private hasRecentlyLost(symbol: string): boolean {
    return this.recentlyLostSymbolList.includes(symbol);
  }

  private removeFromRecentlyLostSymbolList(symbol: string) {
    let index = this.recentlyLostSymbolList.indexOf(symbol);
    if (index > 0) {
      this.recentlyLostSymbolList.splice(index, 1);
    }
  }

  private addToRecentlyLostSymbolList(symbol: string) {
    if (!this.recentlyLostSymbolList.includes(symbol)) {
      this.recentlyLostSymbolList.push(symbol);
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

  //
  //
  //
  //
  //

  private getStopProfit(
    buyPrice: number,
    timeFrame: ChartTimeframe,
    strategy: AnalyzeStrategy
  ): number {
    let stopProfitPercentage = 1;

    if (
      strategy === AnalyzeStrategy.RSI_BULLISH ||
      strategy === AnalyzeStrategy.BOLLINGER_BAND_BULLISH ||
      strategy === AnalyzeStrategy.RSI_WITH_MA_BULLISH
    ) {
      if (timeFrame === ChartTimeframe.TWO_HOUR) {
        stopProfitPercentage = 1.75;
      } else if (timeFrame === ChartTimeframe.FOUR_HOUR) {
        stopProfitPercentage = 3;
      } else if (timeFrame === ChartTimeframe.TWELVE_HOUR) {
        stopProfitPercentage = 5;
      } else if (timeFrame === ChartTimeframe.ONE_DAY) {
        stopProfitPercentage = 8;
      } else {
        stopProfitPercentage = 1;
      }
    } else if (strategy === AnalyzeStrategy.RSI_BULLISH_DIVERGENCE) {
      if (timeFrame === ChartTimeframe.TWO_HOUR) {
        stopProfitPercentage = 3;
      } else if (timeFrame === ChartTimeframe.FOUR_HOUR) {
        stopProfitPercentage = 5;
      } else if (timeFrame === ChartTimeframe.TWELVE_HOUR) {
        stopProfitPercentage = 8;
      } else if (timeFrame === ChartTimeframe.ONE_DAY) {
        stopProfitPercentage = 14;
      } else {
        stopProfitPercentage = 2;
      }
    }

    return (
      (buyPrice / 100) * (100 + stopProfitPercentage + this.tradeFeePercentage)
    ); // reward
  }

  private getStopLoss(
    buyPrice: number,
    timeFrame: ChartTimeframe,
    strategy: AnalyzeStrategy
  ): number {
    let stopLossPercentage = 5;

    if (
      strategy === AnalyzeStrategy.RSI_BULLISH ||
      strategy === AnalyzeStrategy.BOLLINGER_BAND_BULLISH ||
      strategy === AnalyzeStrategy.RSI_WITH_MA_BULLISH ||
      strategy === AnalyzeStrategy.RSI_BULLISH_DIVERGENCE
    ) {
      if (timeFrame === ChartTimeframe.TWO_HOUR) {
        stopLossPercentage = 5.25;
      } else if (timeFrame === ChartTimeframe.FOUR_HOUR) {
        stopLossPercentage = 9;
      } else if (timeFrame === ChartTimeframe.TWELVE_HOUR) {
        stopLossPercentage = 15;
      } else if (timeFrame === ChartTimeframe.ONE_DAY) {
        stopLossPercentage = 24;
      } else {
        stopLossPercentage = 3;
      }
    }

    return (buyPrice / 100) * (100 - stopLossPercentage); // risk
  }
}
