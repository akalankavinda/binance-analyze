import { BollingerBandsOutput } from "technicalindicators/declarations/volatility/BollingerBands";
import { ChartTimeFrame } from "../enums/chart-timeframes.enum";
import { AnalyzeResult } from "../models/analyze-result.model";
import { PriceRecordDto } from "../models/price-record.dto";
import { findOpportunity as findRsiDivergenceOpportunity } from "./analyze-strategies/rsi-divergence";
import { rsiTripleDivergenceFormed } from "./analyze-strategies/rsi-divergence";
import { findOpportunity as findBollingerBandOpportunity } from "./analyze-strategies/bollinger-bands";
import { formedSwingHighOrLow } from "./analyze-strategies/swing-high-low";
import { AnalyzeStrategy } from "../enums/analyze-strategies.enum";
import { trimUSDT } from "./utils";
import { LogWriterService } from "./log-writer.service";

export class AnalyzeStrategyService {
  // singleton
  private static _instance: AnalyzeStrategyService;
  public static getInstance() {
    return this._instance || (this._instance = new this());
  }

  private logWriter = LogWriterService.getInstance();

  private analyzedCandidates: AnalyzeResult[] = [];
  private newCandidatesList: AnalyzeResult[] = [];

  public findOpportunity(
    symbol: string,
    timeFrame: ChartTimeFrame,
    candleData: PriceRecordDto[],
    rsiResults: number[],
    bbResults: BollingerBandsOutput[]
  ): AnalyzeResult | null {
    let rsiDivergenceOpportunity = findRsiDivergenceOpportunity(
      symbol,
      timeFrame,
      candleData,
      rsiResults
    );
    if (rsiDivergenceOpportunity) {
      this.pushToCandidateList({
        ...rsiDivergenceOpportunity,
        strategy: AnalyzeStrategy.RSI_TRIPLE_DIVERGENCE,
      });
      this.newCandidatesList.push(rsiDivergenceOpportunity);
      return rsiDivergenceOpportunity;
    }

    let bbOpportunity = findBollingerBandOpportunity(
      symbol,
      timeFrame,
      candleData,
      bbResults,
      rsiResults
    );
    if (bbOpportunity) {
      this.pushToCandidateList(bbOpportunity);
      this.newCandidatesList.push(bbOpportunity);
    }

    return this.processCandidateList(symbol, timeFrame, candleData, rsiResults);
  }

  private pushToCandidateList(newCandidate: AnalyzeResult): void {
    let alreadyInTheList = false;
    let listIndex = -1;
    this.analyzedCandidates.forEach((item, index) => {
      if (
        item.symbol === newCandidate.symbol &&
        item.strategy === newCandidate.strategy &&
        item.timeFrame === newCandidate.timeFrame &&
        item.direction === newCandidate.direction
      ) {
        alreadyInTheList = true;
        listIndex = index;
      }
    });
    if (alreadyInTheList) {
      this.analyzedCandidates[listIndex] = newCandidate;
    } else {
      this.analyzedCandidates.push(newCandidate);
    }
  }

  private processCandidateList(
    symbol: string,
    timeFrame: ChartTimeFrame,
    candleData: PriceRecordDto[],
    rsiResults: number[]
  ): AnalyzeResult | null {
    let analyzedResult: AnalyzeResult | null = null;

    this.analyzedCandidates.forEach((candidate, index) => {
      let symbolMatched = symbol === candidate.symbol;
      let timeFrameMatched = timeFrame === candidate.timeFrame;

      if (symbolMatched && timeFrameMatched) {
        let tooLate = false;
        let expireCandleLimit = 10;
        let lastClosedCandle = candleData[candleData.length - 2];

        if (candidate.strategy === AnalyzeStrategy.RSI_TRIPLE_DIVERGENCE) {
          expireCandleLimit = 50;
        }

        if (
          lastClosedCandle.event_number - candidate.eventNumber >
          expireCandleLimit
        ) {
          tooLate = true;
        }

        if (tooLate) {
          this.analyzedCandidates.splice(index, 1);
        } else {
          if (candidate.strategy === AnalyzeStrategy.RSI_TRIPLE_DIVERGENCE) {
            // lok for triple divergence pattern
            let rsiTripleDivergence = rsiTripleDivergenceFormed(
              candleData,
              rsiResults,
              candidate
            );
            if (rsiTripleDivergence) {
              candidate.eventNumber = lastClosedCandle.event_number;
              analyzedResult = { ...candidate };
              this.analyzedCandidates.splice(index, 1);
            }
          } else if (candidate.strategy === AnalyzeStrategy.RSI_WITH_BB) {
            let hasFormedSwingHighOrLow = formedSwingHighOrLow(
              candleData,
              candidate
            );

            if (hasFormedSwingHighOrLow) {
              analyzedResult = { ...candidate };
              this.analyzedCandidates.splice(index, 1);
            }
          }
        }
      }
    });

    return analyzedResult;
  }

  public logSessionSignals() {
    if (this.newCandidatesList.length > 0) {
      let logMessage = "candidates: ";
      this.newCandidatesList.forEach((item) => {
        logMessage += `${trimUSDT(item.symbol)}-${item.timeFrame}, `;
      });
      this.logWriter.info(logMessage);
    }
    this.newCandidatesList = [];
  }
}
