export function trimUSDT(symbol: String): string {
  return symbol.replace("USDT", "");
}

export function roundNum(num: number): number {
  if (num > 100) {
    return Math.round(num * 100) / 100;
  } else if (num > 1) {
    return Math.round(num * 1000) / 1000;
  } else if (num > 0.01) {
    return Math.round(num * 100000) / 100000;
  } else if (num > 0.0001) {
    return Math.round(num * 10000000) / 10000000;
  } else {
    return Math.round(num * 100000000) / 100000000;
  }
}
