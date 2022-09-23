import { AnalyzeStrategy } from "../enums/analyze-strategies.enum";
import { TelegramChannels } from "../enums/telegram-channels.enum";
import { TrendDirection } from "../enums/trend-direction.enum";
import { AnalyzeResult } from "../models/analyze-result.model";
import { TelegraService } from "./telegram.service";
import { trimUSDT } from "./utils";

export class MessageConstructService {
  // make singleton
  private static _instance: MessageConstructService;
  public static getInstance() {
    return this._instance || (this._instance = new this());
  }

  private telegramService = TelegraService.getInstance();
  private messageHistory: string[] = [];
  private messageHistoryLimit: number = 25;

  public async constructAndSendOpportunityList(results: AnalyzeResult[]) {
    if (results.length > 0) {
      let message = "";

      results.forEach((item, index) => {
        let tmpMessage = "";

        let symbolAndTimeframeText = `${trimUSDT(item.symbol)} - ${
          item.timeFrame
        }`;
        let trendIcon = item.direction === TrendDirection.BULLISH ? "🟢" : "🔴";
        let strategyIcon = "🔮";
        let strategyLabel = "";

        let signalIsInHistory = this.messageIsInRecentList(
          symbolAndTimeframeText
        );

        if (item.strategy === AnalyzeStrategy.RSI_DIVERGENCE) {
          strategyIcon = "💎";
          strategyLabel = " (RSI-DVG)";
        }
        if (item.strategy === AnalyzeStrategy.RSI_WITH_BB) {
          strategyIcon = "🔥";
          strategyLabel = " (RSI+BB)";
        }

        this.pushToPreviousMessages(symbolAndTimeframeText);

        if (signalIsInHistory) {
          strategyIcon = "";
        } else {
          tmpMessage = `${trendIcon} - ${symbolAndTimeframeText} - ${strategyIcon}${strategyLabel}\n`;
          message += tmpMessage;
        }
      });

      if (message.length > 0) {
        this.telegramService.pushMessage(
          message,
          TelegramChannels.paperTradeChannel
        );
      }
    }
  }

  private pushToPreviousMessages(text: string) {
    this.messageHistory.unshift(text);
    if (this.messageHistory.length > this.messageHistoryLimit) {
      this.messageHistory.pop();
    }
  }

  private messageIsInRecentList(text: string): boolean {
    return this.messageHistory.some((message) => {
      if (message === text) {
        return true;
      }
    });
  }
}
