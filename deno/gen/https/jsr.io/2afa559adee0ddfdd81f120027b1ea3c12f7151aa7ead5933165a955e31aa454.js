import { isArrayLike } from '../predicate/isArrayLike.ts';
/**
 * Flattens an array up to the specified depth.
 *
 * @template T - The type of elements within the array.
 * @template D - The depth to which the array should be flattened.
 * @param {ArrayLike<T> | null | undefined} value - The object to flatten.
 * @param {D} depth - The depth level specifying how deep a nested array structure should be flattened. Defaults to 1.
 * @returns {Array<FlatArray<T[], D>> | []} A new array that has been flattened.
 *
 * @example
 * const arr = flatten([1, [2, 3], [4, [5, 6]]], 1);
 * // Returns: [1, 2, 3, 4, [5, 6]]
 *
 * const arr = flatten([1, [2, 3], [4, [5, 6]]], 2);
 * // Returns: [1, 2, 3, 4, 5, 6]
 */ export function flatten(value, depth = 1) {
  const result = [];
  const flooredDepth = Math.floor(depth);
  if (!isArrayLike(value)) {
    return result;
  }
  const recursive = (arr, currentDepth)=>{
    for(let i = 0; i < arr.length; i++){
      const item = arr[i];
      if (currentDepth < flooredDepth && (Array.isArray(item) || Boolean(item?.[Symbol.isConcatSpreadable]) || item !== null && typeof item === 'object' && Object.prototype.toString.call(item) === '[object Arguments]')) {
        if (Array.isArray(item)) {
          recursive(item, currentDepth + 1);
        } else {
          recursive(Array.from(item), currentDepth + 1);
        }
      } else {
        result.push(item);
      }
    }
  };
  recursive(Array.from(value), 0);
  return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvYXJyYXkvZmxhdHRlbi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBpc0FycmF5TGlrZSB9IGZyb20gJy4uL3ByZWRpY2F0ZS9pc0FycmF5TGlrZS50cyc7XG5cbi8qKlxuICogRmxhdHRlbnMgYW4gYXJyYXkgdXAgdG8gdGhlIHNwZWNpZmllZCBkZXB0aC5cbiAqXG4gKiBAdGVtcGxhdGUgVCAtIFRoZSB0eXBlIG9mIGVsZW1lbnRzIHdpdGhpbiB0aGUgYXJyYXkuXG4gKiBAdGVtcGxhdGUgRCAtIFRoZSBkZXB0aCB0byB3aGljaCB0aGUgYXJyYXkgc2hvdWxkIGJlIGZsYXR0ZW5lZC5cbiAqIEBwYXJhbSB7QXJyYXlMaWtlPFQ+IHwgbnVsbCB8IHVuZGVmaW5lZH0gdmFsdWUgLSBUaGUgb2JqZWN0IHRvIGZsYXR0ZW4uXG4gKiBAcGFyYW0ge0R9IGRlcHRoIC0gVGhlIGRlcHRoIGxldmVsIHNwZWNpZnlpbmcgaG93IGRlZXAgYSBuZXN0ZWQgYXJyYXkgc3RydWN0dXJlIHNob3VsZCBiZSBmbGF0dGVuZWQuIERlZmF1bHRzIHRvIDEuXG4gKiBAcmV0dXJucyB7QXJyYXk8RmxhdEFycmF5PFRbXSwgRD4+IHwgW119IEEgbmV3IGFycmF5IHRoYXQgaGFzIGJlZW4gZmxhdHRlbmVkLlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCBhcnIgPSBmbGF0dGVuKFsxLCBbMiwgM10sIFs0LCBbNSwgNl1dXSwgMSk7XG4gKiAvLyBSZXR1cm5zOiBbMSwgMiwgMywgNCwgWzUsIDZdXVxuICpcbiAqIGNvbnN0IGFyciA9IGZsYXR0ZW4oWzEsIFsyLCAzXSwgWzQsIFs1LCA2XV1dLCAyKTtcbiAqIC8vIFJldHVybnM6IFsxLCAyLCAzLCA0LCA1LCA2XVxuICovXG5leHBvcnQgZnVuY3Rpb24gZmxhdHRlbjxULCBEIGV4dGVuZHMgbnVtYmVyID0gMT4oXG4gIHZhbHVlOiBBcnJheUxpa2U8VD4gfCBudWxsIHwgdW5kZWZpbmVkLFxuICBkZXB0aCA9IDEgYXMgRFxuKTogQXJyYXk8RmxhdEFycmF5PFRbXSwgRD4+IHwgW10ge1xuICBjb25zdCByZXN1bHQ6IEFycmF5PEZsYXRBcnJheTxUW10sIEQ+PiA9IFtdO1xuICBjb25zdCBmbG9vcmVkRGVwdGggPSBNYXRoLmZsb29yKGRlcHRoKTtcblxuICBpZiAoIWlzQXJyYXlMaWtlKHZhbHVlKSkge1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBjb25zdCByZWN1cnNpdmUgPSAoYXJyOiByZWFkb25seSBUW10sIGN1cnJlbnREZXB0aDogbnVtYmVyKSA9PiB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhcnIubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGl0ZW0gPSBhcnJbaV07XG4gICAgICBpZiAoXG4gICAgICAgIGN1cnJlbnREZXB0aCA8IGZsb29yZWREZXB0aCAmJlxuICAgICAgICAoQXJyYXkuaXNBcnJheShpdGVtKSB8fFxuICAgICAgICAgIEJvb2xlYW4oaXRlbT8uW1N5bWJvbC5pc0NvbmNhdFNwcmVhZGFibGUgYXMga2V5b2Ygb2JqZWN0XSkgfHxcbiAgICAgICAgICAoaXRlbSAhPT0gbnVsbCAmJiB0eXBlb2YgaXRlbSA9PT0gJ29iamVjdCcgJiYgT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKGl0ZW0pID09PSAnW29iamVjdCBBcmd1bWVudHNdJykpXG4gICAgICApIHtcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoaXRlbSkpIHtcbiAgICAgICAgICByZWN1cnNpdmUoaXRlbSwgY3VycmVudERlcHRoICsgMSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVjdXJzaXZlKEFycmF5LmZyb20oaXRlbSBhcyBUW10pLCBjdXJyZW50RGVwdGggKyAxKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzdWx0LnB1c2goaXRlbSBhcyBGbGF0QXJyYXk8VFtdLCBEPik7XG4gICAgICB9XG4gICAgfVxuICB9O1xuXG4gIHJlY3Vyc2l2ZShBcnJheS5mcm9tKHZhbHVlKSwgMCk7XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLFdBQVcsUUFBUSw4QkFBOEI7QUFFMUQ7Ozs7Ozs7Ozs7Ozs7OztDQWVDLEdBQ0QsT0FBTyxTQUFTLFFBQ2QsS0FBc0MsRUFDdEMsUUFBUSxDQUFNO0VBRWQsTUFBTSxTQUFtQyxFQUFFO0VBQzNDLE1BQU0sZUFBZSxLQUFLLEtBQUssQ0FBQztFQUVoQyxJQUFJLENBQUMsWUFBWSxRQUFRO0lBQ3ZCLE9BQU87RUFDVDtFQUVBLE1BQU0sWUFBWSxDQUFDLEtBQW1CO0lBQ3BDLElBQUssSUFBSSxJQUFJLEdBQUcsSUFBSSxJQUFJLE1BQU0sRUFBRSxJQUFLO01BQ25DLE1BQU0sT0FBTyxHQUFHLENBQUMsRUFBRTtNQUNuQixJQUNFLGVBQWUsZ0JBQ2YsQ0FBQyxNQUFNLE9BQU8sQ0FBQyxTQUNiLFFBQVEsTUFBTSxDQUFDLE9BQU8sa0JBQWtCLENBQWlCLEtBQ3hELFNBQVMsUUFBUSxPQUFPLFNBQVMsWUFBWSxPQUFPLFNBQVMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFVBQVUsb0JBQXFCLEdBQzlHO1FBQ0EsSUFBSSxNQUFNLE9BQU8sQ0FBQyxPQUFPO1VBQ3ZCLFVBQVUsTUFBTSxlQUFlO1FBQ2pDLE9BQU87VUFDTCxVQUFVLE1BQU0sSUFBSSxDQUFDLE9BQWMsZUFBZTtRQUNwRDtNQUNGLE9BQU87UUFDTCxPQUFPLElBQUksQ0FBQztNQUNkO0lBQ0Y7RUFDRjtFQUVBLFVBQVUsTUFBTSxJQUFJLENBQUMsUUFBUTtFQUU3QixPQUFPO0FBQ1QifQ==
// denoCacheMetadata=2751098768781268412,16973601028495607593