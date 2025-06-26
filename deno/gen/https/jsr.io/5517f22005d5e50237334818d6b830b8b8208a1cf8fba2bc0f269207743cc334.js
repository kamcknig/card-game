/**
 * Removes falsey values (false, null, 0, 0n, '', undefined, NaN) from an array.
 *
 * @template T - The type of elements in the array.
 * @param {T[]} arr - The input array to remove falsey values.
 * @returns {Array<Exclude<T, false | null | 0 | 0n | '' | undefined>>} - A new array with all falsey values removed.
 *
 * @example
 * compact([0, 0n, 1, false, 2, '', 3, null, undefined, 4, NaN, 5]);
 * Returns: [1, 2, 3, 4, 5]
 */ export function compact(arr) {
  const result = [];
  for(let i = 0; i < arr.length; i++){
    const item = arr[i];
    if (item) {
      result.push(item);
    }
  }
  return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9hcnJheS9jb21wYWN0LnRzIl0sInNvdXJjZXNDb250ZW50IjpbInR5cGUgTm90RmFsc2V5PFQ+ID0gRXhjbHVkZTxULCBmYWxzZSB8IG51bGwgfCAwIHwgMG4gfCAnJyB8IHVuZGVmaW5lZD47XG5cbi8qKlxuICogUmVtb3ZlcyBmYWxzZXkgdmFsdWVzIChmYWxzZSwgbnVsbCwgMCwgMG4sICcnLCB1bmRlZmluZWQsIE5hTikgZnJvbSBhbiBhcnJheS5cbiAqXG4gKiBAdGVtcGxhdGUgVCAtIFRoZSB0eXBlIG9mIGVsZW1lbnRzIGluIHRoZSBhcnJheS5cbiAqIEBwYXJhbSB7VFtdfSBhcnIgLSBUaGUgaW5wdXQgYXJyYXkgdG8gcmVtb3ZlIGZhbHNleSB2YWx1ZXMuXG4gKiBAcmV0dXJucyB7QXJyYXk8RXhjbHVkZTxULCBmYWxzZSB8IG51bGwgfCAwIHwgMG4gfCAnJyB8IHVuZGVmaW5lZD4+fSAtIEEgbmV3IGFycmF5IHdpdGggYWxsIGZhbHNleSB2YWx1ZXMgcmVtb3ZlZC5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29tcGFjdChbMCwgMG4sIDEsIGZhbHNlLCAyLCAnJywgMywgbnVsbCwgdW5kZWZpbmVkLCA0LCBOYU4sIDVdKTtcbiAqIFJldHVybnM6IFsxLCAyLCAzLCA0LCA1XVxuICovXG5leHBvcnQgZnVuY3Rpb24gY29tcGFjdDxUPihhcnI6IHJlYWRvbmx5IFRbXSk6IEFycmF5PE5vdEZhbHNleTxUPj4ge1xuICBjb25zdCByZXN1bHQ6IEFycmF5PE5vdEZhbHNleTxUPj4gPSBbXTtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IGFyci5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGl0ZW0gPSBhcnJbaV07XG4gICAgaWYgKGl0ZW0pIHtcbiAgICAgIHJlc3VsdC5wdXNoKGl0ZW0gYXMgTm90RmFsc2V5PFQ+KTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmVzdWx0O1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUVBOzs7Ozs7Ozs7O0NBVUMsR0FDRCxPQUFPLFNBQVMsUUFBVyxHQUFpQjtFQUMxQyxNQUFNLFNBQThCLEVBQUU7RUFFdEMsSUFBSyxJQUFJLElBQUksR0FBRyxJQUFJLElBQUksTUFBTSxFQUFFLElBQUs7SUFDbkMsTUFBTSxPQUFPLEdBQUcsQ0FBQyxFQUFFO0lBQ25CLElBQUksTUFBTTtNQUNSLE9BQU8sSUFBSSxDQUFDO0lBQ2Q7RUFDRjtFQUVBLE9BQU87QUFDVCJ9
// denoCacheMetadata=2747053346832731654,4248621415667541689