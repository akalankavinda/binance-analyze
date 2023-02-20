import { AnalyzeResult } from "../../models/analyze-result.model";
import { TrendDirection } from "../../enums/trend-direction.enum";
import { ChartTimeFrame } from "../../enums/chart-timeframes.enum";

export function filterBestOpportunities(
  opportunityList: AnalyzeResult[],
  limit: number = 1
) {
  let dominantCoinOpportunities: AnalyzeResult[] = [];

  opportunityList.forEach((item, index) => {
    if (item.symbol === "BTCUSDT") {
      dominantCoinOpportunities.push(item);
    }
    opportunityList.splice(index, 1);
  });

  opportunityList.sort(function (a, b) {
    // descending sort

    let rsiValueA =
      a.direction === TrendDirection.BULLISH ? 100 - a.rsiValue : a.rsiValue;
    let rsiValueB =
      b.direction === TrendDirection.BULLISH ? 100 - b.rsiValue : b.rsiValue;

    let timeFrameWeightA = 1;
    let timeFrameWeightB = 1;

    if (a.timeFrame === ChartTimeFrame.ONE_HOUR) {
      timeFrameWeightA = 1.1;
    } else if (a.timeFrame === ChartTimeFrame.TWO_HOUR) {
      timeFrameWeightA = 1.2;
    } else if (a.timeFrame === ChartTimeFrame.FOUR_HOUR) {
      timeFrameWeightA = 1.4;
    } else if (
      a.timeFrame === ChartTimeFrame.TWELVE_HOUR ||
      a.timeFrame === ChartTimeFrame.ONE_DAY
    ) {
      timeFrameWeightA = 1.5;
    }

    if (b.timeFrame === ChartTimeFrame.ONE_HOUR) {
      timeFrameWeightB = 1.1;
    } else if (b.timeFrame === ChartTimeFrame.TWO_HOUR) {
      timeFrameWeightB = 1.2;
    } else if (b.timeFrame === ChartTimeFrame.FOUR_HOUR) {
      timeFrameWeightB = 1.4;
    } else if (
      b.timeFrame === ChartTimeFrame.TWELVE_HOUR ||
      b.timeFrame === ChartTimeFrame.ONE_DAY
    ) {
      timeFrameWeightB = 1.5;
    }

    let sortCalculation: number =
      rsiValueB * b.bollingerBandPercentage * timeFrameWeightB -
      rsiValueA * a.bollingerBandPercentage * timeFrameWeightA;

    return sortCalculation;
  });

  // filteredBullishList.sort(function (a, b) {
  //   // descending sort
  //   let calculatedValue: number =
  //     (100 - b.rsiValue) * b.bollingerBandPercentage -
  //     (100 - a.rsiValue) * a.bollingerBandPercentage;

  //   return calculatedValue;
  // });

  // filteredBearishList.sort(function (a, b) {
  //   // descending sort
  //   let calculatedValue: number =
  //     a.rsiValue * a.bollingerBandPercentage -
  //     b.rsiValue * b.bollingerBandPercentage;
  //   return calculatedValue;
  // });

  // let combinedList = filteredBullishList
  //   .splice(0, limit)
  //   .concat(filteredBearishList.splice(0, limit));

  let splicedOpportunities = opportunityList.splice(0, limit);

  return dominantCoinOpportunities.concat(splicedOpportunities);
}
