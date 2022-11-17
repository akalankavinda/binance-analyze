import { RSI, BollingerBands } from "technicalindicators";
import { ChartTimeFrame } from "../enums/chart-timeframes.enum";
import { ChartData } from "../models/chart-data";
import { PriceRecordDto } from "../models/price-record.dto";
import "dotenv/config";
import { AnalyzeStrategyService } from "./analyze-strategy-service";
import { AnalyzeResult } from "../models/analyze-result.model";
import { MessageConstructService } from "./message-construct-service";
import { filterBestOpportunities } from "./analyze-strategies/filter-best-opportunities";
import { findBollingerBandPercentage } from "./analyze-strategies/bollinger-bands";

export class DataAnalyzeService {
  private static _instance: DataAnalyzeService;

  private analyzeStrategyService = AnalyzeStrategyService.getInstance();
  private messageConstructService = MessageConstructService.getInstance();

  private opportunityList: AnalyzeResult[] = [];
  private selectedSymbolList: string[] = [];

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
        stdDev: 2,
      });

      let rsiResults = RSI.calculate({
        values: closingPrices,
        period: 14,
      });

      // custom logic to analyze chart

      let tmpAnalyzedResult = this.analyzeStrategyService.findOpportunity(
        symbol,
        chartTimeFrame,
        chartData[key],
        rsiResults,
        bollingerBandResults
      );

      if (tmpAnalyzedResult != null) {
        if (!this.selectedSymbolList.includes(key)) {
          let lastPrice = closingPrices[closingPrices.length - 1];
          let lastBbValue =
            bollingerBandResults[bollingerBandResults.length - 1];
          let lastRsiValue = rsiResults[rsiResults.length - 1];
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
    });
  }

  public async finishSessionProcessing() {
    this.analyzeStrategyService.logSessionSignals();

    let filteredOpportunityList = filterBestOpportunities(
      this.opportunityList,
      3
    );

    this.messageConstructService.constructAndSendOpportunityList(
      filteredOpportunityList
    );

    this.opportunityList = [];
    this.selectedSymbolList = [];
  }
}
