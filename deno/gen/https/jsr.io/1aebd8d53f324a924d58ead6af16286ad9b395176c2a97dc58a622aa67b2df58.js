import { isIterateeCall } from '../_internal/isIterateeCall.ts';
import { isArrayLike } from '../predicate/isArrayLike.ts';
import { toInteger } from '../util/toInteger.ts';
/**
 * Create a slice of `array` from `start` up to, but not including, `end`.
 *
 * It does not return a dense array for sparse arrays unlike the native `Array.prototype.slice`.
 *
 * @template T - The type of the array elements.
 * @param {ArrayLike<T> | null | undefined} array - The array to slice.
 * @param {number} [start=0] - The start position.
 * @param {number} [end=array.length] - The end position.
 * @returns {T[]} - Returns the slice of `array`.
 *
 * @example
 * slice([1, 2, 3], 1, 2); // => [2]
 * slice(new Array(3)); // => [undefined, undefined, undefined]
 */ export function slice(array, start, end) {
  if (!isArrayLike(array)) {
    return [];
  }
  const length = array.length;
  if (end === undefined) {
    end = length;
  } else if (typeof end !== 'number' && isIterateeCall(array, start, end)) {
    // support for expression like `_.map(slice)`
    start = 0;
    end = length;
  }
  start = toInteger(start);
  end = toInteger(end);
  if (start < 0) {
    start = Math.max(length + start, 0);
  } else {
    start = Math.min(start, length);
  }
  if (end < 0) {
    end = Math.max(length + end, 0);
  } else {
    end = Math.min(end, length);
  }
  const resultLength = Math.max(end - start, 0);
  const result = new Array(resultLength);
  for(let i = 0; i < resultLength; ++i){
    result[i] = array[start + i];
  }
  return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvYXJyYXkvc2xpY2UudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgaXNJdGVyYXRlZUNhbGwgfSBmcm9tICcuLi9faW50ZXJuYWwvaXNJdGVyYXRlZUNhbGwudHMnO1xuaW1wb3J0IHsgaXNBcnJheUxpa2UgfSBmcm9tICcuLi9wcmVkaWNhdGUvaXNBcnJheUxpa2UudHMnO1xuaW1wb3J0IHsgdG9JbnRlZ2VyIH0gZnJvbSAnLi4vdXRpbC90b0ludGVnZXIudHMnO1xuXG4vKipcbiAqIENyZWF0ZSBhIHNsaWNlIG9mIGBhcnJheWAgZnJvbSBgc3RhcnRgIHVwIHRvLCBidXQgbm90IGluY2x1ZGluZywgYGVuZGAuXG4gKlxuICogSXQgZG9lcyBub3QgcmV0dXJuIGEgZGVuc2UgYXJyYXkgZm9yIHNwYXJzZSBhcnJheXMgdW5saWtlIHRoZSBuYXRpdmUgYEFycmF5LnByb3RvdHlwZS5zbGljZWAuXG4gKlxuICogQHRlbXBsYXRlIFQgLSBUaGUgdHlwZSBvZiB0aGUgYXJyYXkgZWxlbWVudHMuXG4gKiBAcGFyYW0ge0FycmF5TGlrZTxUPiB8IG51bGwgfCB1bmRlZmluZWR9IGFycmF5IC0gVGhlIGFycmF5IHRvIHNsaWNlLlxuICogQHBhcmFtIHtudW1iZXJ9IFtzdGFydD0wXSAtIFRoZSBzdGFydCBwb3NpdGlvbi5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbZW5kPWFycmF5Lmxlbmd0aF0gLSBUaGUgZW5kIHBvc2l0aW9uLlxuICogQHJldHVybnMge1RbXX0gLSBSZXR1cm5zIHRoZSBzbGljZSBvZiBgYXJyYXlgLlxuICpcbiAqIEBleGFtcGxlXG4gKiBzbGljZShbMSwgMiwgM10sIDEsIDIpOyAvLyA9PiBbMl1cbiAqIHNsaWNlKG5ldyBBcnJheSgzKSk7IC8vID0+IFt1bmRlZmluZWQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkXVxuICovXG5leHBvcnQgZnVuY3Rpb24gc2xpY2U8VD4oYXJyYXk6IEFycmF5TGlrZTxUPiB8IG51bGwgfCB1bmRlZmluZWQsIHN0YXJ0PzogbnVtYmVyLCBlbmQ/OiBudW1iZXIpOiBUW10ge1xuICBpZiAoIWlzQXJyYXlMaWtlKGFycmF5KSkge1xuICAgIHJldHVybiBbXTtcbiAgfVxuXG4gIGNvbnN0IGxlbmd0aCA9IGFycmF5Lmxlbmd0aDtcblxuICBpZiAoZW5kID09PSB1bmRlZmluZWQpIHtcbiAgICBlbmQgPSBsZW5ndGg7XG4gIH0gZWxzZSBpZiAodHlwZW9mIGVuZCAhPT0gJ251bWJlcicgJiYgaXNJdGVyYXRlZUNhbGwoYXJyYXksIHN0YXJ0LCBlbmQpKSB7XG4gICAgLy8gc3VwcG9ydCBmb3IgZXhwcmVzc2lvbiBsaWtlIGBfLm1hcChzbGljZSlgXG4gICAgc3RhcnQgPSAwO1xuICAgIGVuZCA9IGxlbmd0aDtcbiAgfVxuXG4gIHN0YXJ0ID0gdG9JbnRlZ2VyKHN0YXJ0KTtcbiAgZW5kID0gdG9JbnRlZ2VyKGVuZCk7XG5cbiAgaWYgKHN0YXJ0IDwgMCkge1xuICAgIHN0YXJ0ID0gTWF0aC5tYXgobGVuZ3RoICsgc3RhcnQsIDApO1xuICB9IGVsc2Uge1xuICAgIHN0YXJ0ID0gTWF0aC5taW4oc3RhcnQsIGxlbmd0aCk7XG4gIH1cblxuICBpZiAoZW5kIDwgMCkge1xuICAgIGVuZCA9IE1hdGgubWF4KGxlbmd0aCArIGVuZCwgMCk7XG4gIH0gZWxzZSB7XG4gICAgZW5kID0gTWF0aC5taW4oZW5kLCBsZW5ndGgpO1xuICB9XG5cbiAgY29uc3QgcmVzdWx0TGVuZ3RoID0gTWF0aC5tYXgoZW5kIC0gc3RhcnQsIDApO1xuICBjb25zdCByZXN1bHQgPSBuZXcgQXJyYXkocmVzdWx0TGVuZ3RoKTtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IHJlc3VsdExlbmd0aDsgKytpKSB7XG4gICAgcmVzdWx0W2ldID0gYXJyYXlbc3RhcnQgKyBpXTtcbiAgfVxuXG4gIHJldHVybiByZXN1bHQ7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxjQUFjLFFBQVEsaUNBQWlDO0FBQ2hFLFNBQVMsV0FBVyxRQUFRLDhCQUE4QjtBQUMxRCxTQUFTLFNBQVMsUUFBUSx1QkFBdUI7QUFFakQ7Ozs7Ozs7Ozs7Ozs7O0NBY0MsR0FDRCxPQUFPLFNBQVMsTUFBUyxLQUFzQyxFQUFFLEtBQWMsRUFBRSxHQUFZO0VBQzNGLElBQUksQ0FBQyxZQUFZLFFBQVE7SUFDdkIsT0FBTyxFQUFFO0VBQ1g7RUFFQSxNQUFNLFNBQVMsTUFBTSxNQUFNO0VBRTNCLElBQUksUUFBUSxXQUFXO0lBQ3JCLE1BQU07RUFDUixPQUFPLElBQUksT0FBTyxRQUFRLFlBQVksZUFBZSxPQUFPLE9BQU8sTUFBTTtJQUN2RSw2Q0FBNkM7SUFDN0MsUUFBUTtJQUNSLE1BQU07RUFDUjtFQUVBLFFBQVEsVUFBVTtFQUNsQixNQUFNLFVBQVU7RUFFaEIsSUFBSSxRQUFRLEdBQUc7SUFDYixRQUFRLEtBQUssR0FBRyxDQUFDLFNBQVMsT0FBTztFQUNuQyxPQUFPO0lBQ0wsUUFBUSxLQUFLLEdBQUcsQ0FBQyxPQUFPO0VBQzFCO0VBRUEsSUFBSSxNQUFNLEdBQUc7SUFDWCxNQUFNLEtBQUssR0FBRyxDQUFDLFNBQVMsS0FBSztFQUMvQixPQUFPO0lBQ0wsTUFBTSxLQUFLLEdBQUcsQ0FBQyxLQUFLO0VBQ3RCO0VBRUEsTUFBTSxlQUFlLEtBQUssR0FBRyxDQUFDLE1BQU0sT0FBTztFQUMzQyxNQUFNLFNBQVMsSUFBSSxNQUFNO0VBRXpCLElBQUssSUFBSSxJQUFJLEdBQUcsSUFBSSxjQUFjLEVBQUUsRUFBRztJQUNyQyxNQUFNLENBQUMsRUFBRSxHQUFHLEtBQUssQ0FBQyxRQUFRLEVBQUU7RUFDOUI7RUFFQSxPQUFPO0FBQ1QifQ==
// denoCacheMetadata=13126511850901213751,9101612922832305259