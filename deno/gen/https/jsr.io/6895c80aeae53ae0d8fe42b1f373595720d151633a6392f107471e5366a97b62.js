import { compact as compactToolkit } from '../../array/compact.ts';
import { isArrayLike } from '../predicate/isArrayLike.ts';
/**
 * Removes falsey values (false, null, 0, 0n, '', undefined, NaN) from an array.
 *
 * @template T - The type of elements in the array.
 * @param {ArrayLike<T | Falsey> | null | undefined} arr - The input array to remove falsey values.
 * @returns {Array<Exclude<T, false | null | 0 | 0n | '' | undefined>>} - A new array with all falsey values removed.
 *
 * @example
 * compact([0, 0n, 1, false, 2, '', 3, null, undefined, 4, NaN, 5]);
 * Returns: [1, 2, 3, 4, 5]
 */ export function compact(arr) {
  if (!isArrayLike(arr)) {
    return [];
  }
  return compactToolkit(Array.from(arr));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvYXJyYXkvY29tcGFjdC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBjb21wYWN0IGFzIGNvbXBhY3RUb29sa2l0IH0gZnJvbSAnLi4vLi4vYXJyYXkvY29tcGFjdC50cyc7XG5pbXBvcnQgeyBpc0FycmF5TGlrZSB9IGZyb20gJy4uL3ByZWRpY2F0ZS9pc0FycmF5TGlrZS50cyc7XG5cbnR5cGUgRmFsc2V5ID0gZmFsc2UgfCBudWxsIHwgMCB8IDBuIHwgJycgfCB1bmRlZmluZWQ7XG50eXBlIE5vdEZhbHNleTxUPiA9IEV4Y2x1ZGU8VCwgRmFsc2V5PjtcblxuLyoqXG4gKiBSZW1vdmVzIGZhbHNleSB2YWx1ZXMgKGZhbHNlLCBudWxsLCAwLCAwbiwgJycsIHVuZGVmaW5lZCwgTmFOKSBmcm9tIGFuIGFycmF5LlxuICpcbiAqIEB0ZW1wbGF0ZSBUIC0gVGhlIHR5cGUgb2YgZWxlbWVudHMgaW4gdGhlIGFycmF5LlxuICogQHBhcmFtIHtBcnJheUxpa2U8VCB8IEZhbHNleT4gfCBudWxsIHwgdW5kZWZpbmVkfSBhcnIgLSBUaGUgaW5wdXQgYXJyYXkgdG8gcmVtb3ZlIGZhbHNleSB2YWx1ZXMuXG4gKiBAcmV0dXJucyB7QXJyYXk8RXhjbHVkZTxULCBmYWxzZSB8IG51bGwgfCAwIHwgMG4gfCAnJyB8IHVuZGVmaW5lZD4+fSAtIEEgbmV3IGFycmF5IHdpdGggYWxsIGZhbHNleSB2YWx1ZXMgcmVtb3ZlZC5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29tcGFjdChbMCwgMG4sIDEsIGZhbHNlLCAyLCAnJywgMywgbnVsbCwgdW5kZWZpbmVkLCA0LCBOYU4sIDVdKTtcbiAqIFJldHVybnM6IFsxLCAyLCAzLCA0LCA1XVxuICovXG5leHBvcnQgZnVuY3Rpb24gY29tcGFjdDxUPihhcnI6IEFycmF5TGlrZTxUIHwgRmFsc2V5PiB8IG51bGwgfCB1bmRlZmluZWQpOiBBcnJheTxOb3RGYWxzZXk8VD4+IHtcbiAgaWYgKCFpc0FycmF5TGlrZShhcnIpKSB7XG4gICAgcmV0dXJuIFtdO1xuICB9XG5cbiAgcmV0dXJuIGNvbXBhY3RUb29sa2l0KEFycmF5LmZyb20oYXJyKSk7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxXQUFXLGNBQWMsUUFBUSx5QkFBeUI7QUFDbkUsU0FBUyxXQUFXLFFBQVEsOEJBQThCO0FBSzFEOzs7Ozs7Ozs7O0NBVUMsR0FDRCxPQUFPLFNBQVMsUUFBVyxHQUE2QztFQUN0RSxJQUFJLENBQUMsWUFBWSxNQUFNO0lBQ3JCLE9BQU8sRUFBRTtFQUNYO0VBRUEsT0FBTyxlQUFlLE1BQU0sSUFBSSxDQUFDO0FBQ25DIn0=
// denoCacheMetadata=2380301192698840505,9448589255873810456