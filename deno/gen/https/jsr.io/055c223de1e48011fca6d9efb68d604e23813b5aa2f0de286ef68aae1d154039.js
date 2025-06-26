/**
 * Flattens an array up to the specified depth.
 *
 * @template T - The type of elements within the array.
 * @template D - The depth to which the array should be flattened.
 * @param {T[]} arr - The array to flatten.
 * @param {D} depth - The depth level specifying how deep a nested array structure should be flattened. Defaults to 1.
 * @returns {Array<FlatArray<T[], D>>} A new array that has been flattened.
 *
 * @example
 * const arr = flatten([1, [2, 3], [4, [5, 6]]], 1);
 * // Returns: [1, 2, 3, 4, [5, 6]]
 *
 * const arr = flatten([1, [2, 3], [4, [5, 6]]], 2);
 * // Returns: [1, 2, 3, 4, 5, 6]
 */ export function flatten(arr, depth = 1) {
  const result = [];
  const flooredDepth = Math.floor(depth);
  const recursive = (arr, currentDepth)=>{
    for(let i = 0; i < arr.length; i++){
      const item = arr[i];
      if (Array.isArray(item) && currentDepth < flooredDepth) {
        recursive(item, currentDepth + 1);
      } else {
        result.push(item);
      }
    }
  };
  recursive(arr, 0);
  return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9hcnJheS9mbGF0dGVuLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogRmxhdHRlbnMgYW4gYXJyYXkgdXAgdG8gdGhlIHNwZWNpZmllZCBkZXB0aC5cbiAqXG4gKiBAdGVtcGxhdGUgVCAtIFRoZSB0eXBlIG9mIGVsZW1lbnRzIHdpdGhpbiB0aGUgYXJyYXkuXG4gKiBAdGVtcGxhdGUgRCAtIFRoZSBkZXB0aCB0byB3aGljaCB0aGUgYXJyYXkgc2hvdWxkIGJlIGZsYXR0ZW5lZC5cbiAqIEBwYXJhbSB7VFtdfSBhcnIgLSBUaGUgYXJyYXkgdG8gZmxhdHRlbi5cbiAqIEBwYXJhbSB7RH0gZGVwdGggLSBUaGUgZGVwdGggbGV2ZWwgc3BlY2lmeWluZyBob3cgZGVlcCBhIG5lc3RlZCBhcnJheSBzdHJ1Y3R1cmUgc2hvdWxkIGJlIGZsYXR0ZW5lZC4gRGVmYXVsdHMgdG8gMS5cbiAqIEByZXR1cm5zIHtBcnJheTxGbGF0QXJyYXk8VFtdLCBEPj59IEEgbmV3IGFycmF5IHRoYXQgaGFzIGJlZW4gZmxhdHRlbmVkLlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCBhcnIgPSBmbGF0dGVuKFsxLCBbMiwgM10sIFs0LCBbNSwgNl1dXSwgMSk7XG4gKiAvLyBSZXR1cm5zOiBbMSwgMiwgMywgNCwgWzUsIDZdXVxuICpcbiAqIGNvbnN0IGFyciA9IGZsYXR0ZW4oWzEsIFsyLCAzXSwgWzQsIFs1LCA2XV1dLCAyKTtcbiAqIC8vIFJldHVybnM6IFsxLCAyLCAzLCA0LCA1LCA2XVxuICovXG5leHBvcnQgZnVuY3Rpb24gZmxhdHRlbjxULCBEIGV4dGVuZHMgbnVtYmVyID0gMT4oYXJyOiByZWFkb25seSBUW10sIGRlcHRoID0gMSBhcyBEKTogQXJyYXk8RmxhdEFycmF5PFRbXSwgRD4+IHtcbiAgY29uc3QgcmVzdWx0OiBBcnJheTxGbGF0QXJyYXk8VFtdLCBEPj4gPSBbXTtcbiAgY29uc3QgZmxvb3JlZERlcHRoID0gTWF0aC5mbG9vcihkZXB0aCk7XG5cbiAgY29uc3QgcmVjdXJzaXZlID0gKGFycjogcmVhZG9ubHkgVFtdLCBjdXJyZW50RGVwdGg6IG51bWJlcikgPT4ge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYXJyLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBpdGVtID0gYXJyW2ldO1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkoaXRlbSkgJiYgY3VycmVudERlcHRoIDwgZmxvb3JlZERlcHRoKSB7XG4gICAgICAgIHJlY3Vyc2l2ZShpdGVtLCBjdXJyZW50RGVwdGggKyAxKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc3VsdC5wdXNoKGl0ZW0gYXMgRmxhdEFycmF5PFRbXSwgRD4pO1xuICAgICAgfVxuICAgIH1cbiAgfTtcblxuICByZWN1cnNpdmUoYXJyLCAwKTtcbiAgcmV0dXJuIHJlc3VsdDtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7Ozs7O0NBZUMsR0FDRCxPQUFPLFNBQVMsUUFBaUMsR0FBaUIsRUFBRSxRQUFRLENBQU07RUFDaEYsTUFBTSxTQUFtQyxFQUFFO0VBQzNDLE1BQU0sZUFBZSxLQUFLLEtBQUssQ0FBQztFQUVoQyxNQUFNLFlBQVksQ0FBQyxLQUFtQjtJQUNwQyxJQUFLLElBQUksSUFBSSxHQUFHLElBQUksSUFBSSxNQUFNLEVBQUUsSUFBSztNQUNuQyxNQUFNLE9BQU8sR0FBRyxDQUFDLEVBQUU7TUFDbkIsSUFBSSxNQUFNLE9BQU8sQ0FBQyxTQUFTLGVBQWUsY0FBYztRQUN0RCxVQUFVLE1BQU0sZUFBZTtNQUNqQyxPQUFPO1FBQ0wsT0FBTyxJQUFJLENBQUM7TUFDZDtJQUNGO0VBQ0Y7RUFFQSxVQUFVLEtBQUs7RUFDZixPQUFPO0FBQ1QifQ==
// denoCacheMetadata=10902490195440982361,9731089843809570212