import { head as headToolkit } from '../../array/head.ts';
import { toArray } from '../_internal/toArray.ts';
import { isArrayLike } from '../predicate/isArrayLike.ts';
/**
 * Returns the first element of an array or `undefined` if the array is empty.
 *
 * This function takes an array and returns the first element of the array.
 * If the array is empty, the function returns `undefined`.
 *
 * @template T - The type of elements in the array.
 * @param {ArrayLike<T> | undefined | null} arr - The array from which to get the first element.
 * @returns {T | undefined} The first element of the array, or `undefined` if the array is empty.
 *
 * @example
 * const emptyArr: number[] = [];
 * const noElement = head(emptyArr);
 * // noElement will be undefined
 */ export function head(arr) {
  if (!isArrayLike(arr)) {
    return undefined;
  }
  return headToolkit(toArray(arr));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvYXJyYXkvaGVhZC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBoZWFkIGFzIGhlYWRUb29sa2l0IH0gZnJvbSAnLi4vLi4vYXJyYXkvaGVhZC50cyc7XG5pbXBvcnQgeyB0b0FycmF5IH0gZnJvbSAnLi4vX2ludGVybmFsL3RvQXJyYXkudHMnO1xuaW1wb3J0IHsgaXNBcnJheUxpa2UgfSBmcm9tICcuLi9wcmVkaWNhdGUvaXNBcnJheUxpa2UudHMnO1xuXG4vKipcbiAqIFJldHVybnMgdGhlIGZpcnN0IGVsZW1lbnQgb2YgYW4gYXJyYXkgb3IgYHVuZGVmaW5lZGAgaWYgdGhlIGFycmF5IGlzIGVtcHR5LlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gdGFrZXMgYW4gYXJyYXkgYW5kIHJldHVybnMgdGhlIGZpcnN0IGVsZW1lbnQgb2YgdGhlIGFycmF5LlxuICogSWYgdGhlIGFycmF5IGlzIGVtcHR5LCB0aGUgZnVuY3Rpb24gcmV0dXJucyBgdW5kZWZpbmVkYC5cbiAqXG4gKiBAdGVtcGxhdGUgVCAtIFRoZSB0eXBlIG9mIGVsZW1lbnRzIGluIHRoZSBhcnJheS5cbiAqIEBwYXJhbSB7QXJyYXlMaWtlPFQ+IHwgdW5kZWZpbmVkIHwgbnVsbH0gYXJyIC0gVGhlIGFycmF5IGZyb20gd2hpY2ggdG8gZ2V0IHRoZSBmaXJzdCBlbGVtZW50LlxuICogQHJldHVybnMge1QgfCB1bmRlZmluZWR9IFRoZSBmaXJzdCBlbGVtZW50IG9mIHRoZSBhcnJheSwgb3IgYHVuZGVmaW5lZGAgaWYgdGhlIGFycmF5IGlzIGVtcHR5LlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCBlbXB0eUFycjogbnVtYmVyW10gPSBbXTtcbiAqIGNvbnN0IG5vRWxlbWVudCA9IGhlYWQoZW1wdHlBcnIpO1xuICogLy8gbm9FbGVtZW50IHdpbGwgYmUgdW5kZWZpbmVkXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBoZWFkPFQ+KGFycjogQXJyYXlMaWtlPFQ+IHwgdW5kZWZpbmVkIHwgbnVsbCk6IFQgfCB1bmRlZmluZWQge1xuICBpZiAoIWlzQXJyYXlMaWtlKGFycikpIHtcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9XG4gIHJldHVybiBoZWFkVG9vbGtpdCh0b0FycmF5KGFycikpO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsUUFBUSxXQUFXLFFBQVEsc0JBQXNCO0FBQzFELFNBQVMsT0FBTyxRQUFRLDBCQUEwQjtBQUNsRCxTQUFTLFdBQVcsUUFBUSw4QkFBOEI7QUFFMUQ7Ozs7Ozs7Ozs7Ozs7O0NBY0MsR0FDRCxPQUFPLFNBQVMsS0FBUSxHQUFvQztFQUMxRCxJQUFJLENBQUMsWUFBWSxNQUFNO0lBQ3JCLE9BQU87RUFDVDtFQUNBLE9BQU8sWUFBWSxRQUFRO0FBQzdCIn0=
// denoCacheMetadata=8963284013524483942,14579962240293078788