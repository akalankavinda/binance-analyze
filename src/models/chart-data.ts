import { PriceRecordDto } from "./price-record.dto";

export interface ChartData {
  [key: string]: PriceRecordDto[];
}
