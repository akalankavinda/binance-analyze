import { BearishCandidate } from "./bearish-candidate.model";
import { BullishCandidate } from "./bullish-candidate.model";

export interface PaperTradeSouce {
  bullishList: BullishCandidate[];
  bearishList: BearishCandidate[];
}
