import { intersection as intersectionToolkit } from '../../array/intersection.ts';
import { uniq } from '../../array/uniq.ts';
import { isArrayLikeObject } from '../predicate/isArrayLikeObject.ts';
/**
 * Returns the intersection of multiple arrays.
 *
 * This function takes multiple arrays and returns a new array containing the elements that are
 * present in all provided arrays. It effectively filters out any elements that are not found
 * in every array.
 *
 * @template T - The type of elements in the arrays.
 * @param {...(ArrayLike<T> | null | undefined)} arrays - The arrays to compare.
 * @returns {T[]} A new array containing the elements that are present in all arrays.
 *
 * @example
 * const array1 = [1, 2, 3, 4, 5];
 * const array2 = [3, 4, 5, 6, 7];
 * const result = intersection(array1, array2);
 * // result will be [3, 4, 5] since these elements are in both arrays.
 */ export function intersection(...arrays) {
  if (arrays.length === 0) {
    return [];
  }
  if (!isArrayLikeObject(arrays[0])) {
    return [];
  }
  let result = uniq(Array.from(arrays[0]));
  for(let i = 1; i < arrays.length; i++){
    const array = arrays[i];
    if (!isArrayLikeObject(array)) {
      return [];
    }
    result = intersectionToolkit(result, Array.from(array));
  }
  return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvYXJyYXkvaW50ZXJzZWN0aW9uLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGludGVyc2VjdGlvbiBhcyBpbnRlcnNlY3Rpb25Ub29sa2l0IH0gZnJvbSAnLi4vLi4vYXJyYXkvaW50ZXJzZWN0aW9uLnRzJztcbmltcG9ydCB7IHVuaXEgfSBmcm9tICcuLi8uLi9hcnJheS91bmlxLnRzJztcbmltcG9ydCB7IGlzQXJyYXlMaWtlT2JqZWN0IH0gZnJvbSAnLi4vcHJlZGljYXRlL2lzQXJyYXlMaWtlT2JqZWN0LnRzJztcblxuLyoqXG4gKiBSZXR1cm5zIHRoZSBpbnRlcnNlY3Rpb24gb2YgbXVsdGlwbGUgYXJyYXlzLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gdGFrZXMgbXVsdGlwbGUgYXJyYXlzIGFuZCByZXR1cm5zIGEgbmV3IGFycmF5IGNvbnRhaW5pbmcgdGhlIGVsZW1lbnRzIHRoYXQgYXJlXG4gKiBwcmVzZW50IGluIGFsbCBwcm92aWRlZCBhcnJheXMuIEl0IGVmZmVjdGl2ZWx5IGZpbHRlcnMgb3V0IGFueSBlbGVtZW50cyB0aGF0IGFyZSBub3QgZm91bmRcbiAqIGluIGV2ZXJ5IGFycmF5LlxuICpcbiAqIEB0ZW1wbGF0ZSBUIC0gVGhlIHR5cGUgb2YgZWxlbWVudHMgaW4gdGhlIGFycmF5cy5cbiAqIEBwYXJhbSB7Li4uKEFycmF5TGlrZTxUPiB8IG51bGwgfCB1bmRlZmluZWQpfSBhcnJheXMgLSBUaGUgYXJyYXlzIHRvIGNvbXBhcmUuXG4gKiBAcmV0dXJucyB7VFtdfSBBIG5ldyBhcnJheSBjb250YWluaW5nIHRoZSBlbGVtZW50cyB0aGF0IGFyZSBwcmVzZW50IGluIGFsbCBhcnJheXMuXG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IGFycmF5MSA9IFsxLCAyLCAzLCA0LCA1XTtcbiAqIGNvbnN0IGFycmF5MiA9IFszLCA0LCA1LCA2LCA3XTtcbiAqIGNvbnN0IHJlc3VsdCA9IGludGVyc2VjdGlvbihhcnJheTEsIGFycmF5Mik7XG4gKiAvLyByZXN1bHQgd2lsbCBiZSBbMywgNCwgNV0gc2luY2UgdGhlc2UgZWxlbWVudHMgYXJlIGluIGJvdGggYXJyYXlzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gaW50ZXJzZWN0aW9uPFQ+KC4uLmFycmF5czogQXJyYXk8QXJyYXlMaWtlPFQ+IHwgbnVsbCB8IHVuZGVmaW5lZD4pOiBUW10ge1xuICBpZiAoYXJyYXlzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBbXTtcbiAgfVxuXG4gIGlmICghaXNBcnJheUxpa2VPYmplY3QoYXJyYXlzWzBdKSkge1xuICAgIHJldHVybiBbXTtcbiAgfVxuXG4gIGxldCByZXN1bHQ6IFRbXSA9IHVuaXEoQXJyYXkuZnJvbShhcnJheXNbMF0pKTtcblxuICBmb3IgKGxldCBpID0gMTsgaSA8IGFycmF5cy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGFycmF5ID0gYXJyYXlzW2ldO1xuXG4gICAgaWYgKCFpc0FycmF5TGlrZU9iamVjdChhcnJheSkpIHtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgICByZXN1bHQgPSBpbnRlcnNlY3Rpb25Ub29sa2l0KHJlc3VsdCwgQXJyYXkuZnJvbShhcnJheSkpO1xuICB9XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLGdCQUFnQixtQkFBbUIsUUFBUSw4QkFBOEI7QUFDbEYsU0FBUyxJQUFJLFFBQVEsc0JBQXNCO0FBQzNDLFNBQVMsaUJBQWlCLFFBQVEsb0NBQW9DO0FBRXRFOzs7Ozs7Ozs7Ozs7Ozs7O0NBZ0JDLEdBQ0QsT0FBTyxTQUFTLGFBQWdCLEdBQUcsTUFBOEM7RUFDL0UsSUFBSSxPQUFPLE1BQU0sS0FBSyxHQUFHO0lBQ3ZCLE9BQU8sRUFBRTtFQUNYO0VBRUEsSUFBSSxDQUFDLGtCQUFrQixNQUFNLENBQUMsRUFBRSxHQUFHO0lBQ2pDLE9BQU8sRUFBRTtFQUNYO0VBRUEsSUFBSSxTQUFjLEtBQUssTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUU7RUFFM0MsSUFBSyxJQUFJLElBQUksR0FBRyxJQUFJLE9BQU8sTUFBTSxFQUFFLElBQUs7SUFDdEMsTUFBTSxRQUFRLE1BQU0sQ0FBQyxFQUFFO0lBRXZCLElBQUksQ0FBQyxrQkFBa0IsUUFBUTtNQUM3QixPQUFPLEVBQUU7SUFDWDtJQUVBLFNBQVMsb0JBQW9CLFFBQVEsTUFBTSxJQUFJLENBQUM7RUFDbEQ7RUFFQSxPQUFPO0FBQ1QifQ==
// denoCacheMetadata=17961623615243408616,8648070707596025204