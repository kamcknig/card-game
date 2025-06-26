import { isNull, isUndefined } from '../../predicate/index.ts';
import { isNaN } from '../predicate/isNaN.ts';
import { isNil } from '../predicate/isNil.ts';
import { isSymbol } from '../predicate/isSymbol.ts';
const MAX_ARRAY_LENGTH = 4294967295;
const MAX_ARRAY_INDEX = MAX_ARRAY_LENGTH - 1;
/**
 * This method is like `sortedIndex` except that it accepts `iteratee`
 * which is invoked for `value` and each element of `array` to compute their
 * sort ranking. The iteratee is invoked with one argument: (value).
 *
 * @param {ArrayLike<T> | null | undefined} array The sorted array to inspect.
 * @param {T} value The value to evaluate.
 * @param {(value: T) => R} iteratee The iteratee invoked per element.
 * @returns {number} Returns the index at which `value` should be inserted
 *  into `array`.
 * @example
 * const objects = [{ 'n': 4 }, { 'n': 5 }]
 * sortedIndexBy(objects, { 'n': 4 }, ({ n }) => n)
 * // => 0
 */ export function sortedIndexBy(array, value, iteratee, retHighest) {
  let low = 0;
  let high = array == null ? 0 : array.length;
  if (high === 0 || isNil(array)) {
    return 0;
  }
  const transformedValue = iteratee?.(value);
  const valIsNaN = isNaN(transformedValue);
  const valIsNull = isNull(transformedValue);
  const valIsSymbol = isSymbol(transformedValue);
  const valIsUndefined = isUndefined(transformedValue);
  while(low < high){
    let setLow;
    const mid = Math.floor((low + high) / 2);
    const computed = iteratee?.(array[mid]);
    const othIsDefined = !isUndefined(computed);
    const othIsNull = isNull(computed);
    const othIsReflexive = !isNaN(computed);
    const othIsSymbol = isSymbol(computed);
    if (valIsNaN) {
      setLow = retHighest || othIsReflexive;
    } else if (valIsUndefined) {
      setLow = othIsReflexive && (retHighest || othIsDefined);
    } else if (valIsNull) {
      setLow = othIsReflexive && othIsDefined && (retHighest || !othIsNull);
    } else if (valIsSymbol) {
      setLow = othIsReflexive && othIsDefined && !othIsNull && (retHighest || !othIsSymbol);
    } else if (othIsNull || othIsSymbol) {
      setLow = false;
    } else {
      setLow = retHighest ? computed <= transformedValue : computed < transformedValue;
    }
    if (setLow) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return Math.min(high, MAX_ARRAY_INDEX);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvYXJyYXkvc29ydGVkSW5kZXhCeS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBpc051bGwsIGlzVW5kZWZpbmVkIH0gZnJvbSAnLi4vLi4vcHJlZGljYXRlL2luZGV4LnRzJztcbmltcG9ydCB7IGlzTmFOIH0gZnJvbSAnLi4vcHJlZGljYXRlL2lzTmFOLnRzJztcbmltcG9ydCB7IGlzTmlsIH0gZnJvbSAnLi4vcHJlZGljYXRlL2lzTmlsLnRzJztcbmltcG9ydCB7IGlzU3ltYm9sIH0gZnJvbSAnLi4vcHJlZGljYXRlL2lzU3ltYm9sLnRzJztcblxudHlwZSBJdGVyYXRlZTxULCBSPiA9ICh2YWx1ZTogVCkgPT4gUjtcblxuY29uc3QgTUFYX0FSUkFZX0xFTkdUSCA9IDQyOTQ5NjcyOTU7XG5jb25zdCBNQVhfQVJSQVlfSU5ERVggPSBNQVhfQVJSQVlfTEVOR1RIIC0gMTtcbi8qKlxuICogVGhpcyBtZXRob2QgaXMgbGlrZSBgc29ydGVkSW5kZXhgIGV4Y2VwdCB0aGF0IGl0IGFjY2VwdHMgYGl0ZXJhdGVlYFxuICogd2hpY2ggaXMgaW52b2tlZCBmb3IgYHZhbHVlYCBhbmQgZWFjaCBlbGVtZW50IG9mIGBhcnJheWAgdG8gY29tcHV0ZSB0aGVpclxuICogc29ydCByYW5raW5nLiBUaGUgaXRlcmF0ZWUgaXMgaW52b2tlZCB3aXRoIG9uZSBhcmd1bWVudDogKHZhbHVlKS5cbiAqXG4gKiBAcGFyYW0ge0FycmF5TGlrZTxUPiB8IG51bGwgfCB1bmRlZmluZWR9IGFycmF5IFRoZSBzb3J0ZWQgYXJyYXkgdG8gaW5zcGVjdC5cbiAqIEBwYXJhbSB7VH0gdmFsdWUgVGhlIHZhbHVlIHRvIGV2YWx1YXRlLlxuICogQHBhcmFtIHsodmFsdWU6IFQpID0+IFJ9IGl0ZXJhdGVlIFRoZSBpdGVyYXRlZSBpbnZva2VkIHBlciBlbGVtZW50LlxuICogQHJldHVybnMge251bWJlcn0gUmV0dXJucyB0aGUgaW5kZXggYXQgd2hpY2ggYHZhbHVlYCBzaG91bGQgYmUgaW5zZXJ0ZWRcbiAqICBpbnRvIGBhcnJheWAuXG4gKiBAZXhhbXBsZVxuICogY29uc3Qgb2JqZWN0cyA9IFt7ICduJzogNCB9LCB7ICduJzogNSB9XVxuICogc29ydGVkSW5kZXhCeShvYmplY3RzLCB7ICduJzogNCB9LCAoeyBuIH0pID0+IG4pXG4gKiAvLyA9PiAwXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzb3J0ZWRJbmRleEJ5PFQsIFI+KFxuICBhcnJheTogQXJyYXlMaWtlPFQ+IHwgbnVsbCB8IHVuZGVmaW5lZCxcbiAgdmFsdWU6IFQsXG4gIGl0ZXJhdGVlPzogSXRlcmF0ZWU8VCwgUj4sXG4gIHJldEhpZ2hlc3Q/OiBib29sZWFuXG4pOiBudW1iZXIge1xuICBsZXQgbG93ID0gMDtcbiAgbGV0IGhpZ2ggPSBhcnJheSA9PSBudWxsID8gMCA6IGFycmF5Lmxlbmd0aDtcbiAgaWYgKGhpZ2ggPT09IDAgfHwgaXNOaWwoYXJyYXkpKSB7XG4gICAgcmV0dXJuIDA7XG4gIH1cblxuICBjb25zdCB0cmFuc2Zvcm1lZFZhbHVlID0gaXRlcmF0ZWU/Lih2YWx1ZSk7XG5cbiAgY29uc3QgdmFsSXNOYU4gPSBpc05hTih0cmFuc2Zvcm1lZFZhbHVlKTtcbiAgY29uc3QgdmFsSXNOdWxsID0gaXNOdWxsKHRyYW5zZm9ybWVkVmFsdWUpO1xuICBjb25zdCB2YWxJc1N5bWJvbCA9IGlzU3ltYm9sKHRyYW5zZm9ybWVkVmFsdWUpO1xuICBjb25zdCB2YWxJc1VuZGVmaW5lZCA9IGlzVW5kZWZpbmVkKHRyYW5zZm9ybWVkVmFsdWUpO1xuXG4gIHdoaWxlIChsb3cgPCBoaWdoKSB7XG4gICAgbGV0IHNldExvdzogYm9vbGVhbjtcbiAgICBjb25zdCBtaWQgPSBNYXRoLmZsb29yKChsb3cgKyBoaWdoKSAvIDIpO1xuICAgIGNvbnN0IGNvbXB1dGVkID0gaXRlcmF0ZWU/LihhcnJheVttaWRdKTtcblxuICAgIGNvbnN0IG90aElzRGVmaW5lZCA9ICFpc1VuZGVmaW5lZChjb21wdXRlZCk7XG4gICAgY29uc3Qgb3RoSXNOdWxsID0gaXNOdWxsKGNvbXB1dGVkKTtcbiAgICBjb25zdCBvdGhJc1JlZmxleGl2ZSA9ICFpc05hTihjb21wdXRlZCk7XG4gICAgY29uc3Qgb3RoSXNTeW1ib2wgPSBpc1N5bWJvbChjb21wdXRlZCk7XG5cbiAgICBpZiAodmFsSXNOYU4pIHtcbiAgICAgIHNldExvdyA9IHJldEhpZ2hlc3QgfHwgb3RoSXNSZWZsZXhpdmU7XG4gICAgfSBlbHNlIGlmICh2YWxJc1VuZGVmaW5lZCkge1xuICAgICAgc2V0TG93ID0gb3RoSXNSZWZsZXhpdmUgJiYgKHJldEhpZ2hlc3QgfHwgb3RoSXNEZWZpbmVkKTtcbiAgICB9IGVsc2UgaWYgKHZhbElzTnVsbCkge1xuICAgICAgc2V0TG93ID0gb3RoSXNSZWZsZXhpdmUgJiYgb3RoSXNEZWZpbmVkICYmIChyZXRIaWdoZXN0IHx8ICFvdGhJc051bGwpO1xuICAgIH0gZWxzZSBpZiAodmFsSXNTeW1ib2wpIHtcbiAgICAgIHNldExvdyA9IG90aElzUmVmbGV4aXZlICYmIG90aElzRGVmaW5lZCAmJiAhb3RoSXNOdWxsICYmIChyZXRIaWdoZXN0IHx8ICFvdGhJc1N5bWJvbCk7XG4gICAgfSBlbHNlIGlmIChvdGhJc051bGwgfHwgb3RoSXNTeW1ib2wpIHtcbiAgICAgIHNldExvdyA9IGZhbHNlO1xuICAgIH0gZWxzZSB7XG4gICAgICBzZXRMb3cgPSByZXRIaWdoZXN0ID8gY29tcHV0ZWQhIDw9IHRyYW5zZm9ybWVkVmFsdWUgOiBjb21wdXRlZCEgPCB0cmFuc2Zvcm1lZFZhbHVlO1xuICAgIH1cblxuICAgIGlmIChzZXRMb3cpIHtcbiAgICAgIGxvdyA9IG1pZCArIDE7XG4gICAgfSBlbHNlIHtcbiAgICAgIGhpZ2ggPSBtaWQ7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIE1hdGgubWluKGhpZ2gsIE1BWF9BUlJBWV9JTkRFWCk7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxNQUFNLEVBQUUsV0FBVyxRQUFRLDJCQUEyQjtBQUMvRCxTQUFTLEtBQUssUUFBUSx3QkFBd0I7QUFDOUMsU0FBUyxLQUFLLFFBQVEsd0JBQXdCO0FBQzlDLFNBQVMsUUFBUSxRQUFRLDJCQUEyQjtBQUlwRCxNQUFNLG1CQUFtQjtBQUN6QixNQUFNLGtCQUFrQixtQkFBbUI7QUFDM0M7Ozs7Ozs7Ozs7Ozs7O0NBY0MsR0FDRCxPQUFPLFNBQVMsY0FDZCxLQUFzQyxFQUN0QyxLQUFRLEVBQ1IsUUFBeUIsRUFDekIsVUFBb0I7RUFFcEIsSUFBSSxNQUFNO0VBQ1YsSUFBSSxPQUFPLFNBQVMsT0FBTyxJQUFJLE1BQU0sTUFBTTtFQUMzQyxJQUFJLFNBQVMsS0FBSyxNQUFNLFFBQVE7SUFDOUIsT0FBTztFQUNUO0VBRUEsTUFBTSxtQkFBbUIsV0FBVztFQUVwQyxNQUFNLFdBQVcsTUFBTTtFQUN2QixNQUFNLFlBQVksT0FBTztFQUN6QixNQUFNLGNBQWMsU0FBUztFQUM3QixNQUFNLGlCQUFpQixZQUFZO0VBRW5DLE1BQU8sTUFBTSxLQUFNO0lBQ2pCLElBQUk7SUFDSixNQUFNLE1BQU0sS0FBSyxLQUFLLENBQUMsQ0FBQyxNQUFNLElBQUksSUFBSTtJQUN0QyxNQUFNLFdBQVcsV0FBVyxLQUFLLENBQUMsSUFBSTtJQUV0QyxNQUFNLGVBQWUsQ0FBQyxZQUFZO0lBQ2xDLE1BQU0sWUFBWSxPQUFPO0lBQ3pCLE1BQU0saUJBQWlCLENBQUMsTUFBTTtJQUM5QixNQUFNLGNBQWMsU0FBUztJQUU3QixJQUFJLFVBQVU7TUFDWixTQUFTLGNBQWM7SUFDekIsT0FBTyxJQUFJLGdCQUFnQjtNQUN6QixTQUFTLGtCQUFrQixDQUFDLGNBQWMsWUFBWTtJQUN4RCxPQUFPLElBQUksV0FBVztNQUNwQixTQUFTLGtCQUFrQixnQkFBZ0IsQ0FBQyxjQUFjLENBQUMsU0FBUztJQUN0RSxPQUFPLElBQUksYUFBYTtNQUN0QixTQUFTLGtCQUFrQixnQkFBZ0IsQ0FBQyxhQUFhLENBQUMsY0FBYyxDQUFDLFdBQVc7SUFDdEYsT0FBTyxJQUFJLGFBQWEsYUFBYTtNQUNuQyxTQUFTO0lBQ1gsT0FBTztNQUNMLFNBQVMsYUFBYSxZQUFhLG1CQUFtQixXQUFZO0lBQ3BFO0lBRUEsSUFBSSxRQUFRO01BQ1YsTUFBTSxNQUFNO0lBQ2QsT0FBTztNQUNMLE9BQU87SUFDVDtFQUNGO0VBRUEsT0FBTyxLQUFLLEdBQUcsQ0FBQyxNQUFNO0FBQ3hCIn0=
// denoCacheMetadata=8830994012812752032,17298850881836987499