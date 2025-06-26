import { toNumber } from '../util/toNumber.ts';
import { toString } from '../util/toString.ts';
/**
 * Multiply two numbers.
 *
 * If either of the numbers is `NaN`, the function returns `NaN`.
 *
 * @param {number} value The first number in a multiplication
 * @param {number} other The second number in a multiplication
 * @returns {number} The product of value and other
 *
 * @example
 * multiply(2, 3); // => 6
 * multiply(2, NaN); // => NaN
 * multiply(NaN, 3); // => NaN
 * multiply(NaN, NaN); // => NaN
 */ export function multiply(value, other) {
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
  return value * other;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvbWF0aC9tdWx0aXBseS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyB0b051bWJlciB9IGZyb20gJy4uL3V0aWwvdG9OdW1iZXIudHMnO1xuaW1wb3J0IHsgdG9TdHJpbmcgfSBmcm9tICcuLi91dGlsL3RvU3RyaW5nLnRzJztcblxuLyoqXG4gKiBNdWx0aXBseSB0d28gbnVtYmVycy5cbiAqXG4gKiBJZiBlaXRoZXIgb2YgdGhlIG51bWJlcnMgaXMgYE5hTmAsIHRoZSBmdW5jdGlvbiByZXR1cm5zIGBOYU5gLlxuICpcbiAqIEBwYXJhbSB7bnVtYmVyfSB2YWx1ZSBUaGUgZmlyc3QgbnVtYmVyIGluIGEgbXVsdGlwbGljYXRpb25cbiAqIEBwYXJhbSB7bnVtYmVyfSBvdGhlciBUaGUgc2Vjb25kIG51bWJlciBpbiBhIG11bHRpcGxpY2F0aW9uXG4gKiBAcmV0dXJucyB7bnVtYmVyfSBUaGUgcHJvZHVjdCBvZiB2YWx1ZSBhbmQgb3RoZXJcbiAqXG4gKiBAZXhhbXBsZVxuICogbXVsdGlwbHkoMiwgMyk7IC8vID0+IDZcbiAqIG11bHRpcGx5KDIsIE5hTik7IC8vID0+IE5hTlxuICogbXVsdGlwbHkoTmFOLCAzKTsgLy8gPT4gTmFOXG4gKiBtdWx0aXBseShOYU4sIE5hTik7IC8vID0+IE5hTlxuICovXG5cbmV4cG9ydCBmdW5jdGlvbiBtdWx0aXBseSh2YWx1ZTogbnVtYmVyLCBvdGhlcjogbnVtYmVyKTogbnVtYmVyIHtcbiAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQgJiYgb3RoZXIgPT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiAxO1xuICB9XG5cbiAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQgfHwgb3RoZXIgPT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiB2YWx1ZSA/PyBvdGhlcjtcbiAgfVxuXG4gIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnIHx8IHR5cGVvZiBvdGhlciA9PT0gJ3N0cmluZycpIHtcbiAgICB2YWx1ZSA9IHRvU3RyaW5nKHZhbHVlKSBhcyBhbnk7XG4gICAgb3RoZXIgPSB0b1N0cmluZyhvdGhlcikgYXMgYW55O1xuICB9IGVsc2Uge1xuICAgIHZhbHVlID0gdG9OdW1iZXIodmFsdWUpO1xuICAgIG90aGVyID0gdG9OdW1iZXIob3RoZXIpO1xuICB9XG5cbiAgcmV0dXJuIHZhbHVlICogb3RoZXI7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxRQUFRLFFBQVEsc0JBQXNCO0FBQy9DLFNBQVMsUUFBUSxRQUFRLHNCQUFzQjtBQUUvQzs7Ozs7Ozs7Ozs7Ozs7Q0FjQyxHQUVELE9BQU8sU0FBUyxTQUFTLEtBQWEsRUFBRSxLQUFhO0VBQ25ELElBQUksVUFBVSxhQUFhLFVBQVUsV0FBVztJQUM5QyxPQUFPO0VBQ1Q7RUFFQSxJQUFJLFVBQVUsYUFBYSxVQUFVLFdBQVc7SUFDOUMsT0FBTyxTQUFTO0VBQ2xCO0VBRUEsSUFBSSxPQUFPLFVBQVUsWUFBWSxPQUFPLFVBQVUsVUFBVTtJQUMxRCxRQUFRLFNBQVM7SUFDakIsUUFBUSxTQUFTO0VBQ25CLE9BQU87SUFDTCxRQUFRLFNBQVM7SUFDakIsUUFBUSxTQUFTO0VBQ25CO0VBRUEsT0FBTyxRQUFRO0FBQ2pCIn0=
// denoCacheMetadata=732443061920781917,4844890863150879357