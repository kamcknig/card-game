import { last as lastToolkit } from '../../array/last.ts';
import { toArray } from '../_internal/toArray.ts';
import { isArrayLike } from '../predicate/isArrayLike.ts';
/**
 * Returns the last element of an array.
 *
 * This function takes an array and returns the last element of the array.
 * If the array is empty, the function returns `undefined`.
 *
 * Unlike some implementations, this function is optimized for performance
 * by directly accessing the last index of the array.
 *
 * @template T - The type of elements in the array.
 * @param {ArrayLike<T> | null | undefined} arr - The array from which to get the last element.
 * @returns {T | undefined} The last element of the array, or `undefined` if the array is empty.
 *
 * @example
 * const arr = [1, 2, 3];
 * const lastElement = last(arr);
 * // lastElement will be 3
 *
 * const emptyArr: number[] = [];
 * const noElement = last(emptyArr);
 * // noElement will be undefined
 */ export function last(array) {
  if (!isArrayLike(array)) {
    return undefined;
  }
  return lastToolkit(toArray(array));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvYXJyYXkvbGFzdC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBsYXN0IGFzIGxhc3RUb29sa2l0IH0gZnJvbSAnLi4vLi4vYXJyYXkvbGFzdC50cyc7XG5pbXBvcnQgeyB0b0FycmF5IH0gZnJvbSAnLi4vX2ludGVybmFsL3RvQXJyYXkudHMnO1xuaW1wb3J0IHsgaXNBcnJheUxpa2UgfSBmcm9tICcuLi9wcmVkaWNhdGUvaXNBcnJheUxpa2UudHMnO1xuXG4vKipcbiAqIFJldHVybnMgdGhlIGxhc3QgZWxlbWVudCBvZiBhbiBhcnJheS5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIHRha2VzIGFuIGFycmF5IGFuZCByZXR1cm5zIHRoZSBsYXN0IGVsZW1lbnQgb2YgdGhlIGFycmF5LlxuICogSWYgdGhlIGFycmF5IGlzIGVtcHR5LCB0aGUgZnVuY3Rpb24gcmV0dXJucyBgdW5kZWZpbmVkYC5cbiAqXG4gKiBVbmxpa2Ugc29tZSBpbXBsZW1lbnRhdGlvbnMsIHRoaXMgZnVuY3Rpb24gaXMgb3B0aW1pemVkIGZvciBwZXJmb3JtYW5jZVxuICogYnkgZGlyZWN0bHkgYWNjZXNzaW5nIHRoZSBsYXN0IGluZGV4IG9mIHRoZSBhcnJheS5cbiAqXG4gKiBAdGVtcGxhdGUgVCAtIFRoZSB0eXBlIG9mIGVsZW1lbnRzIGluIHRoZSBhcnJheS5cbiAqIEBwYXJhbSB7QXJyYXlMaWtlPFQ+IHwgbnVsbCB8IHVuZGVmaW5lZH0gYXJyIC0gVGhlIGFycmF5IGZyb20gd2hpY2ggdG8gZ2V0IHRoZSBsYXN0IGVsZW1lbnQuXG4gKiBAcmV0dXJucyB7VCB8IHVuZGVmaW5lZH0gVGhlIGxhc3QgZWxlbWVudCBvZiB0aGUgYXJyYXksIG9yIGB1bmRlZmluZWRgIGlmIHRoZSBhcnJheSBpcyBlbXB0eS5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgYXJyID0gWzEsIDIsIDNdO1xuICogY29uc3QgbGFzdEVsZW1lbnQgPSBsYXN0KGFycik7XG4gKiAvLyBsYXN0RWxlbWVudCB3aWxsIGJlIDNcbiAqXG4gKiBjb25zdCBlbXB0eUFycjogbnVtYmVyW10gPSBbXTtcbiAqIGNvbnN0IG5vRWxlbWVudCA9IGxhc3QoZW1wdHlBcnIpO1xuICogLy8gbm9FbGVtZW50IHdpbGwgYmUgdW5kZWZpbmVkXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBsYXN0PFQ+KGFycmF5OiBBcnJheUxpa2U8VD4gfCBudWxsIHwgdW5kZWZpbmVkKTogVCB8IHVuZGVmaW5lZCB7XG4gIGlmICghaXNBcnJheUxpa2UoYXJyYXkpKSB7XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxuICByZXR1cm4gbGFzdFRvb2xraXQodG9BcnJheShhcnJheSkpO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsUUFBUSxXQUFXLFFBQVEsc0JBQXNCO0FBQzFELFNBQVMsT0FBTyxRQUFRLDBCQUEwQjtBQUNsRCxTQUFTLFdBQVcsUUFBUSw4QkFBOEI7QUFFMUQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQXFCQyxHQUNELE9BQU8sU0FBUyxLQUFRLEtBQXNDO0VBQzVELElBQUksQ0FBQyxZQUFZLFFBQVE7SUFDdkIsT0FBTztFQUNUO0VBQ0EsT0FBTyxZQUFZLFFBQVE7QUFDN0IifQ==
// denoCacheMetadata=18095410572314860670,17661553156988098939