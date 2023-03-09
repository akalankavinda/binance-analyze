import { AnalyzeStrategy } from "../enums/analyze-strategies.enum";
import { ChartTimeFrame } from "../enums/chart-timeframes.enum";
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

  public async constructAndSendOpportunityList(
    results: AnalyzeResult[],
    targetChannel: TelegramChannels = TelegramChannels.ALERTS_CHANNEL
  ) {
    if (results.length > 0) {
      let message = "";

      results.forEach((signal, index) => {
        let tmpMessage = "";

        let symbolAndTimeFrameText = `${trimUSDT(signal.symbol)} - ${
          signal.timeFrame
        }`;
        let trendIcon =
          signal.direction === TrendDirection.BULLISH ? "🟢" : "🔴";
        let strategyIcon = "";
        let strategyLabel = "";

        let signalIsNotInRecentHistory = this.signalNotInRecentList(signal);

        if (signalIsNotInRecentHistory) {
          if (signal.strategy === AnalyzeStrategy.RSI_DIVERGENCE) {
            strategyIcon = "💎";
            strategyLabel = " (RSI-DVG)";
          }

          if (signal.strategy === AnalyzeStrategy.RSI_3_DIVERGENCE) {
            strategyIcon = "💰";
            strategyLabel = " (RSI3-DVG)";
          }

          if (signal.strategy === AnalyzeStrategy.PUMP_OR_DUMP) {
            strategyIcon = "🔮";
            strategyLabel =
              signal.direction === TrendDirection.BULLISH
                ? " (PUMP)"
                : " (DUMP)";
          }

          if (signal.strategy === AnalyzeStrategy.RSI_WITH_BB) {
            strategyIcon = "🔥";
            strategyLabel = " (RSI+BB)";
          }

          if (signal.strategy === AnalyzeStrategy.SWING_HIGH_LOW) {
            strategyIcon = "🔔";
            strategyLabel =
              signal.direction === TrendDirection.BULLISH
                ? " (SWING-L)"
                : " (SWING-H)";
          }

          if (signal.strategy === AnalyzeStrategy.RSI_3PERIOD_OVEREXTEND) {
            strategyIcon = "🔥";
            strategyLabel =
              signal.direction === TrendDirection.BULLISH
                ? " (RSI3-OverSold)"
                : " (RSI3-Overbought)";
          }

          if (signal.strategy === AnalyzeStrategy.HIGHEST_BB) {
            strategyLabel = " (Highest-BB)";
          }

          if (signal.strategy === AnalyzeStrategy.HIGHEST_RSI) {
            strategyLabel = " (Highest-RSI)";
          }

          if (signal.strategy === AnalyzeStrategy.LOWEST_BB) {
            strategyLabel = " (Lowest-BB)";
          }

          if (signal.strategy === AnalyzeStrategy.LOWEST_RSI) {
            strategyLabel = " (Lowest-RSI)";
          }

          tmpMessage = `${trendIcon} - ${symbolAndTimeFrameText} - ${strategyIcon}${strategyLabel}\n`;
          message += tmpMessage;

          this.pushToRecentSignals(signal);
        }
      });

      if (message.length > 0) {
        this.telegramService.pushMessage(message, targetChannel);
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

    let skipStrategy =
      signal.strategy === AnalyzeStrategy.RSI_DIVERGENCE ||
      signal.strategy === AnalyzeStrategy.SWING_HIGH_LOW;

    this.signalHistory.some((item) => {
      if (
        item.symbol === signal.symbol &&
        item.strategy === signal.strategy &&
        item.timeFrame === signal.timeFrame &&
        // skip this checkup for RSI-Divergence
        !skipStrategy
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
