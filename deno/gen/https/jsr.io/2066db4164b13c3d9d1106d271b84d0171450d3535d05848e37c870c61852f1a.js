/**
 * Creates a duplicate-free version of an array.
 *
 * This function takes an array and returns a new array containing only the unique values
 * from the original array, preserving the order of first occurrence.
 *
 * @template T - The type of elements in the array.
 * @param {T[]} arr - The array to process.
 * @returns {T[]} A new array with only unique values from the original array.
 *
 * @example
 * const array = [1, 2, 2, 3, 4, 4, 5];
 * const result = uniq(array);
 * // result will be [1, 2, 3, 4, 5]
 */ export function uniq(arr) {
  return Array.from(new Set(arr));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9hcnJheS91bmlxLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQ3JlYXRlcyBhIGR1cGxpY2F0ZS1mcmVlIHZlcnNpb24gb2YgYW4gYXJyYXkuXG4gKlxuICogVGhpcyBmdW5jdGlvbiB0YWtlcyBhbiBhcnJheSBhbmQgcmV0dXJucyBhIG5ldyBhcnJheSBjb250YWluaW5nIG9ubHkgdGhlIHVuaXF1ZSB2YWx1ZXNcbiAqIGZyb20gdGhlIG9yaWdpbmFsIGFycmF5LCBwcmVzZXJ2aW5nIHRoZSBvcmRlciBvZiBmaXJzdCBvY2N1cnJlbmNlLlxuICpcbiAqIEB0ZW1wbGF0ZSBUIC0gVGhlIHR5cGUgb2YgZWxlbWVudHMgaW4gdGhlIGFycmF5LlxuICogQHBhcmFtIHtUW119IGFyciAtIFRoZSBhcnJheSB0byBwcm9jZXNzLlxuICogQHJldHVybnMge1RbXX0gQSBuZXcgYXJyYXkgd2l0aCBvbmx5IHVuaXF1ZSB2YWx1ZXMgZnJvbSB0aGUgb3JpZ2luYWwgYXJyYXkuXG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IGFycmF5ID0gWzEsIDIsIDIsIDMsIDQsIDQsIDVdO1xuICogY29uc3QgcmVzdWx0ID0gdW5pcShhcnJheSk7XG4gKiAvLyByZXN1bHQgd2lsbCBiZSBbMSwgMiwgMywgNCwgNV1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHVuaXE8VD4oYXJyOiByZWFkb25seSBUW10pOiBUW10ge1xuICByZXR1cm4gQXJyYXkuZnJvbShuZXcgU2V0KGFycikpO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7OztDQWNDLEdBQ0QsT0FBTyxTQUFTLEtBQVEsR0FBaUI7RUFDdkMsT0FBTyxNQUFNLElBQUksQ0FBQyxJQUFJLElBQUk7QUFDNUIifQ==
// denoCacheMetadata=4820893586147540721,4410493622009223