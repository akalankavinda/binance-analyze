import { DataStorageTable } from "../enums/data-storage-tables.enum";
import { PriceRecordDto } from "../models/price-record.dto";
import * as MySql from "mysql2/promise";
import { Subject } from "rxjs";
import "dotenv/config";
import { ChartData } from "../models/chart-data";
import { DataAnalyzeService } from "./data-analyze.service";
import { ChartTimeframe } from "../enums/chart-timeframes.enum";
import { LogWriterService } from "./log-writer.service";
import { TradingSymbols } from "./utils";

export class DataStorageService {
  private dataAnalyzeService: DataAnalyzeService =
    DataAnalyzeService.getInstance();
  private logWriter = LogWriterService.getInstance();

  private conn!: MySql.Pool;
  private recordHistoryLimit = Number(process.env.EVENT_HISTORY_READ_LIMIT);

  public data1MinuteBroadcaster$: Subject<ChartData> = new Subject<ChartData>();
  public data1HourBroadcaster$: Subject<ChartData> = new Subject<ChartData>();

  private last1MinuteEventNumber: number = 0;
  private latestSymbolValues: ChartData = {};

  private static _instance: DataStorageService;

  public static getInstance() {
    return this._instance || (this._instance = new this());
  }

  constructor() {
    this.connectToDatabase();
  }

  private async connectToDatabase(): Promise<void> {
    this.conn = await MySql.createPool({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USERNAME,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      waitForConnections: true,
      connectionLimit: 10,
    });
    this.subscribeToChartData();
  }

  subscribeToChartData(): void {
    setInterval(() => {
      let currentTimeStamp = new Date().getTime();
      let current1MinuteEventNumber = Math.floor(currentTimeStamp / 60000);
      this.fetch1MinuteChartData(current1MinuteEventNumber);
    }, 20000);
  }

  private async fetch1MinuteChartData(eventNumber1Minute: number) {
    if (this.last1MinuteEventNumber < eventNumber1Minute) {
      this.last1MinuteEventNumber = eventNumber1Minute;

      const currentTimeFrameData = await this.fetchAndFormatData(
        DataStorageTable.table1Minute,
        eventNumber1Minute
      );
      if (currentTimeFrameData) {
        let tmpLatestSymbolValues: ChartData = {};
        Object.keys(currentTimeFrameData).forEach((key: string) => {
          tmpLatestSymbolValues[key] = [
            currentTimeFrameData[key][currentTimeFrameData[key].length - 1],
          ];
        });
        this.latestSymbolValues = tmpLatestSymbolValues;
        this.data1MinuteBroadcaster$.next(this.latestSymbolValues);
      }

      //this.fetchChartData(eventNumber1Minute);

      if (eventNumber1Minute % 10 === 0) {
        this.fetchChartData(eventNumber1Minute);
      }

      // if (eventNumber1Minute % 2 === 0) {
      //   let eventNumber15Minute = eventNumber1Minute / 15;
      //   this.fetchChartData(eventNumber15Minute);
      // }
    }
  }

