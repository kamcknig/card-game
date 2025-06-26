import { toNumber } from '../util/toNumber.ts';
import { toString } from '../util/toString.ts';
/**
 * Divide two numbers.
 *
 * If either of the numbers is `NaN`, the function returns `NaN`.
 *
 * @param {number} value The first number in a division.
 * @param {number} other The second number in a division.
 * @returns {number} The quotient of value and other.
 *
 * @example
 * divide(6, 3); // => 2
 * divide(2, NaN); // => NaN
 * divide(NaN, 3); // => NaN
 * divide(NaN, NaN); // => NaN
 */ export function divide(value, other) {
  console.log(value, other);
  if (value === undefined && other === undefined) {
    return 1;
  }
  if (value === undefined || other === undefined) {
    return value ?? other;
  }
  if (typeof value === 'string' || typeof other === 'string') {
    value = toString(value);
    other = toString(other);
  } else {
    value = toNumber(value);
    other = toNumber(other);
  }
  return value / other;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvbWF0aC9kaXZpZGUudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgdG9OdW1iZXIgfSBmcm9tICcuLi91dGlsL3RvTnVtYmVyLnRzJztcbmltcG9ydCB7IHRvU3RyaW5nIH0gZnJvbSAnLi4vdXRpbC90b1N0cmluZy50cyc7XG5cbi8qKlxuICogRGl2aWRlIHR3byBudW1iZXJzLlxuICpcbiAqIElmIGVpdGhlciBvZiB0aGUgbnVtYmVycyBpcyBgTmFOYCwgdGhlIGZ1bmN0aW9uIHJldHVybnMgYE5hTmAuXG4gKlxuICogQHBhcmFtIHtudW1iZXJ9IHZhbHVlIFRoZSBmaXJzdCBudW1iZXIgaW4gYSBkaXZpc2lvbi5cbiAqIEBwYXJhbSB7bnVtYmVyfSBvdGhlciBUaGUgc2Vjb25kIG51bWJlciBpbiBhIGRpdmlzaW9uLlxuICogQHJldHVybnMge251bWJlcn0gVGhlIHF1b3RpZW50IG9mIHZhbHVlIGFuZCBvdGhlci5cbiAqXG4gKiBAZXhhbXBsZVxuICogZGl2aWRlKDYsIDMpOyAvLyA9PiAyXG4gKiBkaXZpZGUoMiwgTmFOKTsgLy8gPT4gTmFOXG4gKiBkaXZpZGUoTmFOLCAzKTsgLy8gPT4gTmFOXG4gKiBkaXZpZGUoTmFOLCBOYU4pOyAvLyA9PiBOYU5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRpdmlkZSh2YWx1ZTogbnVtYmVyLCBvdGhlcjogbnVtYmVyKTogbnVtYmVyIHtcbiAgY29uc29sZS5sb2codmFsdWUsIG90aGVyKTtcblxuICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCAmJiBvdGhlciA9PT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIDE7XG4gIH1cblxuICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCB8fCBvdGhlciA9PT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIHZhbHVlID8/IG90aGVyO1xuICB9XG5cbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIG90aGVyID09PSAnc3RyaW5nJykge1xuICAgIHZhbHVlID0gdG9TdHJpbmcodmFsdWUpIGFzIGFueTtcbiAgICBvdGhlciA9IHRvU3RyaW5nKG90aGVyKSBhcyBhbnk7XG4gIH0gZWxzZSB7XG4gICAgdmFsdWUgPSB0b051bWJlcih2YWx1ZSk7XG4gICAgb3RoZXIgPSB0b051bWJlcihvdGhlcik7XG4gIH1cblxuICByZXR1cm4gdmFsdWUgLyBvdGhlcjtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLFFBQVEsUUFBUSxzQkFBc0I7QUFDL0MsU0FBUyxRQUFRLFFBQVEsc0JBQXNCO0FBRS9DOzs7Ozs7Ozs7Ozs7OztDQWNDLEdBQ0QsT0FBTyxTQUFTLE9BQU8sS0FBYSxFQUFFLEtBQWE7RUFDakQsUUFBUSxHQUFHLENBQUMsT0FBTztFQUVuQixJQUFJLFVBQVUsYUFBYSxVQUFVLFdBQVc7SUFDOUMsT0FBTztFQUNUO0VBRUEsSUFBSSxVQUFVLGFBQWEsVUFBVSxXQUFXO0lBQzlDLE9BQU8sU0FBUztFQUNsQjtFQUVBLElBQUksT0FBTyxVQUFVLFlBQVksT0FBTyxVQUFVLFVBQVU7SUFDMUQsUUFBUSxTQUFTO0lBQ2pCLFFBQVEsU0FBUztFQUNuQixPQUFPO0lBQ0wsUUFBUSxTQUFTO0lBQ2pCLFFBQVEsU0FBUztFQUNuQjtFQUVBLE9BQU8sUUFBUTtBQUNqQiJ9
// denoCacheMetadata=4169942879228642266,1818996815775355558