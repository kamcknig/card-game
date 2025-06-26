/**
 * Calculates the sum of an array of numbers when applying
 * the `getValue` function to each element.
 *
 * If the array is empty, this function returns `0`.
 *
 * @template T - The type of elements in the array.
 * @param {T[]} items An array to calculate the sum.
 * @param {(element: T) => number} getValue A function that selects a numeric value from each element.
 * @returns {number} The sum of all the numbers as determined by the `getValue` function.
 *
 * @example
 * sumBy([{ a: 1 }, { a: 2 }, { a: 3 }], x => x.a); // Returns: 6
 * sumBy([], x => x.a); // Returns: 0
 */ export function sumBy(items, getValue) {
  let result = 0;
  for(let i = 0; i < items.length; i++){
    result += getValue(items[i]);
  }
  return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9tYXRoL3N1bUJ5LnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQ2FsY3VsYXRlcyB0aGUgc3VtIG9mIGFuIGFycmF5IG9mIG51bWJlcnMgd2hlbiBhcHBseWluZ1xuICogdGhlIGBnZXRWYWx1ZWAgZnVuY3Rpb24gdG8gZWFjaCBlbGVtZW50LlxuICpcbiAqIElmIHRoZSBhcnJheSBpcyBlbXB0eSwgdGhpcyBmdW5jdGlvbiByZXR1cm5zIGAwYC5cbiAqXG4gKiBAdGVtcGxhdGUgVCAtIFRoZSB0eXBlIG9mIGVsZW1lbnRzIGluIHRoZSBhcnJheS5cbiAqIEBwYXJhbSB7VFtdfSBpdGVtcyBBbiBhcnJheSB0byBjYWxjdWxhdGUgdGhlIHN1bS5cbiAqIEBwYXJhbSB7KGVsZW1lbnQ6IFQpID0+IG51bWJlcn0gZ2V0VmFsdWUgQSBmdW5jdGlvbiB0aGF0IHNlbGVjdHMgYSBudW1lcmljIHZhbHVlIGZyb20gZWFjaCBlbGVtZW50LlxuICogQHJldHVybnMge251bWJlcn0gVGhlIHN1bSBvZiBhbGwgdGhlIG51bWJlcnMgYXMgZGV0ZXJtaW5lZCBieSB0aGUgYGdldFZhbHVlYCBmdW5jdGlvbi5cbiAqXG4gKiBAZXhhbXBsZVxuICogc3VtQnkoW3sgYTogMSB9LCB7IGE6IDIgfSwgeyBhOiAzIH1dLCB4ID0+IHguYSk7IC8vIFJldHVybnM6IDZcbiAqIHN1bUJ5KFtdLCB4ID0+IHguYSk7IC8vIFJldHVybnM6IDBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHN1bUJ5PFQ+KGl0ZW1zOiByZWFkb25seSBUW10sIGdldFZhbHVlOiAoZWxlbWVudDogVCkgPT4gbnVtYmVyKTogbnVtYmVyIHtcbiAgbGV0IHJlc3VsdCA9IDA7XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBpdGVtcy5sZW5ndGg7IGkrKykge1xuICAgIHJlc3VsdCArPSBnZXRWYWx1ZShpdGVtc1tpXSk7XG4gIH1cblxuICByZXR1cm4gcmVzdWx0O1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7OztDQWNDLEdBQ0QsT0FBTyxTQUFTLE1BQVMsS0FBbUIsRUFBRSxRQUFnQztFQUM1RSxJQUFJLFNBQVM7RUFFYixJQUFLLElBQUksSUFBSSxHQUFHLElBQUksTUFBTSxNQUFNLEVBQUUsSUFBSztJQUNyQyxVQUFVLFNBQVMsS0FBSyxDQUFDLEVBQUU7RUFDN0I7RUFFQSxPQUFPO0FBQ1QifQ==
// denoCacheMetadata=14733496131622890908,4224113683641521165