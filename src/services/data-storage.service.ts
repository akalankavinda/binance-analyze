import { DataStorageTable } from "../enums/data-storage-tables.enum";
import { PriceRecordDto } from "../models/price-record.dto";
import * as MySql from "mysql2/promise";
import { Subject } from "rxjs";
import "dotenv/config";
import { ChartData } from "../models/chart-data";
import { DataAnalyzeService } from "./data-analyze.service";
import { ChartTimeframe } from "../enums/chart-timeframes.enum";
import { LogWriterService } from "./log-writer.service";

export class DataStorageService {
  private dataAnalyzeService: DataAnalyzeService =
    DataAnalyzeService.getInstance();
  private conn!: MySql.Pool;
  private recordHistoryLimit = Number(process.env.EVENT_HISTORY_READ_LIMIT);
  private logWriter = LogWriterService.getInstance();

  public data1MinuteBroadcaster$: Subject<ChartData> = new Subject<ChartData>();

  private last1MinuteEventNumber: number = 0;
  private last15MinuteEventNumber: number = 0;
  private latestSymbolValues: ChartData = {};

  private stableCoins = [
    "USDC",
    "BUSD",
    "DAI",
    "FRAX",
    "TUSD",
    "USDP",
    "USDN",
    "LUSD",
    "USDD",
  ];

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
    }, 10000);
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

      if (eventNumber1Minute % 15 === 0) {
        let eventNumber15Minute = eventNumber1Minute / 15;
        this.fetchChartData(eventNumber15Minute);
      }

      // if (eventNumber1Minute % 2 === 0) {
      //   let eventNumber15Minute = eventNumber1Minute / 15;
      //   this.fetchChartData(eventNumber15Minute);
      // }
    }
  }

  private async fetchChartData(eventNumber15Minute: number) {
    let eventNumber30Minute = Math.floor(eventNumber15Minute / 2);
    let eventNumber1Hour = Math.floor(eventNumber30Minute / 2);
    let eventNumber2Hour = Math.floor(eventNumber1Hour / 2);
    let eventNumber4Hour = Math.floor(eventNumber2Hour / 2);
    let eventNumber12Hour = Math.floor(eventNumber4Hour / 2);
    let eventNumber1Day = Math.floor(eventNumber12Hour / 2);

    // await this.fetchTimeFrameChartData(
    //   eventNumber15Minute,
    //   DataStorageTable.table15Minute,
    //   ChartTimeframe.FIFTEEN_MINUTE
    // );

    await this.fetchTimeFrameChartData(
      eventNumber30Minute,
      DataStorageTable.table30Minute,
      ChartTimeframe.THIRTY_MINUTE
    );

    await this.fetchTimeFrameChartData(
      eventNumber1Hour,
      DataStorageTable.table1Hour,
      ChartTimeframe.ONE_HOUR
    );

    // once every 30 minutes
    if (eventNumber15Minute % 2 === 0) {
      await this.fetchTimeFrameChartData(
        eventNumber2Hour,
        DataStorageTable.table2Hour,
        ChartTimeframe.TWO_HOUR
      );
    }

    // once every 1 hour
    if (eventNumber15Minute % 4 === 0) {
      await this.fetchTimeFrameChartData(
        eventNumber4Hour,
        DataStorageTable.table4Hour,
        ChartTimeframe.FOUR_HOUR
      );
    }

    // once every 2 hour
    if (eventNumber15Minute % 8 === 0) {
      await this.fetchTimeFrameChartData(
        eventNumber12Hour,
        DataStorageTable.table12Hour,
        ChartTimeframe.TWELVE_HOUR
      );
    }

    // once every 4 hour
    if (eventNumber15Minute % 16 === 0) {
      await this.fetchTimeFrameChartData(
        eventNumber1Day,
        DataStorageTable.table1Day,
        ChartTimeframe.ONE_DAY
      );
    }

    await this.dataAnalyzeService.finishCurrentSessionProcessing();
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
        // skip downcoins
        let isDownCoin = false;
        //isDownCoin = priceRecord.symbol.indexOf("DOWN") > 0;

        //skip stablecoins
        let isStableCoin = false;
        this.stableCoins.forEach((item) => {
          if (priceRecord.symbol.includes(item)) {
            isStableCoin = true;
          }
        });

        if (!isStableCoin && !isDownCoin) {
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
