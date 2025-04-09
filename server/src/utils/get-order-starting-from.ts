export const getOrderStartingFrom = <T>(arr: T[], startIdx: number): T[] => {
  const results: T[] = [];
  /*const startIndex = arr.indexOf(startIdx);*/
  const len = arr.length;
  for (let i = 0; i < len; i++) {
    const idx = (startIdx + i) % len;
    results.push(arr[idx]);
  }
  return results;
}
