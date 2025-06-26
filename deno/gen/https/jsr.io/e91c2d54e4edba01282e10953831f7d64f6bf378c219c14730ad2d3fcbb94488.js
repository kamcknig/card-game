/**
 * Finds the element in an array that has the minimum value.
 *
 * @template T - The type of elements in the array.
 * @param {[T, ...T[]]} items - The array of elements to search.
 * @returns {T | undefined} - The element with the minimum value, or undefined if the array is empty.
 * @example
 * // Returns 1
 * min([3, 1, 4, 1, 5, 9]);
 *
 * @example
 * // Returns -3
 * min([0, -3, 2, 8, 7]);
 */ /**
 * Finds the element in an array that has the minimum value.
 *
 * @template T - The type of elements in the array.
 * @param {T[]} [items] - The array of elements to search. Defaults to an empty array.
 * @returns {T} - The element with the minimum value.
 */ export function min(items = []) {
  let minElement = items[0];
  let min1 = undefined;
  for(let i = 0; i < items.length; i++){
    const element = items[i];
    if (min1 == null || element < min1) {
      min1 = element;
      minElement = element;
    }
  }
  return minElement;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvbWF0aC9taW4udHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBGaW5kcyB0aGUgZWxlbWVudCBpbiBhbiBhcnJheSB0aGF0IGhhcyB0aGUgbWluaW11bSB2YWx1ZS5cbiAqXG4gKiBAdGVtcGxhdGUgVCAtIFRoZSB0eXBlIG9mIGVsZW1lbnRzIGluIHRoZSBhcnJheS5cbiAqIEBwYXJhbSB7W1QsIC4uLlRbXV19IGl0ZW1zIC0gVGhlIGFycmF5IG9mIGVsZW1lbnRzIHRvIHNlYXJjaC5cbiAqIEByZXR1cm5zIHtUIHwgdW5kZWZpbmVkfSAtIFRoZSBlbGVtZW50IHdpdGggdGhlIG1pbmltdW0gdmFsdWUsIG9yIHVuZGVmaW5lZCBpZiB0aGUgYXJyYXkgaXMgZW1wdHkuXG4gKiBAZXhhbXBsZVxuICogLy8gUmV0dXJucyAxXG4gKiBtaW4oWzMsIDEsIDQsIDEsIDUsIDldKTtcbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gUmV0dXJucyAtM1xuICogbWluKFswLCAtMywgMiwgOCwgN10pO1xuICovXG5leHBvcnQgZnVuY3Rpb24gbWluPFQ+KGl0ZW1zOiByZWFkb25seSBbVCwgLi4uVFtdXSk6IFQ7XG5cbi8qKlxuICogRmluZHMgdGhlIGVsZW1lbnQgaW4gYW4gYXJyYXkgdGhhdCBoYXMgdGhlIG1pbmltdW0gdmFsdWUuXG4gKiBSZXR1cm5zIHVuZGVmaW5lZCB3aGVuIG5vIGFyZ3VtZW50cyBhcmUgcHJvdmlkZWQuXG4gKiBAcmV0dXJucyB7dW5kZWZpbmVkfVxuICovXG5leHBvcnQgZnVuY3Rpb24gbWluKCk6IHVuZGVmaW5lZDtcblxuLyoqXG4gKiBGaW5kcyB0aGUgZWxlbWVudCBpbiBhbiBhcnJheSB0aGF0IGhhcyB0aGUgbWluaW11bSB2YWx1ZS5cbiAqXG4gKiBAdGVtcGxhdGUgVCAtIFRoZSB0eXBlIG9mIGVsZW1lbnRzIGluIHRoZSBhcnJheS5cbiAqIEBwYXJhbSB7VFtdfSBbaXRlbXNdIC0gVGhlIGFycmF5IG9mIGVsZW1lbnRzIHRvIHNlYXJjaC4gRGVmYXVsdHMgdG8gYW4gZW1wdHkgYXJyYXkuXG4gKiBAcmV0dXJucyB7VCB8IHVuZGVmaW5lZH0gLSBUaGUgZWxlbWVudCB3aXRoIHRoZSBtaW5pbXVtIHZhbHVlLCBvciB1bmRlZmluZWQgaWYgdGhlIGFycmF5IGlzIGVtcHR5LlxuICovXG5leHBvcnQgZnVuY3Rpb24gbWluPFQ+KGl0ZW1zPzogcmVhZG9ubHkgVFtdKTogVCB8IHVuZGVmaW5lZDtcblxuLyoqXG4gKiBGaW5kcyB0aGUgZWxlbWVudCBpbiBhbiBhcnJheSB0aGF0IGhhcyB0aGUgbWluaW11bSB2YWx1ZS5cbiAqXG4gKiBAdGVtcGxhdGUgVCAtIFRoZSB0eXBlIG9mIGVsZW1lbnRzIGluIHRoZSBhcnJheS5cbiAqIEBwYXJhbSB7VFtdfSBbaXRlbXNdIC0gVGhlIGFycmF5IG9mIGVsZW1lbnRzIHRvIHNlYXJjaC4gRGVmYXVsdHMgdG8gYW4gZW1wdHkgYXJyYXkuXG4gKiBAcmV0dXJucyB7VH0gLSBUaGUgZWxlbWVudCB3aXRoIHRoZSBtaW5pbXVtIHZhbHVlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gbWluPFQ+KGl0ZW1zOiByZWFkb25seSBUW10gPSBbXSk6IFQge1xuICBsZXQgbWluRWxlbWVudCA9IGl0ZW1zWzBdO1xuICBsZXQgbWluOiBhbnkgPSB1bmRlZmluZWQ7XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBpdGVtcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGVsZW1lbnQgPSBpdGVtc1tpXTtcbiAgICBpZiAobWluID09IG51bGwgfHwgZWxlbWVudCA8IG1pbikge1xuICAgICAgbWluID0gZWxlbWVudDtcbiAgICAgIG1pbkVsZW1lbnQgPSBlbGVtZW50O1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBtaW5FbGVtZW50O1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7O0NBYUMsR0FtQkQ7Ozs7OztDQU1DLEdBQ0QsT0FBTyxTQUFTLElBQU8sUUFBc0IsRUFBRTtFQUM3QyxJQUFJLGFBQWEsS0FBSyxDQUFDLEVBQUU7RUFDekIsSUFBSSxPQUFXO0VBRWYsSUFBSyxJQUFJLElBQUksR0FBRyxJQUFJLE1BQU0sTUFBTSxFQUFFLElBQUs7SUFDckMsTUFBTSxVQUFVLEtBQUssQ0FBQyxFQUFFO0lBQ3hCLElBQUksUUFBTyxRQUFRLFVBQVUsTUFBSztNQUNoQyxPQUFNO01BQ04sYUFBYTtJQUNmO0VBQ0Y7RUFFQSxPQUFPO0FBQ1QifQ==
// denoCacheMetadata=4521819976390849065,5745099832490796606