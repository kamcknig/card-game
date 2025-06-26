/**
 * Splits an array into two groups based on a predicate function.
 *
 * This function takes an array and a predicate function. It returns a tuple of two arrays:
 * the first array contains elements for which the predicate function returns true, and
 * the second array contains elements for which the predicate function returns false.
 *
 * @template T - The type of elements in the array.
 * @param {T[]} arr - The array to partition.
 * @param {(value: T) => boolean} isInTruthy - A predicate function that determines
 * whether an element should be placed in the truthy array. The function is called with each
 * element of the array.
 * @returns {[T[], T[]]} A tuple containing two arrays: the first array contains elements for
 * which the predicate returned true, and the second array contains elements for which the
 * predicate returned false.
 *
 * @example
 * const array = [1, 2, 3, 4, 5];
 * const isEven = x => x % 2 === 0;
 * const [even, odd] = partition(array, isEven);
 * // even will be [2, 4], and odd will be [1, 3, 5]
 */ export function partition(arr, isInTruthy) {
  const truthy = [];
  const falsy = [];
  for(let i = 0; i < arr.length; i++){
    const item = arr[i];
    if (isInTruthy(item)) {
      truthy.push(item);
    } else {
      falsy.push(item);
    }
  }
  return [
    truthy,
    falsy
  ];
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9hcnJheS9wYXJ0aXRpb24udHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBTcGxpdHMgYW4gYXJyYXkgaW50byB0d28gZ3JvdXBzIGJhc2VkIG9uIGEgcHJlZGljYXRlIGZ1bmN0aW9uLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gdGFrZXMgYW4gYXJyYXkgYW5kIGEgcHJlZGljYXRlIGZ1bmN0aW9uLiBJdCByZXR1cm5zIGEgdHVwbGUgb2YgdHdvIGFycmF5czpcbiAqIHRoZSBmaXJzdCBhcnJheSBjb250YWlucyBlbGVtZW50cyBmb3Igd2hpY2ggdGhlIHByZWRpY2F0ZSBmdW5jdGlvbiByZXR1cm5zIHRydWUsIGFuZFxuICogdGhlIHNlY29uZCBhcnJheSBjb250YWlucyBlbGVtZW50cyBmb3Igd2hpY2ggdGhlIHByZWRpY2F0ZSBmdW5jdGlvbiByZXR1cm5zIGZhbHNlLlxuICpcbiAqIEB0ZW1wbGF0ZSBUIC0gVGhlIHR5cGUgb2YgZWxlbWVudHMgaW4gdGhlIGFycmF5LlxuICogQHBhcmFtIHtUW119IGFyciAtIFRoZSBhcnJheSB0byBwYXJ0aXRpb24uXG4gKiBAcGFyYW0geyh2YWx1ZTogVCkgPT4gYm9vbGVhbn0gaXNJblRydXRoeSAtIEEgcHJlZGljYXRlIGZ1bmN0aW9uIHRoYXQgZGV0ZXJtaW5lc1xuICogd2hldGhlciBhbiBlbGVtZW50IHNob3VsZCBiZSBwbGFjZWQgaW4gdGhlIHRydXRoeSBhcnJheS4gVGhlIGZ1bmN0aW9uIGlzIGNhbGxlZCB3aXRoIGVhY2hcbiAqIGVsZW1lbnQgb2YgdGhlIGFycmF5LlxuICogQHJldHVybnMge1tUW10sIFRbXV19IEEgdHVwbGUgY29udGFpbmluZyB0d28gYXJyYXlzOiB0aGUgZmlyc3QgYXJyYXkgY29udGFpbnMgZWxlbWVudHMgZm9yXG4gKiB3aGljaCB0aGUgcHJlZGljYXRlIHJldHVybmVkIHRydWUsIGFuZCB0aGUgc2Vjb25kIGFycmF5IGNvbnRhaW5zIGVsZW1lbnRzIGZvciB3aGljaCB0aGVcbiAqIHByZWRpY2F0ZSByZXR1cm5lZCBmYWxzZS5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgYXJyYXkgPSBbMSwgMiwgMywgNCwgNV07XG4gKiBjb25zdCBpc0V2ZW4gPSB4ID0+IHggJSAyID09PSAwO1xuICogY29uc3QgW2V2ZW4sIG9kZF0gPSBwYXJ0aXRpb24oYXJyYXksIGlzRXZlbik7XG4gKiAvLyBldmVuIHdpbGwgYmUgWzIsIDRdLCBhbmQgb2RkIHdpbGwgYmUgWzEsIDMsIDVdXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXJ0aXRpb248VD4oYXJyOiByZWFkb25seSBUW10sIGlzSW5UcnV0aHk6ICh2YWx1ZTogVCkgPT4gYm9vbGVhbik6IFt0cnV0aHk6IFRbXSwgZmFsc3k6IFRbXV0ge1xuICBjb25zdCB0cnV0aHk6IFRbXSA9IFtdO1xuICBjb25zdCBmYWxzeTogVFtdID0gW107XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBhcnIubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBpdGVtID0gYXJyW2ldO1xuICAgIGlmIChpc0luVHJ1dGh5KGl0ZW0pKSB7XG4gICAgICB0cnV0aHkucHVzaChpdGVtKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZmFsc3kucHVzaChpdGVtKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gW3RydXRoeSwgZmFsc3ldO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FxQkMsR0FDRCxPQUFPLFNBQVMsVUFBYSxHQUFpQixFQUFFLFVBQWlDO0VBQy9FLE1BQU0sU0FBYyxFQUFFO0VBQ3RCLE1BQU0sUUFBYSxFQUFFO0VBRXJCLElBQUssSUFBSSxJQUFJLEdBQUcsSUFBSSxJQUFJLE1BQU0sRUFBRSxJQUFLO0lBQ25DLE1BQU0sT0FBTyxHQUFHLENBQUMsRUFBRTtJQUNuQixJQUFJLFdBQVcsT0FBTztNQUNwQixPQUFPLElBQUksQ0FBQztJQUNkLE9BQU87TUFDTCxNQUFNLElBQUksQ0FBQztJQUNiO0VBQ0Y7RUFFQSxPQUFPO0lBQUM7SUFBUTtHQUFNO0FBQ3hCIn0=
// denoCacheMetadata=1962350859851002806,2272178310188273393