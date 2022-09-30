import axios from "axios";
import "dotenv/config";
import { TelegramChannels } from "../enums/telegram-channels.enum";
import { LogWriterService } from "./log-writer.service";

export class TelegramService {
  private static _instance: TelegramService;

  private logWriter = LogWriterService.getInstance();

  private telegramEndpoint!: string;
  private telegramApiToken = <String>process.env.TELEGRAM_API_TOKEN;
  private telegramChatId = process.env.TELEGRAM_PAPER_TRADE_CHAT_ID;
  private telegramLogChatId = process.env.TELEGRAM_LOG_CHAT_ID;

  private telegramChannels = {
    paperTradeChannel: process.env.TELEGRAM_PAPER_TRADE_CHAT_ID,
    logChannel: process.env.TELEGRAM_LOG_CHAT_ID,
  };

  public static getInstance() {
    return this._instance || (this._instance = new this());
  }

  constructor() {
    this.telegramEndpoint = `https://api.telegram.org/bot${this.telegramApiToken}/sendMessage`;

    this.pushMessage(
      `🔰 Analyze bot restarted`,
      TelegramChannels.paperTradeChannel
    );
  }

  public async pushMessage(message: string, channel: TelegramChannels) {
    let postData = {
      chat_id: this.telegramChannels[channel],
      text: message,
      parse_mode: "HTML",
    };

    try {
      let res = await axios.post(this.telegramEndpoint, postData);
    } catch (error) {
      this.logWriter.warn("failed to push data to telegram api");
    }
  }
}
