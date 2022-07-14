import { ChartData } from "../models/chart-data";
import { PaperTrade } from "../models/paper-trade";
import { BullishCandidate } from "../models/bullish-candidate.model";
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

  private minTradeAmountUsd: number = 100;
  private minProfitPercentage = 0.5;
  private tradeFeePercentage: number = 0.1;
  private buyBuffer: number = 0.125;
  private sessionOrderPlaceLimit = 1;
  private activeOrderLimit = 3;
  private pendingBuyOrderExpireHours = 1;

  // memory storage variables
  private currentBalanceUsd = 0;
  private profitTradeCount = 0;
  private totalTradeCount = 0;
  private totalProfit = 0;
  private pendingBuyOrders: PaperTrade[] = [];
  private pendingSellOrders: PaperTrade[] = [];
  private recentlyLostSymbolList: string[] = [];
  private placingRealOrdersAllowed: boolean = true;
  private recentOrderStatusStack: OrderCompleteStatus[] = [];

  constructor() {
    this.loadPreviousTradesFromFile();
    this.startPaperTrading();
  }

  private loadPreviousTradesFromFile() {
    this.currentBalanceUsd =
      this.dataStorageService.loadDataFromJsonStorage("currentBalanceUsd");
    this.profitTradeCount =
      this.dataStorageService.loadDataFromJsonStorage("profitTradeCount");
    this.totalTradeCount =
      this.dataStorageService.loadDataFromJsonStorage("totalTradeCount");
    this.totalProfit =
      this.dataStorageService.loadDataFromJsonStorage("totalProfit");
    this.pendingBuyOrders =
      this.dataStorageService.loadDataFromJsonStorage("pendingBuyOrders");
    this.pendingSellOrders =
      this.dataStorageService.loadDataFromJsonStorage("pendingSellOrders");
    this.recentlyLostSymbolList =
      this.dataStorageService.loadDataFromJsonStorage("recentlyLostSymbolList");
    this.placingRealOrdersAllowed =
      this.dataStorageService.loadDataFromJsonStorage(
        "placingRealOrdersAllowed"
      );
    this.recentOrderStatusStack =
      this.dataStorageService.loadDataFromJsonStorage("recentOrderStatusStack");
  }

  public startPaperTrading() {
    this.dataAnalyzeService.oppotunityBroadcaster$.subscribe(
      async (tradeSource: PaperTradeSouce) => {
        await this.sellIfTimeFrameIsBearish(tradeSource.bearishList);
        this.placePendingBuyOrder(tradeSource);
        await this.messageConstructService.constructAndSendBuySignalMessage();
      }
    );

    this.dataStorageService.data1MinuteBroadcaster$.subscribe(
      async (latestData: ChartData) => {
        await this.triggerPendingBuyOrders(latestData);
        await this.triggerActiveSellOrders(latestData);

        await this.messageConstructService.constructAndSendOrderSoldMessage();
        await this.messageConstructService.constructAndSendBuyOrderHitMessage();
        await this.messageConstructService.constructAndSendOrderExpiredMessage();
      }
    );

    this.dataAnalyzeService.session1HourEndBroadcaster$.subscribe((val) => {
      this.sendAccountUpdate();
    });

    this.logWriter.info("started paper trading");
  }

  private placePendingBuyOrder(tradeSource: PaperTradeSouce) {
    let placedCount = 0;

    tradeSource.bullishList.forEach((bullishCandidate: BullishCandidate) => {
      let symbol = bullishCandidate.priceRecord.symbol;
      let currentPrice = bullishCandidate.priceRecord.close;
      let timeFrame = bullishCandidate.timeFrame;

      if (
        symbol === "BTCUSDT" &&
        bullishCandidate.strategy == AnalyzeStrategy.RSI_BULLISH_DIVERGENCE
      ) {
        // temporary increase active order limit
        this.activeOrderLimit = 10;
        setTimeout(() => {
          this.activeOrderLimit = 3;
        }, 1000 * 60 * 60 * 1);
      }

      let tradingIsPaused = !this.placingRealOrdersAllowed;
      let symbolRecentlyLost = this.hasRecentlyLost(symbol);
      let noPendingBuyOrders = !this.hasPendingBuyOrder(symbol, timeFrame);
      let noPendingSellOrders = !this.hasPendingSellOrder(symbol, timeFrame);

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
      let zeroLossLimit = (buyPrice / 100) * (100 + this.tradeFeePercentage);

      let tradeIsHidden = symbolRecentlyLost || tradingIsPaused;

      let newTrade: PaperTrade = {
        symbol: symbol,
        amount: Utils.roundNum(buyAmount),
        buyPrice: Utils.roundNum(buyPrice),
        currentPrice: Utils.roundNum(buyPrice),
        stopLoss: Utils.roundNum(stopLoss),
        stopProfit: Utils.roundNum(stopProfit),
        zeroLossLimit: Utils.roundNum(zeroLossLimit),
        isHiddenTrade: tradeIsHidden,
        timeFrame: bullishCandidate.timeFrame,
        timestamp: new Date().getTime(),
        strategy: strategy,
      };

      if (
        noPendingBuyOrders &&
        noPendingSellOrders &&
        stopProfit >= minProfitSellPrice &&
        placedCount <= this.sessionOrderPlaceLimit
      ) {
        // if there is already pending the same symbol
        // and have a better position to place order..
        this.pendingBuyOrders.forEach((item, index) => {
          if (
            item.symbol === newTrade.symbol &&
            item.timeFrame === newTrade.timeFrame &&
            newTrade.buyPrice < item.buyPrice
          ) {
            this.pendingBuyOrders.splice(index, 1);
          }
        });

        this.pendingBuyOrders.unshift(newTrade);
        placedCount += 1;

        this.dataStorageService.saveDataToJsonStorage(
          "pendingBuyOrders",
          this.pendingBuyOrders
        );
      }

      // add possible trade opportunity to signal list
      if (!symbolRecentlyLost) {
        this.messageConstructService.addToSessionSignalsList(
          newTrade,
          bullishCandidate
        );
      }
    });
  }

  private async sellActiveOrder(tradeIndex: number) {
    let trade = this.pendingSellOrders[tradeIndex];
    let stopProfitIsHit = trade.currentPrice >= trade.stopProfit;
    let stopLossIsHit = trade.currentPrice <= trade.stopLoss;

    if (stopProfitIsHit) {
      this.removeFromRecentlyLostSymbolList(trade.symbol);
      this.pushToRecentOrderStatusStack(OrderCompleteStatus.success);
    } else if (stopLossIsHit) {
      this.addToRecentlyLostSymbolList(trade.symbol);
      this.pushToRecentOrderStatusStack(OrderCompleteStatus.failed);
    }

    this.dataStorageService.saveDataToJsonStorage(
      "recentlyLostSymbolList",
      this.recentlyLostSymbolList
    );
    this.dataStorageService.saveDataToJsonStorage(
      "recentOrderStatusStack",
      this.recentOrderStatusStack
    );

    let soldAmountUSD = Utils.roundNum(trade.amount * trade.currentPrice);

    let hiddenText = trade.isHiddenTrade ? " HIDDEN" : "";
    this.logWriter.info(
      `PAPER TRADE:${hiddenText} SELL ${Utils.trimUSDT(trade.symbol)}-${
        trade.timeFrame
      } at price ${Utils.roundNum(trade.currentPrice)} for ${Utils.roundNum(
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

      this.dataStorageService.saveDataToJsonStorage(
        "profitTradeCount",
        this.profitTradeCount
      );
      this.dataStorageService.saveDataToJsonStorage(
        "totalTradeCount",
        this.totalTradeCount
      );
      this.dataStorageService.saveDataToJsonStorage(
        "totalProfit",
        this.totalProfit
      );
      this.dataStorageService.saveDataToJsonStorage(
        "currentBalanceUsd",
        this.currentBalanceUsd
      );

      if (stopProfitIsHit) {
        this.messageConstructService.addToSessionOrderHitStopProfit(trade);
      } else if (stopLossIsHit) {
        this.messageConstructService.addToSessionOrderHitStopProfit(trade);
      } else if (trade.currentPrice >= trade.zeroLossLimit) {
        this.messageConstructService.addToSessionOrderSoldWithNoLoss(trade);
      } else if (trade.currentPrice < trade.zeroLossLimit) {
        this.messageConstructService.addToSessionOrderSoldWithLoss(trade);
      }
    }

    this.pauseOrResumePlacingNewOrders();

    this.dataStorageService.saveDataToJsonStorage(
      "pendingSellOrders",
      this.pendingSellOrders
    );
    this.dataStorageService.saveDataToJsonStorage(
      "pendingBuyOrders",
      this.pendingBuyOrders
    );
  }

  // when price hits the buying price, trigger the pending buy order
  private async triggerPendingBuyOrders(latestData: ChartData) {
    if (this.pendingBuyOrders.length > 0) {
      this.pendingBuyOrders.forEach(async (buyOrder, buyOrderIndex) => {
        if (latestData[buyOrder.symbol]) {
          let hasAvailableSlot = this.hasAvailableTradeSlot(buyOrder);
          let balanceIsEnough = this.balanceIsEnough();
          let livePrice = latestData[buyOrder.symbol][0].close;
          let buyPriceHit = livePrice <= buyOrder.buyPrice;
          let currenTimeStamp = new Date().getTime();

          this.pendingBuyOrders[buyOrderIndex].currentPrice = livePrice;

          if (balanceIsEnough && buyPriceHit && hasAvailableSlot) {
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

              // after one real oder is placed, make other pending orders hidden
              this.pendingBuyOrders.forEach((item, index) => {
                this.pendingBuyOrders[index].isHiddenTrade = true;
              });
            }
          } else if (
            currenTimeStamp - buyOrder.timestamp >
            1000 * 60 * 60 * this.pendingBuyOrderExpireHours
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

      this.dataStorageService.saveDataToJsonStorage(
        "pendingBuyOrders",
        this.pendingBuyOrders
      );
      this.dataStorageService.saveDataToJsonStorage(
        "pendingSellOrders",
        this.pendingSellOrders
      );
      this.dataStorageService.saveDataToJsonStorage(
        "currentBalanceUsd",
        this.currentBalanceUsd
      );
    }
  }

  // when price hits stopLoss or stopProfit, sell the order
  private async triggerActiveSellOrders(latestData: ChartData) {
    let currenTimeStamp = new Date().getTime();
    if (this.pendingSellOrders.length > 0) {
      this.pendingSellOrders.forEach(
        async (trade: PaperTrade, index: number) => {
          if (latestData[trade.symbol]) {
            let livePrice = latestData[trade.symbol][0].close;
            let stopLossIsHit = livePrice <= trade.stopLoss;
            let stopProfitIsHit = livePrice >= trade.stopProfit;

            this.pendingSellOrders[index].currentPrice = livePrice;

            if (stopLossIsHit || stopProfitIsHit) {
              await this.sellActiveOrder(index);
            } else if (
              currenTimeStamp - trade.timestamp >
              this.getOrderExpireLimit(trade.timeFrame)
            ) {
              // remove expired pending-sell-orders
              await this.sellActiveOrder(index);
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
          await this.sellActiveOrder(activeTradeIndex);
        }
      });
    });
  }

  ///////////////////////////////////////////

  private async sendAccountUpdate() {
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

  private async pauseOrResumePlacingNewOrders() {
    if (this.recentOrderStatusStack.length > 3) {
      if (this.placingRealOrdersAllowed) {
        let lastCompletedOrdersDidntHitStopProfit =
          this.recentOrderStatusStack[0] === OrderCompleteStatus.failed;

        if (lastCompletedOrdersDidntHitStopProfit) {
          this.placingRealOrdersAllowed = false;
          this.logWriter.info(`PAUSED PLACING NEW ORDERS`);
          this.logWriter.info(`SELLING ALL ACTIVE ORDERS TO MINIMIZE RISK`);
          await this.messageConstructService.notifyTradesPaused();
          this.makeAllPendingOrdersHidden();
          this.immediatelySellActiveOrders();
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

      this.dataStorageService.saveDataToJsonStorage(
        "placingRealOrdersAllowed",
        this.placingRealOrdersAllowed
      );
    }
  }

  private makeAllPendingOrdersHidden() {
    this.pendingBuyOrders.forEach((item, index) => {
      this.pendingBuyOrders[index].isHiddenTrade = true;
    });
  }

  private makeAllPendingOrdersVisible() {
    this.pendingBuyOrders.forEach((item, index) => {
      this.pendingBuyOrders[index].isHiddenTrade = false;
    });
  }

  private immediatelySellActiveOrders() {
    this.pendingSellOrders.forEach((item, index) => {
      this.sellActiveOrder(index);
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

  private hasAvailableTradeSlot(trade: PaperTrade) {
    if (trade.isHiddenTrade) {
      return true;
    } else {
      let activeOrderCount = 0;
      this.pendingSellOrders.forEach((item) => {
        if (!item.isHiddenTrade) {
          activeOrderCount += 1;
        }
      });
      return activeOrderCount < this.activeOrderLimit;
    }
  }

  private hasPendingSellOrder(
    symbol: string,
    timeframe: ChartTimeframe
  ): boolean {
    let hasTrades = false;
    this.pendingSellOrders.forEach((item) => {
      if (
        item.symbol === symbol &&
        //item.timeFrame === timeframe &&
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
        //item.timeFrame === timeframe &&
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
      if (timeFrame === ChartTimeframe.ONE_HOUR) {
        stopProfitPercentage = 1;
      } else if (timeFrame === ChartTimeframe.TWO_HOUR) {
        stopProfitPercentage = 1.5;
      } else if (timeFrame === ChartTimeframe.FOUR_HOUR) {
        stopProfitPercentage = 2;
      } else if (timeFrame === ChartTimeframe.TWELVE_HOUR) {
        stopProfitPercentage = 4;
      } else if (timeFrame === ChartTimeframe.ONE_DAY) {
        stopProfitPercentage = 8;
      } else {
        stopProfitPercentage = 1;
      }
    } else if (strategy === AnalyzeStrategy.RSI_BULLISH_DIVERGENCE) {
      if (timeFrame === ChartTimeframe.ONE_HOUR) {
        stopProfitPercentage = 2;
      } else if (timeFrame === ChartTimeframe.TWO_HOUR) {
        stopProfitPercentage = 3;
      } else if (timeFrame === ChartTimeframe.FOUR_HOUR) {
        stopProfitPercentage = 5;
      } else if (timeFrame === ChartTimeframe.TWELVE_HOUR) {
        stopProfitPercentage = 10;
      } else if (timeFrame === ChartTimeframe.ONE_DAY) {
        stopProfitPercentage = 15;
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
      if (timeFrame === ChartTimeframe.ONE_HOUR) {
        stopLossPercentage = 3;
      } else if (timeFrame === ChartTimeframe.TWO_HOUR) {
        stopLossPercentage = 4.5;
      } else if (timeFrame === ChartTimeframe.FOUR_HOUR) {
        stopLossPercentage = 7.5;
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

  private getOrderExpireLimit(timeFrame: ChartTimeframe) {
    let hourCount = 2;
    if (timeFrame === ChartTimeframe.ONE_HOUR) {
      hourCount = 2;
    } else if (timeFrame === ChartTimeframe.TWO_HOUR) {
      hourCount = 3;
    } else if (timeFrame === ChartTimeframe.FOUR_HOUR) {
      hourCount = 4;
    } else if (timeFrame === ChartTimeframe.TWELVE_HOUR) {
      hourCount = 6;
    } else if (timeFrame === ChartTimeframe.ONE_DAY) {
      hourCount = 10;
    } else {
      hourCount = 2;
    }

    return 1000 * 60 * 60 * hourCount; // one hour
  }
}
