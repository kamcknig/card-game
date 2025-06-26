import { toInteger } from './toInteger.ts';
/**
 * Invokes the getValue function n times, returning an array of the results.
 *
 * @template R The return type of the getValue function.
 * @param {number} n - The number of times to invoke getValue.
 * @param {(index: number) => R} getValue - The function to invoke for each index.
 * @returns {R[]} An array containing the results of invoking getValue n times.
 * @example
 * times(3, (i) => i * 2); // => [0, 2, 4]
 * times(2, () => 'es-toolkit'); // => ['es-toolkit', 'es-toolkit']
 */ export function times(n, getValue) {
  n = toInteger(n);
  if (n < 1 || !Number.isSafeInteger(n)) {
    return [];
  }
  const result = new Array(n);
  for(let i = 0; i < n; i++){
    result[i] = typeof getValue === 'function' ? getValue(i) : i;
  }
  return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvdXRpbC90aW1lcy50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyB0b0ludGVnZXIgfSBmcm9tICcuL3RvSW50ZWdlci50cyc7XG5cbi8qKlxuICogSW52b2tlcyB0aGUgZ2V0VmFsdWUgZnVuY3Rpb24gbiB0aW1lcywgcmV0dXJuaW5nIGFuIGFycmF5IG9mIHRoZSByZXN1bHRzLlxuICpcbiAqIEB0ZW1wbGF0ZSBSIFRoZSByZXR1cm4gdHlwZSBvZiB0aGUgZ2V0VmFsdWUgZnVuY3Rpb24uXG4gKiBAcGFyYW0ge251bWJlcn0gbiAtIFRoZSBudW1iZXIgb2YgdGltZXMgdG8gaW52b2tlIGdldFZhbHVlLlxuICogQHBhcmFtIHsoaW5kZXg6IG51bWJlcikgPT4gUn0gZ2V0VmFsdWUgLSBUaGUgZnVuY3Rpb24gdG8gaW52b2tlIGZvciBlYWNoIGluZGV4LlxuICogQHJldHVybnMge1JbXX0gQW4gYXJyYXkgY29udGFpbmluZyB0aGUgcmVzdWx0cyBvZiBpbnZva2luZyBnZXRWYWx1ZSBuIHRpbWVzLlxuICogQGV4YW1wbGVcbiAqIHRpbWVzKDMsIChpKSA9PiBpICogMik7IC8vID0+IFswLCAyLCA0XVxuICogdGltZXMoMiwgKCkgPT4gJ2VzLXRvb2xraXQnKTsgLy8gPT4gWydlcy10b29sa2l0JywgJ2VzLXRvb2xraXQnXVxuICovXG5leHBvcnQgZnVuY3Rpb24gdGltZXM8UiA9IG51bWJlcj4obj86IG51bWJlciwgZ2V0VmFsdWU/OiAoaW5kZXg6IG51bWJlcikgPT4gUik6IFJbXSB7XG4gIG4gPSB0b0ludGVnZXIobik7XG5cbiAgaWYgKG4gPCAxIHx8ICFOdW1iZXIuaXNTYWZlSW50ZWdlcihuKSkge1xuICAgIHJldHVybiBbXTtcbiAgfVxuXG4gIGNvbnN0IHJlc3VsdCA9IG5ldyBBcnJheShuKTtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IG47IGkrKykge1xuICAgIHJlc3VsdFtpXSA9IHR5cGVvZiBnZXRWYWx1ZSA9PT0gJ2Z1bmN0aW9uJyA/IGdldFZhbHVlKGkpIDogaTtcbiAgfVxuXG4gIHJldHVybiByZXN1bHQ7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxTQUFTLFFBQVEsaUJBQWlCO0FBRTNDOzs7Ozs7Ozs7O0NBVUMsR0FDRCxPQUFPLFNBQVMsTUFBa0IsQ0FBVSxFQUFFLFFBQStCO0VBQzNFLElBQUksVUFBVTtFQUVkLElBQUksSUFBSSxLQUFLLENBQUMsT0FBTyxhQUFhLENBQUMsSUFBSTtJQUNyQyxPQUFPLEVBQUU7RUFDWDtFQUVBLE1BQU0sU0FBUyxJQUFJLE1BQU07RUFFekIsSUFBSyxJQUFJLElBQUksR0FBRyxJQUFJLEdBQUcsSUFBSztJQUMxQixNQUFNLENBQUMsRUFBRSxHQUFHLE9BQU8sYUFBYSxhQUFhLFNBQVMsS0FBSztFQUM3RDtFQUVBLE9BQU87QUFDVCJ9
// denoCacheMetadata=7435920389562835252,15109102247414196636