import { mean } from './mean.ts';
/**
 * Calculates the average of an array of numbers when applying
 * the `getValue` function to each element.
 *
 * If the array is empty, this function returns `NaN`.
 *
 * @template T - The type of elements in the array.
 * @param {T[]} items An array to calculate the average.
 * @param {(element: T) => number} getValue A function that selects a numeric value from each element.
 * @returns {number} The average of all the numbers as determined by the `getValue` function.
 *
 * @example
 * meanBy([{ a: 1 }, { a: 2 }, { a: 3 }], x => x.a); // Returns: 2
 * meanBy([], x => x.a); // Returns: NaN
 */ export function meanBy(items, getValue) {
  const nums = items.map((x)=>getValue(x));
  return mean(nums);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9tYXRoL21lYW5CeS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBtZWFuIH0gZnJvbSAnLi9tZWFuLnRzJztcblxuLyoqXG4gKiBDYWxjdWxhdGVzIHRoZSBhdmVyYWdlIG9mIGFuIGFycmF5IG9mIG51bWJlcnMgd2hlbiBhcHBseWluZ1xuICogdGhlIGBnZXRWYWx1ZWAgZnVuY3Rpb24gdG8gZWFjaCBlbGVtZW50LlxuICpcbiAqIElmIHRoZSBhcnJheSBpcyBlbXB0eSwgdGhpcyBmdW5jdGlvbiByZXR1cm5zIGBOYU5gLlxuICpcbiAqIEB0ZW1wbGF0ZSBUIC0gVGhlIHR5cGUgb2YgZWxlbWVudHMgaW4gdGhlIGFycmF5LlxuICogQHBhcmFtIHtUW119IGl0ZW1zIEFuIGFycmF5IHRvIGNhbGN1bGF0ZSB0aGUgYXZlcmFnZS5cbiAqIEBwYXJhbSB7KGVsZW1lbnQ6IFQpID0+IG51bWJlcn0gZ2V0VmFsdWUgQSBmdW5jdGlvbiB0aGF0IHNlbGVjdHMgYSBudW1lcmljIHZhbHVlIGZyb20gZWFjaCBlbGVtZW50LlxuICogQHJldHVybnMge251bWJlcn0gVGhlIGF2ZXJhZ2Ugb2YgYWxsIHRoZSBudW1iZXJzIGFzIGRldGVybWluZWQgYnkgdGhlIGBnZXRWYWx1ZWAgZnVuY3Rpb24uXG4gKlxuICogQGV4YW1wbGVcbiAqIG1lYW5CeShbeyBhOiAxIH0sIHsgYTogMiB9LCB7IGE6IDMgfV0sIHggPT4geC5hKTsgLy8gUmV0dXJuczogMlxuICogbWVhbkJ5KFtdLCB4ID0+IHguYSk7IC8vIFJldHVybnM6IE5hTlxuICovXG5leHBvcnQgZnVuY3Rpb24gbWVhbkJ5PFQ+KGl0ZW1zOiByZWFkb25seSBUW10sIGdldFZhbHVlOiAoZWxlbWVudDogVCkgPT4gbnVtYmVyKTogbnVtYmVyIHtcbiAgY29uc3QgbnVtcyA9IGl0ZW1zLm1hcCh4ID0+IGdldFZhbHVlKHgpKTtcblxuICByZXR1cm4gbWVhbihudW1zKTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLElBQUksUUFBUSxZQUFZO0FBRWpDOzs7Ozs7Ozs7Ozs7OztDQWNDLEdBQ0QsT0FBTyxTQUFTLE9BQVUsS0FBbUIsRUFBRSxRQUFnQztFQUM3RSxNQUFNLE9BQU8sTUFBTSxHQUFHLENBQUMsQ0FBQSxJQUFLLFNBQVM7RUFFckMsT0FBTyxLQUFLO0FBQ2QifQ==
// denoCacheMetadata=17440986029056323741,13845403330859738971