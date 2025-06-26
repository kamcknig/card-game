import { sortedIndexBy } from './sortedIndexBy.ts';
import { isNil, isNull, isSymbol } from '../../predicate/index.ts';
import { isNumber } from '../predicate/isNumber.ts';
const MAX_ARRAY_LENGTH = 4294967295;
const HALF_MAX_ARRAY_LENGTH = MAX_ARRAY_LENGTH >>> 1;
/**
 * Uses a binary search to determine the lowest index at which `value`
 * should be inserted into `array` in order to maintain its sort order.
 *
 * @category Array
 * @param {ArrayLike<T> | null | undefined} array The sorted array to inspect.
 * @param {T} value The value to evaluate.
 * @returns {number} Returns the index at which `value` should be inserted
 *  into `array`.
 * @example
 * sortedIndex([30, 50], 40)
 * // => 1
 */ export function sortedIndex(array, value) {
  if (isNil(array)) {
    return 0;
  }
  let low = 0, high = isNil(array) ? low : array.length;
  if (isNumber(value) && value === value && high <= HALF_MAX_ARRAY_LENGTH) {
    while(low < high){
      const mid = low + high >>> 1;
      const compute = array[mid];
      if (!isNull(compute) && !isSymbol(compute) && compute < value) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    return high;
  }
  return sortedIndexBy(array, value, (value)=>value);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvYXJyYXkvc29ydGVkSW5kZXgudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgc29ydGVkSW5kZXhCeSB9IGZyb20gJy4vc29ydGVkSW5kZXhCeS50cyc7XG5pbXBvcnQgeyBpc05pbCwgaXNOdWxsLCBpc1N5bWJvbCB9IGZyb20gJy4uLy4uL3ByZWRpY2F0ZS9pbmRleC50cyc7XG5pbXBvcnQgeyBpc051bWJlciB9IGZyb20gJy4uL3ByZWRpY2F0ZS9pc051bWJlci50cyc7XG5cbmNvbnN0IE1BWF9BUlJBWV9MRU5HVEggPSA0Mjk0OTY3Mjk1O1xuY29uc3QgSEFMRl9NQVhfQVJSQVlfTEVOR1RIID0gTUFYX0FSUkFZX0xFTkdUSCA+Pj4gMTtcblxuLyoqXG4gKiBVc2VzIGEgYmluYXJ5IHNlYXJjaCB0byBkZXRlcm1pbmUgdGhlIGxvd2VzdCBpbmRleCBhdCB3aGljaCBgdmFsdWVgXG4gKiBzaG91bGQgYmUgaW5zZXJ0ZWQgaW50byBgYXJyYXlgIGluIG9yZGVyIHRvIG1haW50YWluIGl0cyBzb3J0IG9yZGVyLlxuICpcbiAqIEBjYXRlZ29yeSBBcnJheVxuICogQHBhcmFtIHtBcnJheUxpa2U8VD4gfCBudWxsIHwgdW5kZWZpbmVkfSBhcnJheSBUaGUgc29ydGVkIGFycmF5IHRvIGluc3BlY3QuXG4gKiBAcGFyYW0ge1R9IHZhbHVlIFRoZSB2YWx1ZSB0byBldmFsdWF0ZS5cbiAqIEByZXR1cm5zIHtudW1iZXJ9IFJldHVybnMgdGhlIGluZGV4IGF0IHdoaWNoIGB2YWx1ZWAgc2hvdWxkIGJlIGluc2VydGVkXG4gKiAgaW50byBgYXJyYXlgLlxuICogQGV4YW1wbGVcbiAqIHNvcnRlZEluZGV4KFszMCwgNTBdLCA0MClcbiAqIC8vID0+IDFcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNvcnRlZEluZGV4PFQ+KGFycmF5OiBBcnJheUxpa2U8VD4gfCBudWxsIHwgdW5kZWZpbmVkLCB2YWx1ZTogVCk6IG51bWJlciB7XG4gIGlmIChpc05pbChhcnJheSkpIHtcbiAgICByZXR1cm4gMDtcbiAgfVxuICBsZXQgbG93ID0gMCxcbiAgICBoaWdoID0gaXNOaWwoYXJyYXkpID8gbG93IDogYXJyYXkubGVuZ3RoO1xuXG4gIGlmIChpc051bWJlcih2YWx1ZSkgJiYgdmFsdWUgPT09IHZhbHVlICYmIGhpZ2ggPD0gSEFMRl9NQVhfQVJSQVlfTEVOR1RIKSB7XG4gICAgd2hpbGUgKGxvdyA8IGhpZ2gpIHtcbiAgICAgIGNvbnN0IG1pZCA9IChsb3cgKyBoaWdoKSA+Pj4gMTtcbiAgICAgIGNvbnN0IGNvbXB1dGUgPSBhcnJheVttaWRdO1xuICAgICAgaWYgKCFpc051bGwoY29tcHV0ZSkgJiYgIWlzU3ltYm9sKGNvbXB1dGUpICYmIChjb21wdXRlIGFzIGFueSkgPCB2YWx1ZSkge1xuICAgICAgICBsb3cgPSBtaWQgKyAxO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaGlnaCA9IG1pZDtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGhpZ2g7XG4gIH1cbiAgcmV0dXJuIHNvcnRlZEluZGV4QnkoYXJyYXksIHZhbHVlLCB2YWx1ZSA9PiB2YWx1ZSk7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxhQUFhLFFBQVEscUJBQXFCO0FBQ25ELFNBQVMsS0FBSyxFQUFFLE1BQU0sRUFBRSxRQUFRLFFBQVEsMkJBQTJCO0FBQ25FLFNBQVMsUUFBUSxRQUFRLDJCQUEyQjtBQUVwRCxNQUFNLG1CQUFtQjtBQUN6QixNQUFNLHdCQUF3QixxQkFBcUI7QUFFbkQ7Ozs7Ozs7Ozs7OztDQVlDLEdBQ0QsT0FBTyxTQUFTLFlBQWUsS0FBc0MsRUFBRSxLQUFRO0VBQzdFLElBQUksTUFBTSxRQUFRO0lBQ2hCLE9BQU87RUFDVDtFQUNBLElBQUksTUFBTSxHQUNSLE9BQU8sTUFBTSxTQUFTLE1BQU0sTUFBTSxNQUFNO0VBRTFDLElBQUksU0FBUyxVQUFVLFVBQVUsU0FBUyxRQUFRLHVCQUF1QjtJQUN2RSxNQUFPLE1BQU0sS0FBTTtNQUNqQixNQUFNLE1BQU0sQUFBQyxNQUFNLFNBQVU7TUFDN0IsTUFBTSxVQUFVLEtBQUssQ0FBQyxJQUFJO01BQzFCLElBQUksQ0FBQyxPQUFPLFlBQVksQ0FBQyxTQUFTLFlBQVksQUFBQyxVQUFrQixPQUFPO1FBQ3RFLE1BQU0sTUFBTTtNQUNkLE9BQU87UUFDTCxPQUFPO01BQ1Q7SUFDRjtJQUNBLE9BQU87RUFDVDtFQUNBLE9BQU8sY0FBYyxPQUFPLE9BQU8sQ0FBQSxRQUFTO0FBQzlDIn0=
// denoCacheMetadata=3202362678117818070,2154884827923133120