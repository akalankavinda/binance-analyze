import { Subject } from "rxjs";
import { RSI, EMA, BollingerBands, SMA } from "technicalindicators";
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
import { MAInput } from "technicalindicators/declarations/moving_averages/SMA";
import { AnalyzeStrategy } from "../enums/analyze-strategies.enum";

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

      let sma200Results = SMA.calculate(<MAInput>{
        values: inputValues,
        period: 200,
      });

      let rsiBullish = false;
      let bollingerBandBullishBottom = false;
      let rsiBullishDivergenceFormed = false;
      let rsiWithMOvingAverageIsBullish = false;

      // custom logic to analyze chart

      // oversold + trending bullish
      rsiBullish = this.analyzeStrategyService.rsiOverSoldAndTurningBullish(
        rsiResults,
        symbol,
        chartTimeframe
      );

      rsiWithMOvingAverageIsBullish =
        this.analyzeStrategyService.rsiWithMovingAverageIsBullish(
          rsiResults,
          sma200Results,
          symbol,
          chartTimeframe
        );

      rsiBullishDivergenceFormed =
        this.analyzeStrategyService.rsiBullishDivergenceFormed(
          inputValues,
          rsiResults,
          symbol,
          chartTimeframe
        );

      bollingerBandBullishBottom =
        this.analyzeStrategyService.bollingerBandBullishBottom(
          inputValues,
          bollingerBandResults,
          symbol,
          chartTimeframe
        );

      let bollingerBandIsNotBearish =
        this.analyzeStrategyService.bollingerBandIsNotBearish(
          inputValues,
          bollingerBandResults,
          symbol,
          chartTimeframe
        );

      let selectedStrategy = AnalyzeStrategy.NOT_AVAILABLE;
      if (rsiBullishDivergenceFormed) {
        selectedStrategy = AnalyzeStrategy.RSI_BULLISH_DIVERGENCE;
      } else if (bollingerBandBullishBottom) {
        selectedStrategy = AnalyzeStrategy.BOLLINGER_BAND_BULLISH;
      } else if (rsiWithMOvingAverageIsBullish) {
        selectedStrategy = AnalyzeStrategy.RSI_WITH_MA_BULLISH;
      } else if (rsiBullish) {
        selectedStrategy = AnalyzeStrategy.RSI_BULLISH;
      }

      if (selectedStrategy != AnalyzeStrategy.NOT_AVAILABLE) {
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
              strategy: selectedStrategy,
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