  private async fetchChartData(eventNumber1Minute: number) {
    let eventNumber5Minute = Math.floor(eventNumber1Minute / 5);
    let eventNumber15Minute = Math.floor(eventNumber5Minute / 3);
    let eventNumber30Minute = Math.floor(eventNumber15Minute / 2);
    let eventNumber1Hour = Math.floor(eventNumber30Minute / 2);
    let eventNumber2Hour = Math.floor(eventNumber1Hour / 2);
    let eventNumber4Hour = Math.floor(eventNumber2Hour / 2);
    let eventNumber12Hour = Math.floor(eventNumber4Hour / 2);
    let eventNumber1Day = Math.floor(eventNumber12Hour / 2);

    let chartString = "";

    // // once in the middle of every 1Day candle
    // if (eventNumber15Minute % 96 === 24) {
    //   chartString = `, ${ChartTimeframe.ONE_DAY}${chartString}`;
    //   await this.fetchTimeFrameChartData(
    //     eventNumber1Day,
    //     DataStorageTable.table1Day,
    //     ChartTimeframe.ONE_DAY
    //   );
    // }

    // // once in the middle of every 12Hour candle
    // if (eventNumber15Minute % 48 === 12) {
    //   chartString = `, ${ChartTimeframe.TWELVE_HOUR}${chartString}`;
    //   await this.fetchTimeFrameChartData(
    //     eventNumber12Hour,
    //     DataStorageTable.table12Hour,
    //     ChartTimeframe.TWELVE_HOUR
    //   );
    // }

    // once in the middle of every 4Hour candle
    if (
      eventNumber5Minute % 48 === 2 ||
      eventNumber5Minute % 16 === 14 ||
      eventNumber5Minute % 16 === 26
    ) {
    }

    // once in the middle of every 2Hour candle
    if (
      eventNumber5Minute % 24 === 2 ||
      eventNumber5Minute % 24 === 8 ||
      eventNumber5Minute % 24 === 14
    ) {
    }

    // once in the middle of every 1Hour candle
    if (eventNumber5Minute % 12 === 2 || eventNumber15Minute % 12 === 8) {
    }

    // once in the middle of every 30Minute candle
    if (eventNumber15Minute % 6 === 2) {
    }

    // once every 15Minute candle
    // if (eventNumber5Minute % 3 === 0) {
    if (eventNumber5Minute % 1 === 0) {
      chartString = `, ${ChartTimeframe.FOUR_HOUR}${chartString}`;
      await this.fetchTimeFrameChartData(
        eventNumber4Hour,
        DataStorageTable.table4Hour,
        ChartTimeframe.FOUR_HOUR
      );

      chartString = `, ${ChartTimeframe.TWO_HOUR}${chartString}`;
      await this.fetchTimeFrameChartData(
        eventNumber2Hour,
        DataStorageTable.table2Hour,
        ChartTimeframe.TWO_HOUR
      );

      chartString = `, ${ChartTimeframe.ONE_HOUR}${chartString}`;
      await this.fetchTimeFrameChartData(
        eventNumber1Hour,
        DataStorageTable.table1Hour,
        ChartTimeframe.ONE_HOUR
      );

      chartString = ` ${ChartTimeframe.THIRTY_MINUTE}${chartString}`;
      await this.fetchTimeFrameChartData(
        eventNumber30Minute,
        DataStorageTable.table30Minute,
        ChartTimeframe.THIRTY_MINUTE
      );

      chartString = ` ${ChartTimeframe.FIFTEEN_MINUTE}${chartString}`;
      await this.fetchTimeFrameChartData(
        eventNumber15Minute,
        DataStorageTable.table15Minute,
        ChartTimeframe.FIFTEEN_MINUTE
      );

      // chartString = ` ${ChartTimeframe.FIVE_MINUTE}${chartString}`;
      // await this.fetchTimeFrameChartData(
      //   eventNumber5Minute,
      //   DataStorageTable.table5Minute,
      //   ChartTimeframe.FIVE_MINUTE
      // );
    }

    await this.dataAnalyzeService.finishSessionProcessing();

    if (chartString.length > 0) {
      this.logWriter.info(`analyzing chart data:${chartString}`);
    } else {
      this.logWriter.info(`analyzing skipped`);
    }
  }

  private async fetchTimeFrameChartData(
    eventNumber: number,
    table: DataStorageTable,
    timeFrame: ChartTimeframe
  ) {
    let currentTimeFrameData = await this.fetchAndFormatData(
      table,
      eventNumber
    );

    if (currentTimeFrameData) {
      currentTimeFrameData = this.fillLatestSymbolData(currentTimeFrameData);

      this.dataAnalyzeService.analyzeData(currentTimeFrameData, timeFrame);
    }
  }

  private async fetchAndFormatData(
    tableName: DataStorageTable,
    eventNumber: number
  ): Promise<ChartData | null> {
    let historyLimitEventNumber = eventNumber - this.recordHistoryLimit;
    let fetchQuery = `SELECT * FROM ${tableName} WHERE event_number >= ${historyLimitEventNumber} ORDER BY id ASC;`;
    try {
      const [rows, fields] = await this.conn.execute(fetchQuery);
      let typeCastedResults = <PriceRecordDto[]>rows;
      let tmpChartData: ChartData = {};

      typeCastedResults.forEach((priceRecord: PriceRecordDto) => {
        if (TradingSymbols.includes(priceRecord.symbol)) {
          if (tmpChartData[priceRecord.symbol] === undefined) {
            tmpChartData[priceRecord.symbol] = [priceRecord];
          } else {
            tmpChartData[priceRecord.symbol].push(priceRecord);
          }
        }
      });

      return tmpChartData;
    } catch (error) {
      return null;
    }
  }

  private fillLatestSymbolData(chartData: ChartData): ChartData {
    Object.keys(chartData).forEach((key: string) => {
      if (this.latestSymbolValues[key]) {
        chartData[key].push(this.latestSymbolValues[key][0]);
      }
    });
    return chartData;
  }
}
