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

  private bullishCandidateList: BullishCandidate[] = [];
  private bearishCandidateList: BearishCandidate[] = [];
  private selectedSymbolList: string[] = [];
  private tradeOnlyDownCoins = false;

  public oppotunityBroadcaster$: Subject<PaperTradeSouce> =
    new Subject<PaperTradeSouce>();

  public sessionFinishBroadcaster$: Subject<number> = new Subject<number>();
  public session1HourEndBroadcaster$: Subject<number> = new Subject<number>();

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

      let sma50Results = SMA.calculate(<MAInput>{
        values: inputValues,
        period: 50,
      });

      let sma200Results = SMA.calculate(<MAInput>{
        values: inputValues,
        period: 200,
      });

      if (key === "BTCUSDT") {
        this.tradeOnlyDownCoins =
          this.analyzeStrategyService.bollingerBandNearTopBand(
            inputValues,
            bollingerBandResults
          );
      }

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
          inputValues,
          rsiResults,
          sma50Results,
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
              currentRsiValue: rsiResults[rsiResults.length - 1],
              currentBollingerBandPercentageFromBottom: 100 - bbDownPercentage,
            };

            if (this.doesNotExistInBullishList(symbol)) {
              this.bullishCandidateList.push(tmpTradeSource);
            }
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

  public async finish15MinuteSessionProcessing() {
    await this.broadcastOpportunityListForTrading();

    this.bullishCandidateList = [];
    this.bearishCandidateList = [];
    this.selectedSymbolList = [];

    this.sessionFinishBroadcaster$.next(1);
  }

  public async finish1HourSessionProcessing() {
    this.session1HourEndBroadcaster$.next(1);
  }

  private doesNotExistInBullishList(symbol: string) {
    let doesNotExist = true;
    this.bullishCandidateList.forEach((item) => {
      if (item.priceRecord.symbol === symbol) {
        doesNotExist = false;
      }
    });
    return doesNotExist;
  }

  public async broadcastOpportunityListForTrading() {
    let filteredBullishList = this.analyzeStrategyService.findBestOpportunity(
      this.bullishCandidateList,
      this.bearishCandidateList,
      this.tradeOnlyDownCoins,
      5
    );

    let paperTradeSource: PaperTradeSouce = {
      bullishList: filteredBullishList,
      bearishList: this.bearishCandidateList,
    };

    if (this.bullishCandidateList.length > 0) {
      this.oppotunityBroadcaster$.next(paperTradeSource);
    }
  }
}
