import { RSI, BollingerBands } from "technicalindicators";
import { ChartTimeFrame } from "../enums/chart-timeframes.enum";
import { ChartData } from "../models/chart-data";
import { PriceRecordDto } from "../models/price-record.dto";
import "dotenv/config";
import { AnalyzeStrategyService } from "./analyze-strategy-service";
import { AnalyzeResult } from "../models/analyze-result.model";
import { MessageConstructService } from "./message-construct-service";
import { filterBestOpportunities } from "./analyze-strategies/filter-best-opportunities";
import { TrendDirection } from "../enums/trend-direction.enum";
import { AnalyzeStrategy } from "../enums/analyze-strategies.enum";
import {
  findBollingerBandPercentage,
  bollingerBandScore,
} from "./analyze-strategies/bollinger-bands";

export class DataAnalyzeService {
  private static _instance: DataAnalyzeService;

  private analyzeStrategyService = AnalyzeStrategyService.getInstance();
  private messageConstructService = MessageConstructService.getInstance();

  private opportunityList: AnalyzeResult[] = [];
  private importantOpportunityList: AnalyzeResult[] = [];

  private selectedSymbolList: string[] = [];

  private highestBbScore = 0;
  private lowestBbScore = 0;

  private highestRsiScore = 0;
  private lowestRsiScore = 100;

  private highestBbResult?: AnalyzeResult | null;
  private lowestBbResult?: AnalyzeResult | null;

  private highestRsiResult?: AnalyzeResult | null;
  private lowestRsiResult?: AnalyzeResult | null;

  public static getInstance() {
    return this._instance || (this._instance = new this());
  }

