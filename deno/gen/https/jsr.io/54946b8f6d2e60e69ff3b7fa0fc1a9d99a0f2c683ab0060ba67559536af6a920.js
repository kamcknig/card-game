import { uniq as uniqToolkit } from '../../array/uniq.ts';
import { isArrayLike } from '../predicate/isArrayLike.ts';
/**
 * Creates a duplicate-free version of an array.
 *
 * This function takes an array and returns a new array containing only the unique values
 * from the original array, preserving the order of first occurrence.
 *
 * @template T - The type of elements in the array.
 * @param {ArrayLike<T> | null | undefined} arr - The array to process.
 * @returns {T[]} A new array with only unique values from the original array.
 *
 * @example
 * const array = [1, 2, 2, 3, 4, 4, 5];
 * const result = uniq(array);
 * // result will be [1, 2, 3, 4, 5]
 */ export function uniq(arr) {
  if (!isArrayLike(arr)) {
    return [];
  }
  return uniqToolkit(Array.from(arr));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvYXJyYXkvdW5pcS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyB1bmlxIGFzIHVuaXFUb29sa2l0IH0gZnJvbSAnLi4vLi4vYXJyYXkvdW5pcS50cyc7XG5pbXBvcnQgeyBpc0FycmF5TGlrZSB9IGZyb20gJy4uL3ByZWRpY2F0ZS9pc0FycmF5TGlrZS50cyc7XG5cbi8qKlxuICogQ3JlYXRlcyBhIGR1cGxpY2F0ZS1mcmVlIHZlcnNpb24gb2YgYW4gYXJyYXkuXG4gKlxuICogVGhpcyBmdW5jdGlvbiB0YWtlcyBhbiBhcnJheSBhbmQgcmV0dXJucyBhIG5ldyBhcnJheSBjb250YWluaW5nIG9ubHkgdGhlIHVuaXF1ZSB2YWx1ZXNcbiAqIGZyb20gdGhlIG9yaWdpbmFsIGFycmF5LCBwcmVzZXJ2aW5nIHRoZSBvcmRlciBvZiBmaXJzdCBvY2N1cnJlbmNlLlxuICpcbiAqIEB0ZW1wbGF0ZSBUIC0gVGhlIHR5cGUgb2YgZWxlbWVudHMgaW4gdGhlIGFycmF5LlxuICogQHBhcmFtIHtBcnJheUxpa2U8VD4gfCBudWxsIHwgdW5kZWZpbmVkfSBhcnIgLSBUaGUgYXJyYXkgdG8gcHJvY2Vzcy5cbiAqIEByZXR1cm5zIHtUW119IEEgbmV3IGFycmF5IHdpdGggb25seSB1bmlxdWUgdmFsdWVzIGZyb20gdGhlIG9yaWdpbmFsIGFycmF5LlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCBhcnJheSA9IFsxLCAyLCAyLCAzLCA0LCA0LCA1XTtcbiAqIGNvbnN0IHJlc3VsdCA9IHVuaXEoYXJyYXkpO1xuICogLy8gcmVzdWx0IHdpbGwgYmUgWzEsIDIsIDMsIDQsIDVdXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB1bmlxPFQ+KGFycjogQXJyYXlMaWtlPFQ+IHwgbnVsbCB8IHVuZGVmaW5lZCk6IFRbXSB7XG4gIGlmICghaXNBcnJheUxpa2UoYXJyKSkge1xuICAgIHJldHVybiBbXTtcbiAgfVxuICByZXR1cm4gdW5pcVRvb2xraXQoQXJyYXkuZnJvbShhcnIpKTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLFFBQVEsV0FBVyxRQUFRLHNCQUFzQjtBQUMxRCxTQUFTLFdBQVcsUUFBUSw4QkFBOEI7QUFFMUQ7Ozs7Ozs7Ozs7Ozs7O0NBY0MsR0FDRCxPQUFPLFNBQVMsS0FBUSxHQUFvQztFQUMxRCxJQUFJLENBQUMsWUFBWSxNQUFNO0lBQ3JCLE9BQU8sRUFBRTtFQUNYO0VBQ0EsT0FBTyxZQUFZLE1BQU0sSUFBSSxDQUFDO0FBQ2hDIn0=
// denoCacheMetadata=8930931921777193657,7878068408233797431