import { MAX_ARRAY_LENGTH } from '../_internal/MAX_ARRAY_LENGTH.ts';
import { clamp } from '../math/clamp.ts';
/**
 * Converts the value to a valid index. A valid index is an integer that is greater than or equal to `0` and less than or equal to `2^32 - 1`.
 *
 * It converts the given value to a number and floors it to an integer. If the value is less than `0`, it returns `0`. If the value exceeds `2^32 - 1`, it returns `2^32 - 1`.
 *
 * @param {unknown} value - The value to convert to a valid index.
 * @returns {number} The converted value.
 *
 * @example
 * toLength(3.2)  // => 3
 * toLength(-1)   // => 0
 * toLength(1.9)  // => 1
 * toLength('42') // => 42
 * toLength(null) // => 0
 */ export function toLength(value) {
  if (value == null) {
    return 0;
  }
  const length = Math.floor(Number(value));
  return clamp(length, 0, MAX_ARRAY_LENGTH);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvdXRpbC90b0xlbmd0aC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBNQVhfQVJSQVlfTEVOR1RIIH0gZnJvbSAnLi4vX2ludGVybmFsL01BWF9BUlJBWV9MRU5HVEgudHMnO1xuaW1wb3J0IHsgY2xhbXAgfSBmcm9tICcuLi9tYXRoL2NsYW1wLnRzJztcblxuLyoqXG4gKiBDb252ZXJ0cyB0aGUgdmFsdWUgdG8gYSB2YWxpZCBpbmRleC4gQSB2YWxpZCBpbmRleCBpcyBhbiBpbnRlZ2VyIHRoYXQgaXMgZ3JlYXRlciB0aGFuIG9yIGVxdWFsIHRvIGAwYCBhbmQgbGVzcyB0aGFuIG9yIGVxdWFsIHRvIGAyXjMyIC0gMWAuXG4gKlxuICogSXQgY29udmVydHMgdGhlIGdpdmVuIHZhbHVlIHRvIGEgbnVtYmVyIGFuZCBmbG9vcnMgaXQgdG8gYW4gaW50ZWdlci4gSWYgdGhlIHZhbHVlIGlzIGxlc3MgdGhhbiBgMGAsIGl0IHJldHVybnMgYDBgLiBJZiB0aGUgdmFsdWUgZXhjZWVkcyBgMl4zMiAtIDFgLCBpdCByZXR1cm5zIGAyXjMyIC0gMWAuXG4gKlxuICogQHBhcmFtIHt1bmtub3dufSB2YWx1ZSAtIFRoZSB2YWx1ZSB0byBjb252ZXJ0IHRvIGEgdmFsaWQgaW5kZXguXG4gKiBAcmV0dXJucyB7bnVtYmVyfSBUaGUgY29udmVydGVkIHZhbHVlLlxuICpcbiAqIEBleGFtcGxlXG4gKiB0b0xlbmd0aCgzLjIpICAvLyA9PiAzXG4gKiB0b0xlbmd0aCgtMSkgICAvLyA9PiAwXG4gKiB0b0xlbmd0aCgxLjkpICAvLyA9PiAxXG4gKiB0b0xlbmd0aCgnNDInKSAvLyA9PiA0MlxuICogdG9MZW5ndGgobnVsbCkgLy8gPT4gMFxuICovXG5leHBvcnQgZnVuY3Rpb24gdG9MZW5ndGgodmFsdWU/OiB1bmtub3duKTogbnVtYmVyIHtcbiAgaWYgKHZhbHVlID09IG51bGwpIHtcbiAgICByZXR1cm4gMDtcbiAgfVxuXG4gIGNvbnN0IGxlbmd0aCA9IE1hdGguZmxvb3IoTnVtYmVyKHZhbHVlKSk7XG5cbiAgcmV0dXJuIGNsYW1wKGxlbmd0aCwgMCwgTUFYX0FSUkFZX0xFTkdUSCk7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxnQkFBZ0IsUUFBUSxtQ0FBbUM7QUFDcEUsU0FBUyxLQUFLLFFBQVEsbUJBQW1CO0FBRXpDOzs7Ozs7Ozs7Ozs7OztDQWNDLEdBQ0QsT0FBTyxTQUFTLFNBQVMsS0FBZTtFQUN0QyxJQUFJLFNBQVMsTUFBTTtJQUNqQixPQUFPO0VBQ1Q7RUFFQSxNQUFNLFNBQVMsS0FBSyxLQUFLLENBQUMsT0FBTztFQUVqQyxPQUFPLE1BQU0sUUFBUSxHQUFHO0FBQzFCIn0=
// denoCacheMetadata=4399931324882767413,8749310772389690655