import { DataAnalyzeService } from "./services/data-analyze.service";
import { DataStorageService } from "./services/data-storage.service";
import { PaperTradeService } from "./services/paper-trade-service";

const dataAnalyzerService = DataAnalyzeService.getInstance();
const dataStorageService = DataStorageService.getInstance();
const paperTradeService = PaperTradeService.getInstance();
