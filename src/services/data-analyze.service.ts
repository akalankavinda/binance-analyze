import { Subject } from "rxjs";
import { RSI, BollingerBands } from "technicalindicators";
import { ChartTimeFrame } from "../enums/chart-timeframes.enum";
import { ChartData } from "../models/chart-data";
import { PriceRecordDto } from "../models/price-record.dto";
import "dotenv/config";
import { AnalyzeStrategyService } from "./analyze-strategy-service";
import { AnalyzeResult } from "../models/analyze-result.model";
import { MessageConstructService } from "./message-construct-service";
import { LogWriterService } from "./log-writer.service";
import { trimUSDT } from "./utils";

export class DataAnalyzeService {
  private static _instance: DataAnalyzeService;

  private analyzeStrategyService = AnalyzeStrategyService.getInstance();
  private messageConstructService = MessageConstructService.getInstance();
  private logWriter = LogWriterService.getInstance();

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
        closingPrices,
        rsiResults,
        bollingerBandResults
      );

      if (tmpAnalyzedResult != null) {
        if (!this.selectedSymbolList.includes(key)) {
          let lastPrice = closingPrices[closingPrices.length - 1];
          let lastBbValue =
            bollingerBandResults[bollingerBandResults.length - 1];
          let lastRsiValue = rsiResults[rsiResults.length - 1];
          let bbPercentage =
            this.analyzeStrategyService.findBollingerBandPercentage(
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
    this.logSessionSignals();

    let filteredOpportunityList =
      this.analyzeStrategyService.filterBestOpportunities(
        this.opportunityList,
        3
      );

    this.messageConstructService.constructAndSendOpportunityList(
      filteredOpportunityList
    );

    this.opportunityList = [];
    this.selectedSymbolList = [];
  }

  private logSessionSignals() {
    if (this.opportunityList.length > 0) {
      let logMessage = "opportunities: ";
      this.opportunityList.forEach((item) => {
        logMessage += `${trimUSDT(item.symbol)}-${item.timeFrame}, `;
      });
      this.logWriter.info(logMessage);
    }
  }
}
