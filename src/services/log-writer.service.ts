import { Logger, createRollingFileLogger } from "simple-node-logger";

export class LogWriterService {
  private static _instance: LogWriterService;

  public static getInstance() {
    return this._instance || (this._instance = new this());
  }

  private logger!: Logger;

  constructor() {
    this.initLogger();
  }

  private initLogger() {
    const opts = {
      errorEventName: "error",
      logDirectory: "./logs", // NOTE: folder must exist and be writable...
      fileNamePattern: "<DATE>.log",
      dateFormat: "YYYY.MM.DD",
      timestampFormat: "YYYY-MM-DD HH:mm:ss",
    };
    this.logger = createRollingFileLogger(opts);
  }

  info(data: string) {
    console.log(data);
    this.logger.info(data);
  }

  warn(data: string) {
    console.log(data);
    this.logger.warn(data);
  }

  fatal(data: string) {
    console.log(data);
    this.logger.fatal(data);
  }
}
