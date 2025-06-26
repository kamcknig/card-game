/**
 * Finds the element in an array that has the maximum value.
 *
 * @param {[T, ...T[]]} items - The array of elements to search.
 * @returns {T | undefined} - The element with the maximum value, or undefined if the array is empty.
 * @example
 * // Returns 9
 * max([3, 1, 4, 1, 5, 9]);
 *
 * @example
 * // Returns 8
 * max([0, -3, 2, 8, 7]);
 */ /**
 * Finds the element in an array that has the maximum value.
 *
 * @template T - The type of elements in the array.
 * @param {T[]} [items] - The array of elements to search. Defaults to an empty array.
 * @returns {T | undefined} - The element with the maximum value, or undefined if the array is empty.
 */ export function max(items = []) {
  let maxElement = items[0];
  let max1 = undefined;
  for(let i = 0; i < items.length; i++){
    const element = items[i];
    if (max1 == null || element > max1) {
      max1 = element;
      maxElement = element;
    }
  }
  return maxElement;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvbWF0aC9tYXgudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBGaW5kcyB0aGUgZWxlbWVudCBpbiBhbiBhcnJheSB0aGF0IGhhcyB0aGUgbWF4aW11bSB2YWx1ZS5cbiAqXG4gKiBAcGFyYW0ge1tULCAuLi5UW11dfSBpdGVtcyAtIFRoZSBhcnJheSBvZiBlbGVtZW50cyB0byBzZWFyY2guXG4gKiBAcmV0dXJucyB7VCB8IHVuZGVmaW5lZH0gLSBUaGUgZWxlbWVudCB3aXRoIHRoZSBtYXhpbXVtIHZhbHVlLCBvciB1bmRlZmluZWQgaWYgdGhlIGFycmF5IGlzIGVtcHR5LlxuICogQGV4YW1wbGVcbiAqIC8vIFJldHVybnMgOVxuICogbWF4KFszLCAxLCA0LCAxLCA1LCA5XSk7XG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIFJldHVybnMgOFxuICogbWF4KFswLCAtMywgMiwgOCwgN10pO1xuICovXG5leHBvcnQgZnVuY3Rpb24gbWF4PFQ+KGl0ZW1zOiByZWFkb25seSBbVCwgLi4uVFtdXSk6IFQ7XG4vKipcbiAqIEZpbmRzIHRoZSBlbGVtZW50IGluIGFuIGFycmF5IHRoYXQgaGFzIHRoZSBtYXhpbXVtIHZhbHVlLlxuICogUmV0dXJucyB1bmRlZmluZWQgd2hlbiBubyBhcmd1bWVudHMgYXJlIHByb3ZpZGVkLlxuICogQHJldHVybnMge3VuZGVmaW5lZH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1heCgpOiB1bmRlZmluZWQ7XG4vKipcbiAqIEZpbmRzIHRoZSBlbGVtZW50IGluIGFuIGFycmF5IHRoYXQgaGFzIHRoZSBtYXhpbXVtIHZhbHVlLlxuICpcbiAqIEB0ZW1wbGF0ZSBUIC0gVGhlIHR5cGUgb2YgZWxlbWVudHMgaW4gdGhlIGFycmF5LlxuICogQHBhcmFtIHtUW119IFtpdGVtc10gLSBUaGUgYXJyYXkgb2YgZWxlbWVudHMgdG8gc2VhcmNoLiBEZWZhdWx0cyB0byBhbiBlbXB0eSBhcnJheS5cbiAqIEByZXR1cm5zIHtUIHwgdW5kZWZpbmVkfSAtIFRoZSBlbGVtZW50IHdpdGggdGhlIG1heGltdW0gdmFsdWUsIG9yIHVuZGVmaW5lZCBpZiB0aGUgYXJyYXkgaXMgZW1wdHkuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBtYXg8VD4oaXRlbXM/OiByZWFkb25seSBUW10pOiBUIHwgdW5kZWZpbmVkO1xuLyoqXG4gKiBGaW5kcyB0aGUgZWxlbWVudCBpbiBhbiBhcnJheSB0aGF0IGhhcyB0aGUgbWF4aW11bSB2YWx1ZS5cbiAqXG4gKiBAdGVtcGxhdGUgVCAtIFRoZSB0eXBlIG9mIGVsZW1lbnRzIGluIHRoZSBhcnJheS5cbiAqIEBwYXJhbSB7VFtdfSBbaXRlbXNdIC0gVGhlIGFycmF5IG9mIGVsZW1lbnRzIHRvIHNlYXJjaC4gRGVmYXVsdHMgdG8gYW4gZW1wdHkgYXJyYXkuXG4gKiBAcmV0dXJucyB7VCB8IHVuZGVmaW5lZH0gLSBUaGUgZWxlbWVudCB3aXRoIHRoZSBtYXhpbXVtIHZhbHVlLCBvciB1bmRlZmluZWQgaWYgdGhlIGFycmF5IGlzIGVtcHR5LlxuICovXG5leHBvcnQgZnVuY3Rpb24gbWF4PFQ+KGl0ZW1zOiByZWFkb25seSBUW10gPSBbXSk6IFQgfCB1bmRlZmluZWQge1xuICBsZXQgbWF4RWxlbWVudCA9IGl0ZW1zWzBdO1xuICBsZXQgbWF4OiBhbnkgPSB1bmRlZmluZWQ7XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBpdGVtcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGVsZW1lbnQgPSBpdGVtc1tpXTtcbiAgICBpZiAobWF4ID09IG51bGwgfHwgZWxlbWVudCA+IG1heCkge1xuICAgICAgbWF4ID0gZWxlbWVudDtcbiAgICAgIG1heEVsZW1lbnQgPSBlbGVtZW50O1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBtYXhFbGVtZW50O1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7Q0FZQyxHQWdCRDs7Ozs7O0NBTUMsR0FDRCxPQUFPLFNBQVMsSUFBTyxRQUFzQixFQUFFO0VBQzdDLElBQUksYUFBYSxLQUFLLENBQUMsRUFBRTtFQUN6QixJQUFJLE9BQVc7RUFFZixJQUFLLElBQUksSUFBSSxHQUFHLElBQUksTUFBTSxNQUFNLEVBQUUsSUFBSztJQUNyQyxNQUFNLFVBQVUsS0FBSyxDQUFDLEVBQUU7SUFDeEIsSUFBSSxRQUFPLFFBQVEsVUFBVSxNQUFLO01BQ2hDLE9BQU07TUFDTixhQUFhO0lBQ2Y7RUFDRjtFQUVBLE9BQU87QUFDVCJ9
// denoCacheMetadata=15979679367825855202,16202516116959359884