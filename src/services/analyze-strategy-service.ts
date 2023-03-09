import { BollingerBandsOutput } from "technicalindicators/declarations/volatility/BollingerBands";
import { ChartTimeFrame } from "../enums/chart-timeframes.enum";
import { AnalyzeResult } from "../models/analyze-result.model";
import { PriceRecordDto } from "../models/price-record.dto";
import { findOpportunity as findRsiDivergenceOpportunity } from "./analyze-strategies/rsi-divergence";
import { findOpportunity as findPumpDumpOpportunity } from "./analyze-strategies/pump-dump";
import {
  findOpportunity as findRsi3PeriodOpportunity,
  findOversoldOrOverboughtOpportunity,
} from "./analyze-strategies/rsi-3-period";
import { trimUSDT } from "./utils";
import { LogWriterService } from "./log-writer.service";
import { formedSwingHighOrLow } from "./analyze-strategies/swing-high-low";
import { AnalyzeStrategy } from "../enums/analyze-strategies.enum";

export class AnalyzeStrategyService {
  // singleton
  private static _instance: AnalyzeStrategyService;
  public static getInstance() {
    return this._instance || (this._instance = new this());
  }

  private logWriter = LogWriterService.getInstance();

  private analyzedCandidates: AnalyzeResult[] = [];
  private candidateListForLogging: AnalyzeResult[] = [];

  public findOpportunity(
    symbol: string,
    timeFrame: ChartTimeFrame,
    candleData: PriceRecordDto[],
    rsiResults: number[],
    rsi3PeriodResults: number[],
    bbResults: BollingerBandsOutput[]
  ): AnalyzeResult | null {
    let rsiDivergenceOpportunity = findRsiDivergenceOpportunity(
      symbol,
      timeFrame,
      candleData,
      rsiResults
    );
    if (rsiDivergenceOpportunity) {
      this.candidateListForLogging.push(rsiDivergenceOpportunity);
      //this.pushToCandidateList(rsiDivergenceOpportunity);
      return rsiDivergenceOpportunity;
    }

    // let bbOpportunity = findBollingerBandOpportunity(
    //   symbol,
    //   timeFrame,
    //   candleData,
    //   bbResults,
    //   rsiResults
    // );
    // if (bbOpportunity) {
    //   this.candidateListForLogging.push(bbOpportunity);
    //   this.pushToCandidateList(bbOpportunity);
    //   return bbOpportunity;
    // }

    let pumpDumpOpportunity = findPumpDumpOpportunity(
      symbol,
      timeFrame,
      candleData,
      bbResults,
      rsiResults
    );
    if (pumpDumpOpportunity) {
      this.candidateListForLogging.push(pumpDumpOpportunity);
      //this.pushToCandidateList(pumpDumpOpportunity);
      return pumpDumpOpportunity;
    }

    let rsi3PeriodOpportunity = findRsi3PeriodOpportunity(
      symbol,
      timeFrame,
      candleData,
      rsi3PeriodResults,
      rsiResults
    );
    if (rsi3PeriodOpportunity) {
      this.candidateListForLogging.push(rsi3PeriodOpportunity);
      return rsi3PeriodOpportunity;
    }

    let rsi3PeriodOverExtendOpportunity = findOversoldOrOverboughtOpportunity(
      symbol,
      timeFrame,
      candleData,
      rsi3PeriodResults,
      rsiResults
    );
    if (rsi3PeriodOverExtendOpportunity) {
      this.candidateListForLogging.push(rsi3PeriodOverExtendOpportunity);
      return rsi3PeriodOverExtendOpportunity;
    }

    return null;
    //return this.processCandidateList(symbol, timeFrame, candleData, rsiResults);
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
        let expireCandleLimit = 32;
        let lastClosedCandle = candleData[candleData.length - 2];

        if (
          lastClosedCandle.event_number - candidate.eventNumber >
          expireCandleLimit
        ) {
          tooLate = true;
        }

        if (tooLate) {
          this.analyzedCandidates.splice(index, 1);
        } else {
          let hasFormedSwingHighOrLow = formedSwingHighOrLow(
            candleData,
            candidate
          );

          if (hasFormedSwingHighOrLow) {
            analyzedResult = {
              ...candidate,
              strategy: AnalyzeStrategy.SWING_HIGH_LOW,
            };
            this.analyzedCandidates.splice(index, 1);
          }
        }
      }
    });

    return analyzedResult;
  }

  public logSessionSignals() {
    if (this.candidateListForLogging.length > 0) {
      let logMessage = "candidates: ";
      this.candidateListForLogging.forEach((item) => {
        logMessage += `${trimUSDT(item.symbol)}-${item.timeFrame}, `;
      });
      this.logWriter.info(logMessage);
    }
    this.candidateListForLogging = [];
  }
}
