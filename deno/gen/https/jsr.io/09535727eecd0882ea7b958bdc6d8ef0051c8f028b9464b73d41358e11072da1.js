import { isArrayLike } from '../predicate/isArrayLike.ts';
/**
 * Joins elements of an array into a string.
 *
 * @template T - The type of elements in the array.
 * @param {ArrayLike<T> | null | undefined} array - The array to join.
 * @param {string} separator - The separator used to join the elements, default is common separator `,`.
 * @returns {string} - Returns a string containing all elements of the array joined by the specified separator.
 *
 * @example
 * const arr = ["a", "b", "c"];
 * const result = join(arr, "~");
 * console.log(result); // Output: "a~b~c"
 */ export function join(array, separator = ',') {
  if (!isArrayLike(array)) {
    return '';
  }
  return Array.from(array).join(separator);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvYXJyYXkvam9pbi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBpc0FycmF5TGlrZSB9IGZyb20gJy4uL3ByZWRpY2F0ZS9pc0FycmF5TGlrZS50cyc7XG5cbi8qKlxuICogSm9pbnMgZWxlbWVudHMgb2YgYW4gYXJyYXkgaW50byBhIHN0cmluZy5cbiAqXG4gKiBAdGVtcGxhdGUgVCAtIFRoZSB0eXBlIG9mIGVsZW1lbnRzIGluIHRoZSBhcnJheS5cbiAqIEBwYXJhbSB7QXJyYXlMaWtlPFQ+IHwgbnVsbCB8IHVuZGVmaW5lZH0gYXJyYXkgLSBUaGUgYXJyYXkgdG8gam9pbi5cbiAqIEBwYXJhbSB7c3RyaW5nfSBzZXBhcmF0b3IgLSBUaGUgc2VwYXJhdG9yIHVzZWQgdG8gam9pbiB0aGUgZWxlbWVudHMsIGRlZmF1bHQgaXMgY29tbW9uIHNlcGFyYXRvciBgLGAuXG4gKiBAcmV0dXJucyB7c3RyaW5nfSAtIFJldHVybnMgYSBzdHJpbmcgY29udGFpbmluZyBhbGwgZWxlbWVudHMgb2YgdGhlIGFycmF5IGpvaW5lZCBieSB0aGUgc3BlY2lmaWVkIHNlcGFyYXRvci5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgYXJyID0gW1wiYVwiLCBcImJcIiwgXCJjXCJdO1xuICogY29uc3QgcmVzdWx0ID0gam9pbihhcnIsIFwiflwiKTtcbiAqIGNvbnNvbGUubG9nKHJlc3VsdCk7IC8vIE91dHB1dDogXCJhfmJ+Y1wiXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBqb2luPFQ+KGFycmF5OiBBcnJheUxpa2U8VD4gfCBudWxsIHwgdW5kZWZpbmVkLCBzZXBhcmF0b3IgPSAnLCcpOiBzdHJpbmcge1xuICBpZiAoIWlzQXJyYXlMaWtlKGFycmF5KSkge1xuICAgIHJldHVybiAnJztcbiAgfVxuICByZXR1cm4gQXJyYXkuZnJvbShhcnJheSkuam9pbihzZXBhcmF0b3IpO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsV0FBVyxRQUFRLDhCQUE4QjtBQUUxRDs7Ozs7Ozs7Ozs7O0NBWUMsR0FDRCxPQUFPLFNBQVMsS0FBUSxLQUFzQyxFQUFFLFlBQVksR0FBRztFQUM3RSxJQUFJLENBQUMsWUFBWSxRQUFRO0lBQ3ZCLE9BQU87RUFDVDtFQUNBLE9BQU8sTUFBTSxJQUFJLENBQUMsT0FBTyxJQUFJLENBQUM7QUFDaEMifQ==
// denoCacheMetadata=7974976840836718949,5460452049742942573