  public async analyzeData(
    chartData: ChartData,
    chartTimeFrame: ChartTimeFrame
  ) {
    Object.keys(chartData).forEach((key: string) => {
      let closingPrices: number[] = [];
      let symbol = key;

      chartData[key].forEach((element: PriceRecordDto) => {
        closingPrices.push(element.close);
      });

      // calculate required data to analyze chart
      let bollingerBandResults = BollingerBands.calculate({
        values: closingPrices,
        period: 55,
        stdDev: 3,
      });

      let rsiResults14 = RSI.calculate({
        values: closingPrices,
        period: 14,
      });

      let rsiResults3 = RSI.calculate({
        values: closingPrices,
        period: 3,
      });

      // custom logic to analyze chart

      let tmpAnalyzedResult = this.analyzeStrategyService.findOpportunity(
        symbol,
        chartTimeFrame,
        chartData[key],
        rsiResults14,
        rsiResults3,
        bollingerBandResults
      );

      let timeFrameIsAllowed =
        tmpAnalyzedResult?.timeFrame === ChartTimeFrame.ONE_HOUR ||
        tmpAnalyzedResult?.timeFrame === ChartTimeFrame.TWO_HOUR ||
        tmpAnalyzedResult?.timeFrame === ChartTimeFrame.FOUR_HOUR;

      if (tmpAnalyzedResult != null && timeFrameIsAllowed) {
        // important opportunities
        if (
          tmpAnalyzedResult.strategy === AnalyzeStrategy.RSI_3PERIOD_OVEREXTEND
        ) {
          this.importantOpportunityList.push(tmpAnalyzedResult);
        } else if (!this.selectedSymbolList.includes(key)) {
          let lastPrice = closingPrices[closingPrices.length - 1];
          let lastBbValue =
            bollingerBandResults[bollingerBandResults.length - 1];
          let lastRsiValue = rsiResults14[rsiResults14.length - 1];
          let bbPercentage = findBollingerBandPercentage(
            tmpAnalyzedResult.direction,
            lastPrice,
            lastBbValue
          );

          tmpAnalyzedResult.bollingerBandPercentage = bbPercentage;
          tmpAnalyzedResult.rsiValue = lastRsiValue;

          this.selectedSymbolList.push(key);
          this.opportunityList.push(tmpAnalyzedResult);
        }
      }

      /// find highest and lowest

      if (chartTimeFrame === ChartTimeFrame.FOUR_HOUR) {
        let tmpRsiBbScore = bollingerBandScore(
          closingPrices[closingPrices.length - 1],
          bollingerBandResults[bollingerBandResults.length - 1],
          rsiResults14[rsiResults14.length - 1]
        );

        let lastClosedRsi = rsiResults14[rsiResults14.length - 1];

        if (tmpRsiBbScore > 0.8 && this.highestBbScore < tmpRsiBbScore) {
          this.highestBbScore = tmpRsiBbScore;
          this.highestBbResult = <AnalyzeResult>{
            symbol: symbol,
            strategy: AnalyzeStrategy.HIGHEST_BB,
            direction: TrendDirection.BEARISH,
            timeFrame: chartTimeFrame,
            eventNumber: chartData[key][chartData[key].length - 1].event_number,
            rsiValue: rsiResults14[rsiResults14.length - 1],
            targetPrice: 0,
          };
        }

        if (tmpRsiBbScore < -0.8 && this.lowestBbScore > tmpRsiBbScore) {
          this.lowestBbScore = tmpRsiBbScore;
          this.lowestBbResult = <AnalyzeResult>{
            symbol: symbol,
            strategy: AnalyzeStrategy.LOWEST_BB,
            direction: TrendDirection.BULLISH,
            timeFrame: chartTimeFrame,
            eventNumber: chartData[key][chartData[key].length - 1].event_number,
            rsiValue: rsiResults14[rsiResults14.length - 1],
            targetPrice: 0,
          };
        }

        if (lastClosedRsi > 70 && this.highestRsiScore < lastClosedRsi) {
          this.highestRsiScore = lastClosedRsi;
          this.highestRsiResult = <AnalyzeResult>{
            symbol: symbol,
            strategy: AnalyzeStrategy.HIGHEST_RSI,
            direction: TrendDirection.BEARISH,
            timeFrame: chartTimeFrame,
            eventNumber: chartData[key][chartData[key].length - 1].event_number,
            rsiValue: rsiResults14[rsiResults14.length - 1],
            targetPrice: 0,
          };
        }

        if (lastClosedRsi < 30 && this.lowestRsiScore > lastClosedRsi) {
          this.lowestRsiScore = lastClosedRsi;
          this.lowestRsiResult = <AnalyzeResult>{
            symbol: symbol,
            strategy: AnalyzeStrategy.LOWEST_RSI,
            direction: TrendDirection.BULLISH,
            timeFrame: chartTimeFrame,
            eventNumber: chartData[key][chartData[key].length - 1].event_number,
            rsiValue: rsiResults14[rsiResults14.length - 1],
            targetPrice: 0,
          };
        }
      }
    });
  }

  public async finishSessionProcessing() {
    this.analyzeStrategyService.logSessionSignals();

    let filteredOpportunityList = filterBestOpportunities(
      this.opportunityList,
      3
    );

    let extraOpportunities = [];

    if (this.lowestBbResult) {
      extraOpportunities.push(this.lowestBbResult);
    }
    if (this.lowestRsiResult) {
      extraOpportunities.push(this.lowestRsiResult);
    }

    if (this.highestBbResult) {
      extraOpportunities.push(this.highestBbResult);
    }
    if (this.highestRsiResult) {
      extraOpportunities.push(this.highestRsiResult);
    }

    this.messageConstructService.constructAndSendOpportunityList([
      ...filteredOpportunityList,
      ...this.importantOpportunityList,
      ...extraOpportunities,
    ]);

    this.importantOpportunityList = [];
    this.opportunityList = [];
    this.selectedSymbolList = [];

    this.highestBbScore = 0;
    this.lowestBbScore = 0;

    this.highestRsiScore = 0;
    this.lowestRsiScore = 100;

    this.highestBbResult = null;
    this.lowestBbResult = null;

    this.highestRsiResult = null;
    this.lowestRsiResult = null;
  }
}
