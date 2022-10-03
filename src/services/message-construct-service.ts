import { AnalyzeStrategy } from "../enums/analyze-strategies.enum";
import { TelegramChannels } from "../enums/telegram-channels.enum";
import { TrendDirection } from "../enums/trend-direction.enum";
import { AnalyzeResult } from "../models/analyze-result.model";
import { TelegramService } from "./telegram.service";
import { trimUSDT } from "./utils";

export class MessageConstructService {
  // make singleton
  private static _instance: MessageConstructService;
  public static getInstance() {
    return this._instance || (this._instance = new this());
  }

  private telegramService = TelegramService.getInstance();
  private signalHistory: AnalyzeResult[] = [];
  private signalHistoryLimit: number = 100;

  public async constructAndSendOpportunityList(results: AnalyzeResult[]) {
    if (results.length > 0) {
      let message = "";

      results.forEach((signal, index) => {
        let tmpMessage = "";

        let symbolAndTimeFrameText = `${trimUSDT(signal.symbol)} - ${
          signal.timeFrame
        }`;
        let trendIcon =
          signal.direction === TrendDirection.BULLISH ? "🟢" : "🔴";
        let strategyIcon = "🔮";
        let strategyLabel = "";

        let signalIsNotInRecentHistory = this.signalNotInRecentList(signal);

        if (signalIsNotInRecentHistory) {
          if (signal.strategy === AnalyzeStrategy.RSI_DIVERGENCE) {
            strategyIcon = "💎";
            strategyLabel = " (RSI-DVG)";
          }

          if (signal.strategy === AnalyzeStrategy.RSI_WITH_BB) {
            strategyIcon = "🔥";
            strategyLabel = " (RSI+BB)";
          }

          tmpMessage = `${trendIcon} - ${symbolAndTimeFrameText} - ${strategyIcon}${strategyLabel}\n`;
          message += tmpMessage;
        }

        this.pushToRecentSignals(signal);
      });

      if (message.length > 0) {
        this.telegramService.pushMessage(
          message,
          TelegramChannels.paperTradeChannel
        );
      }
    }
  }

  private pushToRecentSignals(signal: AnalyzeResult) {
    this.signalHistory.unshift(signal);
    if (this.signalHistory.length > this.signalHistoryLimit) {
      this.signalHistory.pop();
    }
  }

  private signalNotInRecentList(signal: AnalyzeResult): boolean {
    let lastSignalEventNumber: number | null = null;

    this.signalHistory.some((item) => {
      if (
        item.symbol === signal.symbol &&
        item.strategy === signal.strategy &&
        item.timeFrame === signal.timeFrame
      ) {
        lastSignalEventNumber = item.eventNumber;
        return true;
      }
    });

    if (lastSignalEventNumber) {
      if (signal.eventNumber > lastSignalEventNumber + 20) {
        return true;
      } else {
        return false;
      }
    } else {
      return true;
    }
  }
}
