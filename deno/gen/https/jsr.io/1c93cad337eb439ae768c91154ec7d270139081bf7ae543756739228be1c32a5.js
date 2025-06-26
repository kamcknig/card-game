import { isArrayLike } from '../predicate/isArrayLike.ts';
/**
 * Finds the index of the last occurrence of a value in an array.
 *
 * This method is similar to `Array.prototype.lastIndexOf`, but it also finds `NaN` values.
 * It uses strict equality (`===`) to compare elements.
 *
 * @template T - The type of elements in the array.
 * @param {ArrayLike<T> | null | undefined} array - The array to search.
 * @param {T} searchElement - The value to search for.
 * @param {number} [fromIndex] - The index to start the search at.
 * @returns {number} The index (zero-based) of the last occurrence of the value in the array, or `-1` if the value is not found.
 *
 * @example
 * const array = [1, 2, 3, NaN, 1];
 * lastIndexOf(array, 3); // => 4
 * lastIndexOf(array, NaN); // => 3
 */ export function lastIndexOf(array, searchElement, fromIndex) {
  if (!isArrayLike(array) || array.length === 0) {
    return -1;
  }
  const length = array.length;
  let index = fromIndex ?? length - 1;
  if (fromIndex != null) {
    index = index < 0 ? Math.max(length + index, 0) : Math.min(index, length - 1);
  }
  // `Array.prototype.lastIndexOf` doesn't find `NaN` values, so we need to handle that case separately.
  if (Number.isNaN(searchElement)) {
    for(let i = index; i >= 0; i--){
      if (Number.isNaN(array[i])) {
        return i;
      }
    }
  }
  return Array.from(array).lastIndexOf(searchElement, index);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvYXJyYXkvbGFzdEluZGV4T2YudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgaXNBcnJheUxpa2UgfSBmcm9tICcuLi9wcmVkaWNhdGUvaXNBcnJheUxpa2UudHMnO1xuXG4vKipcbiAqIEZpbmRzIHRoZSBpbmRleCBvZiB0aGUgbGFzdCBvY2N1cnJlbmNlIG9mIGEgdmFsdWUgaW4gYW4gYXJyYXkuXG4gKlxuICogVGhpcyBtZXRob2QgaXMgc2ltaWxhciB0byBgQXJyYXkucHJvdG90eXBlLmxhc3RJbmRleE9mYCwgYnV0IGl0IGFsc28gZmluZHMgYE5hTmAgdmFsdWVzLlxuICogSXQgdXNlcyBzdHJpY3QgZXF1YWxpdHkgKGA9PT1gKSB0byBjb21wYXJlIGVsZW1lbnRzLlxuICpcbiAqIEB0ZW1wbGF0ZSBUIC0gVGhlIHR5cGUgb2YgZWxlbWVudHMgaW4gdGhlIGFycmF5LlxuICogQHBhcmFtIHtBcnJheUxpa2U8VD4gfCBudWxsIHwgdW5kZWZpbmVkfSBhcnJheSAtIFRoZSBhcnJheSB0byBzZWFyY2guXG4gKiBAcGFyYW0ge1R9IHNlYXJjaEVsZW1lbnQgLSBUaGUgdmFsdWUgdG8gc2VhcmNoIGZvci5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbZnJvbUluZGV4XSAtIFRoZSBpbmRleCB0byBzdGFydCB0aGUgc2VhcmNoIGF0LlxuICogQHJldHVybnMge251bWJlcn0gVGhlIGluZGV4ICh6ZXJvLWJhc2VkKSBvZiB0aGUgbGFzdCBvY2N1cnJlbmNlIG9mIHRoZSB2YWx1ZSBpbiB0aGUgYXJyYXksIG9yIGAtMWAgaWYgdGhlIHZhbHVlIGlzIG5vdCBmb3VuZC5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgYXJyYXkgPSBbMSwgMiwgMywgTmFOLCAxXTtcbiAqIGxhc3RJbmRleE9mKGFycmF5LCAzKTsgLy8gPT4gNFxuICogbGFzdEluZGV4T2YoYXJyYXksIE5hTik7IC8vID0+IDNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGxhc3RJbmRleE9mPFQ+KGFycmF5OiBBcnJheUxpa2U8VD4gfCBudWxsIHwgdW5kZWZpbmVkLCBzZWFyY2hFbGVtZW50OiBULCBmcm9tSW5kZXg/OiBudW1iZXIpOiBudW1iZXIge1xuICBpZiAoIWlzQXJyYXlMaWtlKGFycmF5KSB8fCBhcnJheS5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gLTE7XG4gIH1cblxuICBjb25zdCBsZW5ndGggPSBhcnJheS5sZW5ndGg7XG5cbiAgbGV0IGluZGV4ID0gZnJvbUluZGV4ID8/IGxlbmd0aCAtIDE7XG4gIGlmIChmcm9tSW5kZXggIT0gbnVsbCkge1xuICAgIGluZGV4ID0gaW5kZXggPCAwID8gTWF0aC5tYXgobGVuZ3RoICsgaW5kZXgsIDApIDogTWF0aC5taW4oaW5kZXgsIGxlbmd0aCAtIDEpO1xuICB9XG5cbiAgLy8gYEFycmF5LnByb3RvdHlwZS5sYXN0SW5kZXhPZmAgZG9lc24ndCBmaW5kIGBOYU5gIHZhbHVlcywgc28gd2UgbmVlZCB0byBoYW5kbGUgdGhhdCBjYXNlIHNlcGFyYXRlbHkuXG4gIGlmIChOdW1iZXIuaXNOYU4oc2VhcmNoRWxlbWVudCkpIHtcbiAgICBmb3IgKGxldCBpID0gaW5kZXg7IGkgPj0gMDsgaS0tKSB7XG4gICAgICBpZiAoTnVtYmVyLmlzTmFOKGFycmF5W2ldKSkge1xuICAgICAgICByZXR1cm4gaTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gQXJyYXkuZnJvbShhcnJheSkubGFzdEluZGV4T2Yoc2VhcmNoRWxlbWVudCwgaW5kZXgpO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsV0FBVyxRQUFRLDhCQUE4QjtBQUUxRDs7Ozs7Ozs7Ozs7Ozs7OztDQWdCQyxHQUNELE9BQU8sU0FBUyxZQUFlLEtBQXNDLEVBQUUsYUFBZ0IsRUFBRSxTQUFrQjtFQUN6RyxJQUFJLENBQUMsWUFBWSxVQUFVLE1BQU0sTUFBTSxLQUFLLEdBQUc7SUFDN0MsT0FBTyxDQUFDO0VBQ1Y7RUFFQSxNQUFNLFNBQVMsTUFBTSxNQUFNO0VBRTNCLElBQUksUUFBUSxhQUFhLFNBQVM7RUFDbEMsSUFBSSxhQUFhLE1BQU07SUFDckIsUUFBUSxRQUFRLElBQUksS0FBSyxHQUFHLENBQUMsU0FBUyxPQUFPLEtBQUssS0FBSyxHQUFHLENBQUMsT0FBTyxTQUFTO0VBQzdFO0VBRUEsc0dBQXNHO0VBQ3RHLElBQUksT0FBTyxLQUFLLENBQUMsZ0JBQWdCO0lBQy9CLElBQUssSUFBSSxJQUFJLE9BQU8sS0FBSyxHQUFHLElBQUs7TUFDL0IsSUFBSSxPQUFPLEtBQUssQ0FBQyxLQUFLLENBQUMsRUFBRSxHQUFHO1FBQzFCLE9BQU87TUFDVDtJQUNGO0VBQ0Y7RUFFQSxPQUFPLE1BQU0sSUFBSSxDQUFDLE9BQU8sV0FBVyxDQUFDLGVBQWU7QUFDdEQifQ==
// denoCacheMetadata=7267170256412265980,12705988019939232895