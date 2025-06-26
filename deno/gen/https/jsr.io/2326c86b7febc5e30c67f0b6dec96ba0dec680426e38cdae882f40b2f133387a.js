/**
 * Unzips an array of arrays, applying an `iteratee` function to regrouped elements.
 *
 * @template T, R
 * @param {T[][]} target - The nested array to unzip. This is an array of arrays,
 * where each inner array contains elements to be unzipped.
 * @param {(...args: T[]) => R} iteratee - A function to transform the unzipped elements.
 * @returns {R[]} A new array of unzipped and transformed elements.
 *
 * @example
 * const nestedArray = [[1, 2], [3, 4], [5, 6]];
 * const result = unzipWith(nestedArray, (item, item2, item3) => item + item2 + item3);
 * // result will be [9, 12]
 */ export function unzipWith(target, iteratee) {
  const maxLength = Math.max(...target.map((innerArray)=>innerArray.length));
  const result = new Array(maxLength);
  for(let i = 0; i < maxLength; i++){
    const group = new Array(target.length);
    for(let j = 0; j < target.length; j++){
      group[j] = target[j][i];
    }
    result[i] = iteratee(...group);
  }
  return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9hcnJheS91bnppcFdpdGgudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBVbnppcHMgYW4gYXJyYXkgb2YgYXJyYXlzLCBhcHBseWluZyBhbiBgaXRlcmF0ZWVgIGZ1bmN0aW9uIHRvIHJlZ3JvdXBlZCBlbGVtZW50cy5cbiAqXG4gKiBAdGVtcGxhdGUgVCwgUlxuICogQHBhcmFtIHtUW11bXX0gdGFyZ2V0IC0gVGhlIG5lc3RlZCBhcnJheSB0byB1bnppcC4gVGhpcyBpcyBhbiBhcnJheSBvZiBhcnJheXMsXG4gKiB3aGVyZSBlYWNoIGlubmVyIGFycmF5IGNvbnRhaW5zIGVsZW1lbnRzIHRvIGJlIHVuemlwcGVkLlxuICogQHBhcmFtIHsoLi4uYXJnczogVFtdKSA9PiBSfSBpdGVyYXRlZSAtIEEgZnVuY3Rpb24gdG8gdHJhbnNmb3JtIHRoZSB1bnppcHBlZCBlbGVtZW50cy5cbiAqIEByZXR1cm5zIHtSW119IEEgbmV3IGFycmF5IG9mIHVuemlwcGVkIGFuZCB0cmFuc2Zvcm1lZCBlbGVtZW50cy5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgbmVzdGVkQXJyYXkgPSBbWzEsIDJdLCBbMywgNF0sIFs1LCA2XV07XG4gKiBjb25zdCByZXN1bHQgPSB1bnppcFdpdGgobmVzdGVkQXJyYXksIChpdGVtLCBpdGVtMiwgaXRlbTMpID0+IGl0ZW0gKyBpdGVtMiArIGl0ZW0zKTtcbiAqIC8vIHJlc3VsdCB3aWxsIGJlIFs5LCAxMl1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHVuemlwV2l0aDxULCBSPih0YXJnZXQ6IHJlYWRvbmx5IFRbXVtdLCBpdGVyYXRlZTogKC4uLmFyZ3M6IFRbXSkgPT4gUik6IFJbXSB7XG4gIGNvbnN0IG1heExlbmd0aCA9IE1hdGgubWF4KC4uLnRhcmdldC5tYXAoaW5uZXJBcnJheSA9PiBpbm5lckFycmF5Lmxlbmd0aCkpO1xuICBjb25zdCByZXN1bHQ6IFJbXSA9IG5ldyBBcnJheShtYXhMZW5ndGgpO1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgbWF4TGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBncm91cCA9IG5ldyBBcnJheSh0YXJnZXQubGVuZ3RoKTtcblxuICAgIGZvciAobGV0IGogPSAwOyBqIDwgdGFyZ2V0Lmxlbmd0aDsgaisrKSB7XG4gICAgICBncm91cFtqXSA9IHRhcmdldFtqXVtpXTtcbiAgICB9XG5cbiAgICByZXN1bHRbaV0gPSBpdGVyYXRlZSguLi5ncm91cCk7XG4gIH1cblxuICByZXR1cm4gcmVzdWx0O1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7O0NBYUMsR0FDRCxPQUFPLFNBQVMsVUFBZ0IsTUFBc0IsRUFBRSxRQUE2QjtFQUNuRixNQUFNLFlBQVksS0FBSyxHQUFHLElBQUksT0FBTyxHQUFHLENBQUMsQ0FBQSxhQUFjLFdBQVcsTUFBTTtFQUN4RSxNQUFNLFNBQWMsSUFBSSxNQUFNO0VBRTlCLElBQUssSUFBSSxJQUFJLEdBQUcsSUFBSSxXQUFXLElBQUs7SUFDbEMsTUFBTSxRQUFRLElBQUksTUFBTSxPQUFPLE1BQU07SUFFckMsSUFBSyxJQUFJLElBQUksR0FBRyxJQUFJLE9BQU8sTUFBTSxFQUFFLElBQUs7TUFDdEMsS0FBSyxDQUFDLEVBQUUsR0FBRyxNQUFNLENBQUMsRUFBRSxDQUFDLEVBQUU7SUFDekI7SUFFQSxNQUFNLENBQUMsRUFBRSxHQUFHLFlBQVk7RUFDMUI7RUFFQSxPQUFPO0FBQ1QifQ==
// denoCacheMetadata=7793802116858653414,3765615399015509088