/**
 * Returns a new array containing the leading elements of the provided array
 * that satisfy the provided predicate function. It stops taking elements as soon
 * as an element does not satisfy the predicate.
 *
 * @template T - The type of elements in the array.
 * @param {T[]} arr - The array to process.
 * @param {(element: T) => boolean} shouldContinueTaking - The predicate function that is called with each element. Elements are included in the result as long as this function returns true.
 * @returns {T[]} A new array containing the leading elements that satisfy the predicate.
 *
 * @example
 * // Returns [1, 2]
 * takeWhile([1, 2, 3, 4], x => x < 3);
 *
 * @example
 * // Returns []
 * takeWhile([1, 2, 3, 4], x => x > 3);
 */ export function takeWhile(arr, shouldContinueTaking) {
  const result = [];
  for(let i = 0; i < arr.length; i++){
    const item = arr[i];
    if (!shouldContinueTaking(item)) {
      break;
    }
    result.push(item);
  }
  return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9hcnJheS90YWtlV2hpbGUudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBSZXR1cm5zIGEgbmV3IGFycmF5IGNvbnRhaW5pbmcgdGhlIGxlYWRpbmcgZWxlbWVudHMgb2YgdGhlIHByb3ZpZGVkIGFycmF5XG4gKiB0aGF0IHNhdGlzZnkgdGhlIHByb3ZpZGVkIHByZWRpY2F0ZSBmdW5jdGlvbi4gSXQgc3RvcHMgdGFraW5nIGVsZW1lbnRzIGFzIHNvb25cbiAqIGFzIGFuIGVsZW1lbnQgZG9lcyBub3Qgc2F0aXNmeSB0aGUgcHJlZGljYXRlLlxuICpcbiAqIEB0ZW1wbGF0ZSBUIC0gVGhlIHR5cGUgb2YgZWxlbWVudHMgaW4gdGhlIGFycmF5LlxuICogQHBhcmFtIHtUW119IGFyciAtIFRoZSBhcnJheSB0byBwcm9jZXNzLlxuICogQHBhcmFtIHsoZWxlbWVudDogVCkgPT4gYm9vbGVhbn0gc2hvdWxkQ29udGludWVUYWtpbmcgLSBUaGUgcHJlZGljYXRlIGZ1bmN0aW9uIHRoYXQgaXMgY2FsbGVkIHdpdGggZWFjaCBlbGVtZW50LiBFbGVtZW50cyBhcmUgaW5jbHVkZWQgaW4gdGhlIHJlc3VsdCBhcyBsb25nIGFzIHRoaXMgZnVuY3Rpb24gcmV0dXJucyB0cnVlLlxuICogQHJldHVybnMge1RbXX0gQSBuZXcgYXJyYXkgY29udGFpbmluZyB0aGUgbGVhZGluZyBlbGVtZW50cyB0aGF0IHNhdGlzZnkgdGhlIHByZWRpY2F0ZS5cbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gUmV0dXJucyBbMSwgMl1cbiAqIHRha2VXaGlsZShbMSwgMiwgMywgNF0sIHggPT4geCA8IDMpO1xuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBSZXR1cm5zIFtdXG4gKiB0YWtlV2hpbGUoWzEsIDIsIDMsIDRdLCB4ID0+IHggPiAzKTtcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRha2VXaGlsZTxUPihhcnI6IHJlYWRvbmx5IFRbXSwgc2hvdWxkQ29udGludWVUYWtpbmc6IChlbGVtZW50OiBUKSA9PiBib29sZWFuKTogVFtdIHtcbiAgY29uc3QgcmVzdWx0OiBUW10gPSBbXTtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IGFyci5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGl0ZW0gPSBhcnJbaV07XG4gICAgaWYgKCFzaG91bGRDb250aW51ZVRha2luZyhpdGVtKSkge1xuICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgcmVzdWx0LnB1c2goaXRlbSk7XG4gIH1cblxuICByZXR1cm4gcmVzdWx0O1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7Ozs7OztDQWlCQyxHQUNELE9BQU8sU0FBUyxVQUFhLEdBQWlCLEVBQUUsb0JBQTZDO0VBQzNGLE1BQU0sU0FBYyxFQUFFO0VBRXRCLElBQUssSUFBSSxJQUFJLEdBQUcsSUFBSSxJQUFJLE1BQU0sRUFBRSxJQUFLO0lBQ25DLE1BQU0sT0FBTyxHQUFHLENBQUMsRUFBRTtJQUNuQixJQUFJLENBQUMscUJBQXFCLE9BQU87TUFDL0I7SUFDRjtJQUVBLE9BQU8sSUFBSSxDQUFDO0VBQ2Q7RUFFQSxPQUFPO0FBQ1QifQ==
// denoCacheMetadata=18374655588763247667,12710151994621957784