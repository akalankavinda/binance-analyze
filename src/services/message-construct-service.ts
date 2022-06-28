import { ChartTimeframe } from "../enums/chart-timeframes.enum";
import { TelegramChannels } from "../enums/telegram-channels.enum";
import { PaperTrade } from "../models/paper-trade";
import { TelegraService } from "./telegram.service";
import { roundNum, trimUSDT } from "./utils";

export class MessageConstructService {
  // make singleton
  private static _instance: MessageConstructService;
  public static getInstance() {
    return this._instance || (this._instance = new this());
  }

  ////

  private telegramService = TelegraService.getInstance();

  private sessionRsiMessage = "";
  private sessionBbMessage = "";
  private sessionEmaMessage = "";
  private sessionBearishMessage = "";
  //
  private sessionBuySignalsMessage = "";
  private sessionBuyOrderHitMessage = "";
  private sessionOrderExpiredMessage = "";

  //
  //
  ////////////////////////////////////////////
  //
  //

  public addToSessionRSIList(
    symbol: string,
    timeFrame: ChartTimeframe,
    rsiValue: number
  ): void {
    this.sessionRsiMessage += `✤ ${trimUSDT(
      symbol
    )} <code>- ${timeFrame} - ${roundNum(rsiValue)}</code>\n`;
  }

  public addToSessionBBList(
    symbol: string,
    timeFrame: ChartTimeframe,
    percentage: number
  ): void {
    this.sessionBbMessage += `✤ ${trimUSDT(
      symbol
    )} <code>- ${timeFrame} - ${Math.round(percentage)}%</code>\n`;
  }

  public addToSessionEMAList(symbol: string, timeFrame: ChartTimeframe): void {
    this.sessionEmaMessage += `✤ ${trimUSDT(
      symbol
    )} <code>- ${timeFrame} - crossed↑</code>\n`;
  }

  // public addToSessionBearishList(
  //   symbol: string,
  //   timeFrame: ChartTimeframe
  // ): void {
  //   this.sessionBearishMessage += `🔴 ${trimUSDT(
  //     symbol
  //   )} <code>- ${timeFrame}</code> <b>Bearish</b>\n`;
  // }

  public addToSessionSignalsList(trade: PaperTrade): void {
    let message = `🔮 <b>${trimUSDT(trade.symbol)}</b> - ${trade.timeFrame}\n`;
    message += `Buy at: ${trade.buyPrice}\n`;
    message += `<u><i>SELL(OCO):</i></u>\n`;
    message += `Price: ${trade.stopProfit}\n`;
    message += `Stop: ${trade.stopLoss}\n`;
    message += `Limit: ${trade.stopLoss}\n\n`;

    this.sessionBuySignalsMessage += message;
  }

  public addToSessionBuyOrderHitList(trade: PaperTrade): void {
    let message = `💵 <b>${trimUSDT(trade.symbol)}</b> - ${
      trade.timeFrame
    } buy order placed\n`;
    this.sessionBuyOrderHitMessage += message;
  }

  public addToSessionOrderExpiredList(trade: PaperTrade): void {
    let message = `🗑 <b>${trimUSDT(trade.symbol)} - ${
      trade.timeFrame
    }</b> trade EXPIRED\n`;
    this.sessionOrderExpiredMessage += message;
  }

  //
  //
  ////////////////////////////////////////////
  //
  //

  public async constructAndSendBuySignalMessage() {
    if (this.sessionBuySignalsMessage.length > 0) {
      await this.telegramService.pushMessage(
        this.sessionBuySignalsMessage,
        TelegramChannels.paperTradeChannel
      );
      this.sessionBuySignalsMessage = "";
    }
  }

  public async constructAndSendBuyOrderHitMessage() {
    if (this.sessionBuyOrderHitMessage.length > 0) {
      await this.telegramService.pushMessage(
        this.sessionBuyOrderHitMessage,
        TelegramChannels.paperTradeChannel
      );
      this.sessionBuyOrderHitMessage = "";
    }
  }

  public async constructAndSendOrderExpiredMessage() {
    if (this.sessionOrderExpiredMessage.length > 0) {
      await this.telegramService.pushMessage(
        this.sessionOrderExpiredMessage,
        TelegramChannels.paperTradeChannel
      );
      this.sessionOrderExpiredMessage = "";
    }
  }

  // public async constructAndSendSessionAnalysisUpdate() {
  //   let finalLogMessage = "";
  //   if (this.sessionRsiMessage.length > 0) {
  //     finalLogMessage += `🟢 RSI OverSold\n${this.sessionRsiMessage}\n`;
  //   }
  //   if (this.sessionBbMessage.length > 0) {
  //     finalLogMessage += `🟣 BollingerBand Bottom\n${this.sessionBbMessage}\n`;
  //   }
  //   if (this.sessionEmaMessage.length > 0) {
  //     finalLogMessage += `🔵 EMA Bullish Cross\n${this.sessionEmaMessage}\n`;
  //   }
  //   if (this.sessionBearishMessage.length > 0) {
  //     finalLogMessage += `${this.sessionBearishMessage}\n`;
  //   }

  //   if (finalLogMessage.length > 0) {
  //     console.log(finalLogMessage);
  //     await this.telegramService.pushMessage(
  //       finalLogMessage,
  //       TelegramChannels.logChannel
  //     );
  //   } else {
  //     await this.telegramService.pushMessage(
  //       `🔘 No results from analysis`,
  //       TelegramChannels.logChannel
  //     );
  //   }

  //   this.sessionRsiMessage = "";
  //   this.sessionBbMessage = "";
  //   this.sessionEmaMessage = "";
  //   this.sessionBearishMessage = "";
  // }

  public async notifySellTrade(trade: PaperTrade, isProfit: boolean) {
    let message = isProfit
      ? `✅ <b>${trimUSDT(trade.symbol)}</b> - ${
          trade.timeFrame
        } trade hit PROFIT\n`
      : `✴️ <b>${trimUSDT(trade.symbol)}</b> - ${trade.timeFrame} trade LOST\n`;
    await this.telegramService.pushMessage(
      message,
      TelegramChannels.paperTradeChannel
    );
  }

  public async notifyAccountUpdate(
    totalProfit: number,
    profitTradeCount: number,
    totalTradeCount: number,
    accountBalance: number,
    activeTradeCount: number,
    pendingTradeCount: number,
    minTradeAmount: number
  ) {
    let winningRate = Math.floor((profitTradeCount / totalTradeCount) * 100);
    let winningRateStr = winningRate >= 0 ? winningRate.toString() : "0";
    let message = `📜 <u>Account Summary</u>\n`;
    message += `<code>Active Trades: ${minTradeAmount}USD x ${activeTradeCount}</code>\n`;
    message += `<code>Pending Trades: ${pendingTradeCount}</code>\n`;
    message += `<code>Finished Trades: ${totalTradeCount}</code>\n`;
    message += `<code>Winning rate: ${winningRateStr}%</code>\n`;
    message += `<code>Account Balance: ${roundNum(accountBalance)}USD</code>\n`;
    message += `<code>TOTAL PROFIT: ${roundNum(totalProfit)}USD</code>\n`;
    await this.telegramService.pushMessage(
      message,
      TelegramChannels.paperTradeChannel
    );
  }
}
