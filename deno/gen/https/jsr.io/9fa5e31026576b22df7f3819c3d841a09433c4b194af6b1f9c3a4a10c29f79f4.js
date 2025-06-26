import { toInteger } from '../util/toInteger.ts';
/**
 * Creates a function that retrieves the argument at the specified index `n`.
 *
 * If `n` is negative, the nth argument from the end is returned.
 *
 * @param {number} [n=0] - The index of the argument to retrieve.
 *   If negative, counts from the end of the arguments list.
 * @returns {(args: any[]) => unknown} A new function that returns the argument at the specified index.
 *
 * @example
 * const getSecondArg = nthArg(1);
 * const result = getSecondArg('a', 'b', 'c');
 * console.log(result); // => 'b'
 *
 * @example
 * const getLastArg = nthArg(-1);
 * const result = getLastArg('a', 'b', 'c');
 * console.log(result); // => 'c'
 */ export function nthArg(n = 0) {
  return function(...args) {
    return args.at(toInteger(n));
  };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvZnVuY3Rpb24vbnRoQXJnLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHRvSW50ZWdlciB9IGZyb20gJy4uL3V0aWwvdG9JbnRlZ2VyLnRzJztcblxuLyoqXG4gKiBDcmVhdGVzIGEgZnVuY3Rpb24gdGhhdCByZXRyaWV2ZXMgdGhlIGFyZ3VtZW50IGF0IHRoZSBzcGVjaWZpZWQgaW5kZXggYG5gLlxuICpcbiAqIElmIGBuYCBpcyBuZWdhdGl2ZSwgdGhlIG50aCBhcmd1bWVudCBmcm9tIHRoZSBlbmQgaXMgcmV0dXJuZWQuXG4gKlxuICogQHBhcmFtIHtudW1iZXJ9IFtuPTBdIC0gVGhlIGluZGV4IG9mIHRoZSBhcmd1bWVudCB0byByZXRyaWV2ZS5cbiAqICAgSWYgbmVnYXRpdmUsIGNvdW50cyBmcm9tIHRoZSBlbmQgb2YgdGhlIGFyZ3VtZW50cyBsaXN0LlxuICogQHJldHVybnMgeyhhcmdzOiBhbnlbXSkgPT4gdW5rbm93bn0gQSBuZXcgZnVuY3Rpb24gdGhhdCByZXR1cm5zIHRoZSBhcmd1bWVudCBhdCB0aGUgc3BlY2lmaWVkIGluZGV4LlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCBnZXRTZWNvbmRBcmcgPSBudGhBcmcoMSk7XG4gKiBjb25zdCByZXN1bHQgPSBnZXRTZWNvbmRBcmcoJ2EnLCAnYicsICdjJyk7XG4gKiBjb25zb2xlLmxvZyhyZXN1bHQpOyAvLyA9PiAnYidcbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgZ2V0TGFzdEFyZyA9IG50aEFyZygtMSk7XG4gKiBjb25zdCByZXN1bHQgPSBnZXRMYXN0QXJnKCdhJywgJ2InLCAnYycpO1xuICogY29uc29sZS5sb2cocmVzdWx0KTsgLy8gPT4gJ2MnXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBudGhBcmcobiA9IDApOiAoLi4uYXJnczogYW55W10pID0+IHVua25vd24ge1xuICByZXR1cm4gZnVuY3Rpb24gKC4uLmFyZ3M6IGFueVtdKSB7XG4gICAgcmV0dXJuIGFyZ3MuYXQodG9JbnRlZ2VyKG4pKTtcbiAgfTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLFNBQVMsUUFBUSx1QkFBdUI7QUFFakQ7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQWtCQyxHQUNELE9BQU8sU0FBUyxPQUFPLElBQUksQ0FBQztFQUMxQixPQUFPLFNBQVUsR0FBRyxJQUFXO0lBQzdCLE9BQU8sS0FBSyxFQUFFLENBQUMsVUFBVTtFQUMzQjtBQUNGIn0=
// denoCacheMetadata=4993395667615236239,1891755729153987518