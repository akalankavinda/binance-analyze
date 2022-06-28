import { Subject } from "rxjs";
import { RSI, EMA, BollingerBands } from "technicalindicators";
import { ChartTimeframe } from "../enums/chart-timeframes.enum";
import { ChartData } from "../models/chart-data";
import { PriceRecordDto } from "../models/price-record.dto";
import { LogWriterService } from "./log-writer.service";
import "dotenv/config";
import * as Utils from "./utils";
import { BullishCandidate } from "../models/bullish-candidate.model";
import { PaperTradeSouce } from "../models/paper-trade-source.model";
import { BearishCandidate } from "../models/bearish-candidate.model";
import { AnalyzeStrategyService } from "./analyze-strategy-service";
import { MessageConstructService } from "./message-construct-service";

export class DataAnalyzeService {
  private static _instance: DataAnalyzeService;

  private analyzeStrategyService = AnalyzeStrategyService.getInstance();
  private messageConstructService = MessageConstructService.getInstance();
  private logWriter = LogWriterService.getInstance();

  private recordHistoryLimit = Number(process.env.EVENT_HISTORY_READ_LIMIT);
  private bullishCandidateList: BullishCandidate[] = [];
  private bearishCandidateList: BearishCandidate[] = [];
  private selectedSymbolList: string[] = [];

  public oppotunityBroadcaster$: Subject<PaperTradeSouce> =
    new Subject<PaperTradeSouce>();

  public sessionFinishBroadcaster$: Subject<number> = new Subject<number>();

  public static getInstance() {
    return this._instance || (this._instance = new this());
  }

  public async analyzeData(
    chartData: ChartData,
    chartTimeframe: ChartTimeframe
  ) {
    this.logWriter.info(`analyzing ${chartTimeframe} data`);

    Object.keys(chartData).forEach((key: string) => {
      let inputValues: number[] = [];
      let latestPrice = chartData[key][chartData[key].length - 1].close;
      let symbol = key;

      chartData[key].forEach((element: PriceRecordDto) => {
        inputValues.push(element.close);
      });

      // calculate required data to analyze chart
      let bollingerBandResults = BollingerBands.calculate({
        values: inputValues,
        period: 55,
        stdDev: 3,
      });
      let rsiResults = RSI.calculate({
        values: inputValues,
        period: 14,
      });

      let ema9Results = EMA.calculate({
        values: inputValues,
        period: 9,
      });
      let ema18Results = EMA.calculate({
        values: inputValues,
        period: 18,
      });

      let rsiBullish = false;
      let rsiOverSold = false;
      let bollingerBandNearBottom = false;
      let emaBullish = false;

      // custom logic to analyze chart

      // just oversold
      rsiOverSold = this.analyzeStrategyService.rsiOverSold(
        rsiResults,
        symbol,
        chartTimeframe
      );

      // oversold + trending bullish
      rsiBullish = this.analyzeStrategyService.rsiOverSoldAndTurningBullish(
        rsiResults,
        symbol,
        chartTimeframe
      );

      bollingerBandNearBottom =
        this.analyzeStrategyService.bollingerBandNearBottom(
          inputValues,
          bollingerBandResults,
          symbol,
          chartTimeframe
        );

      emaBullish = this.analyzeStrategyService.ema9Cross18Upwards(
        inputValues,
        ema9Results,
        ema18Results,
        symbol,
        chartTimeframe
      );

      let requiredLogBbBearish = rsiOverSold || bollingerBandNearBottom;

      let bollingerBandIsNotBearish =
        this.analyzeStrategyService.bollingerBandIsNotBearish(
          inputValues,
          bollingerBandResults,
          symbol,
          chartTimeframe,
          requiredLogBbBearish
        );

      if (rsiBullish || bollingerBandNearBottom || emaBullish) {
        let lastPriceRecord = chartData[key][chartData[key].length - 1];

        if (bollingerBandIsNotBearish) {
          if (!this.selectedSymbolList.includes(key)) {
            this.selectedSymbolList.push(key);

            let lastBbValue =
              bollingerBandResults[bollingerBandResults.length - 1];
            let bbDownPercentage =
              ((lastBbValue.middle - lastPriceRecord.close) /
                (lastBbValue.middle - lastBbValue.lower)) *
              100;

            let tmpTradeSource = <BullishCandidate>{
              priceRecord: lastPriceRecord,
              lastBollingerValue: lastBbValue,
              bollingerBandPercentage: bbDownPercentage,
              lastRsiValue: rsiResults[rsiResults.length - 1],
              rsiBullish: rsiBullish,
              bollingerNearBottom: bollingerBandNearBottom,
              emaCrossedBullish: emaBullish,
              timeFrame: chartTimeframe,
            };

            this.bullishCandidateList.push(tmpTradeSource);
          }
        } else {
          this.bearishCandidateList.push(<BearishCandidate>{
            symbol: symbol,
            timeFrame: chartTimeframe,
            lastPriceRecord: lastPriceRecord,
          });
        }
      }
    });
  }

  public async finishCurrentSessionProcessing() {
    await this.broadcastOpportunityListForTrading();

    this.bullishCandidateList = [];
    this.bearishCandidateList = [];
    this.selectedSymbolList = [];

    //await this.messageConstructService.constructAndSendSessionAnalysisUpdate();
    this.sessionFinishBroadcaster$.next(1);
  }

  public async broadcastOpportunityListForTrading() {
    let filteredBullishList = this.bullishCandidateList.filter((bullItem) => {
      let notBearish = true;
      this.bearishCandidateList.forEach((bearItem) => {
        if (
          bullItem.priceRecord.symbol === bearItem.symbol &&
          bullItem.timeFrame === bearItem.timeFrame
        ) {
          notBearish = false;
        }
      });
      return notBearish;
    });

    let paperTradeSource: PaperTradeSouce = {
      bullishList: filteredBullishList,
      bearishList: this.bearishCandidateList,
    };

    if (this.bullishCandidateList.length > 0) {
      this.oppotunityBroadcaster$.next(paperTradeSource);
    }
  }
}
