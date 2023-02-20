import { BollingerBandsOutput } from "technicalindicators/declarations/volatility/BollingerBands";
import { ChartTimeFrame } from "../enums/chart-timeframes.enum";
import { AnalyzeResult } from "../models/analyze-result.model";
import { PriceRecordDto } from "../models/price-record.dto";
import { findOpportunity as findRsiDivergenceOpportunity } from "./analyze-strategies/rsi-divergence";
import { findOpportunity as findBollingerBandOpportunity } from "./analyze-strategies/bollinger-bands";
import { findOpportunity as findPumpDumpOpportunity } from "./analyze-strategies/pump-dump";
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
  private candidateListForLogging: AnalyzeResult[] = [];

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
      this.candidateListForLogging.push(rsiDivergenceOpportunity);
      return rsiDivergenceOpportunity;
      // this.pushToCandidateList(rsiDivergenceOpportunity);
    }

    let bbOpportunity = findBollingerBandOpportunity(
      symbol,
      timeFrame,
      candleData,
      bbResults,
      rsiResults
    );
    if (bbOpportunity) {
      this.candidateListForLogging.push(bbOpportunity);
      return bbOpportunity;
      // this.pushToCandidateList(bbOpportunity);
    }

    let pumpDumpOpportunity = findPumpDumpOpportunity(
      symbol,
      timeFrame,
      candleData,
      bbResults,
      rsiResults
    );
    if (pumpDumpOpportunity) {
      this.candidateListForLogging.push(pumpDumpOpportunity);
      return pumpDumpOpportunity;
      // this.pushToCandidateList(pumpDumpOpportunity);
    }

    return null;
    //return this.processCandidateList(symbol, timeFrame, candleData, rsiResults);
  }

  // private pushToCandidateList(newCandidate: AnalyzeResult): void {
  //   let alreadyInTheList = false;
  //   let listIndex = -1;
  //   this.analyzedCandidates.forEach((item, index) => {
  //     if (
  //       item.symbol === newCandidate.symbol &&
  //       item.strategy === newCandidate.strategy &&
  //       item.timeFrame === newCandidate.timeFrame &&
  //       item.direction === newCandidate.direction
  //     ) {
  //       alreadyInTheList = true;
  //       listIndex = index;
  //     }
  //   });
  //   if (alreadyInTheList) {
  //     this.analyzedCandidates[listIndex] = newCandidate;
  //   } else {
  //     this.analyzedCandidates.push(newCandidate);
  //   }
  // }

  // private processCandidateList(
  //   symbol: string,
  //   timeFrame: ChartTimeFrame,
  //   candleData: PriceRecordDto[],
  //   rsiResults: number[]
  // ): AnalyzeResult | null {
  //   let analyzedResult: AnalyzeResult | null = null;

  //   this.analyzedCandidates.forEach((candidate, index) => {
  //     let symbolMatched = symbol === candidate.symbol;
  //     let timeFrameMatched = timeFrame === candidate.lowerTimeFrame;

  //     if (symbolMatched && timeFrameMatched) {
  //       let tooLate = false;
  //       let expireCandleLimit = 32;
  //       let lastClosedCandle = candleData[candleData.length - 2];

  //       if (
  //         lastClosedCandle.event_number - candidate.lowerTimeFrameEventNumber >
  //         expireCandleLimit
  //       ) {
  //         tooLate = true;
  //       }

  //       if (tooLate) {
  //         this.analyzedCandidates.splice(index, 1);
  //       } else {
  //         let hasFormedSwingHighOrLow = formedSwingHighOrLow(
  //           candleData,
  //           candidate
  //         );

  //         if (hasFormedSwingHighOrLow) {
  //           analyzedResult = { ...candidate };
  //           this.analyzedCandidates.splice(index, 1);
  //         }
  //       }
  //     }
  //   });

  //   return analyzedResult;
  // }

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
