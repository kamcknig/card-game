/**
 * Computes the difference between two arrays.
 *
 * This function takes two arrays and returns a new array containing the elements
 * that are present in the first array but not in the second array. It effectively
 * filters out any elements from the first array that also appear in the second array.
 *
 * @template T
 * @param {T[]} firstArr - The array from which to derive the difference. This is the primary array
 * from which elements will be compared and filtered.
 * @param {T[]} secondArr - The array containing elements to be excluded from the first array.
 * Each element in this array will be checked against the first array, and if a match is found,
 * that element will be excluded from the result.
 * @returns {T[]} A new array containing the elements that are present in the first array but not
 * in the second array.
 *
 * @example
 * const array1 = [1, 2, 3, 4, 5];
 * const array2 = [2, 4];
 * const result = difference(array1, array2);
 * // result will be [1, 3, 5] since 2 and 4 are in both arrays and are excluded from the result.
 */ export function difference(firstArr, secondArr) {
  const secondSet = new Set(secondArr);
  return firstArr.filter((item)=>!secondSet.has(item));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9hcnJheS9kaWZmZXJlbmNlLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQ29tcHV0ZXMgdGhlIGRpZmZlcmVuY2UgYmV0d2VlbiB0d28gYXJyYXlzLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gdGFrZXMgdHdvIGFycmF5cyBhbmQgcmV0dXJucyBhIG5ldyBhcnJheSBjb250YWluaW5nIHRoZSBlbGVtZW50c1xuICogdGhhdCBhcmUgcHJlc2VudCBpbiB0aGUgZmlyc3QgYXJyYXkgYnV0IG5vdCBpbiB0aGUgc2Vjb25kIGFycmF5LiBJdCBlZmZlY3RpdmVseVxuICogZmlsdGVycyBvdXQgYW55IGVsZW1lbnRzIGZyb20gdGhlIGZpcnN0IGFycmF5IHRoYXQgYWxzbyBhcHBlYXIgaW4gdGhlIHNlY29uZCBhcnJheS5cbiAqXG4gKiBAdGVtcGxhdGUgVFxuICogQHBhcmFtIHtUW119IGZpcnN0QXJyIC0gVGhlIGFycmF5IGZyb20gd2hpY2ggdG8gZGVyaXZlIHRoZSBkaWZmZXJlbmNlLiBUaGlzIGlzIHRoZSBwcmltYXJ5IGFycmF5XG4gKiBmcm9tIHdoaWNoIGVsZW1lbnRzIHdpbGwgYmUgY29tcGFyZWQgYW5kIGZpbHRlcmVkLlxuICogQHBhcmFtIHtUW119IHNlY29uZEFyciAtIFRoZSBhcnJheSBjb250YWluaW5nIGVsZW1lbnRzIHRvIGJlIGV4Y2x1ZGVkIGZyb20gdGhlIGZpcnN0IGFycmF5LlxuICogRWFjaCBlbGVtZW50IGluIHRoaXMgYXJyYXkgd2lsbCBiZSBjaGVja2VkIGFnYWluc3QgdGhlIGZpcnN0IGFycmF5LCBhbmQgaWYgYSBtYXRjaCBpcyBmb3VuZCxcbiAqIHRoYXQgZWxlbWVudCB3aWxsIGJlIGV4Y2x1ZGVkIGZyb20gdGhlIHJlc3VsdC5cbiAqIEByZXR1cm5zIHtUW119IEEgbmV3IGFycmF5IGNvbnRhaW5pbmcgdGhlIGVsZW1lbnRzIHRoYXQgYXJlIHByZXNlbnQgaW4gdGhlIGZpcnN0IGFycmF5IGJ1dCBub3RcbiAqIGluIHRoZSBzZWNvbmQgYXJyYXkuXG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IGFycmF5MSA9IFsxLCAyLCAzLCA0LCA1XTtcbiAqIGNvbnN0IGFycmF5MiA9IFsyLCA0XTtcbiAqIGNvbnN0IHJlc3VsdCA9IGRpZmZlcmVuY2UoYXJyYXkxLCBhcnJheTIpO1xuICogLy8gcmVzdWx0IHdpbGwgYmUgWzEsIDMsIDVdIHNpbmNlIDIgYW5kIDQgYXJlIGluIGJvdGggYXJyYXlzIGFuZCBhcmUgZXhjbHVkZWQgZnJvbSB0aGUgcmVzdWx0LlxuICovXG5leHBvcnQgZnVuY3Rpb24gZGlmZmVyZW5jZTxUPihmaXJzdEFycjogcmVhZG9ubHkgVFtdLCBzZWNvbmRBcnI6IHJlYWRvbmx5IFRbXSk6IFRbXSB7XG4gIGNvbnN0IHNlY29uZFNldCA9IG5ldyBTZXQoc2Vjb25kQXJyKTtcblxuICByZXR1cm4gZmlyc3RBcnIuZmlsdGVyKGl0ZW0gPT4gIXNlY29uZFNldC5oYXMoaXRlbSkpO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FxQkMsR0FDRCxPQUFPLFNBQVMsV0FBYyxRQUFzQixFQUFFLFNBQXVCO0VBQzNFLE1BQU0sWUFBWSxJQUFJLElBQUk7RUFFMUIsT0FBTyxTQUFTLE1BQU0sQ0FBQyxDQUFBLE9BQVEsQ0FBQyxVQUFVLEdBQUcsQ0FBQztBQUNoRCJ9
// denoCacheMetadata=4336901812555166040,6969416667799912971