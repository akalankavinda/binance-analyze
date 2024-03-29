import { TrendDirection } from "../../enums/trend-direction.enum";

export function linearRegression(
  trend: TrendDirection,
  trendLineData: number[],
  candleCount: number
) {
  let sum_x = 0;
  let sum_y = 0;
  let sum_xy = 0;
  let sum_xx = 0;
  let count = 0;

  /*
   * We'll use those variables for faster read/write access.
   */
  let x = 0;
  let y = 0;
  let values_length = trendLineData.length;

  /*
   * Calculate the sum for each of the parts necessary.
   */
  for (var v = candleCount; v > 0; v--) {
    x = trendLineData.length - v;
    y = trendLineData[trendLineData.length - v];
    sum_x += x;
    sum_y += y;
    sum_xx += x * x;
    sum_xy += x * y;
    count++;
  }

  /*
   * Calculate m and b for the formular:
   * y = x * m + b
   */
  var m = (count * sum_xy - sum_x * sum_y) / (count * sum_xx - sum_x * sum_x);
  var b = sum_y / count - (m * sum_x) / count;

  /*
   * We will make the x and y result line now
   */
  //var result_values_x = [];
  var result_values_y = [];

  for (var v = 0; v < values_length; v++) {
    x = v;
    y = x * m + b;
    //result_values_x.push(x);
    result_values_y.push(y);
  }

  if (
    trend === TrendDirection.BULLISH &&
    result_values_y[result_values_y.length - 1] > result_values_y[0]
  ) {
    return true;
  } else if (
    trend === TrendDirection.BEARISH &&
    result_values_y[result_values_y.length - 1] < result_values_y[0]
  ) {
    return true;
  } else {
    return false;
  }
}
