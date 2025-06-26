import { isNil } from '../../predicate/isNil.ts';
/**
 * Returns the length of an array, string, or object.
 *
 * This function takes an array, string, or object and returns its length.
 * For arrays and strings, it returns the number of elements or characters, respectively.
 * For objects, it returns the number of enumerable properties.
 *
 * @template T - The type of the input value.
 * @param {T[] | object | string | Map<unknown, T> | Set<T> | null | undefined } target - The value whose size is to be determined. It can be an array, string, or object.
 * @returns {number} The size of the input value.
 *
 * @example
 * const arr = [1, 2, 3];
 * const arrSize = size(arr);
 * // arrSize will be 3
 *
 * const str = 'hello';
 * const strSize = size(str);
 * // strSize will be 5
 *
 * const obj = { a: 1, b: 2, c: 3 };
 * const objSize = size(obj);
 * // objSize will be 3
 *
 * const emptyArr = [];
 * const emptyArrSize = size(emptyArr);
 * // emptyArrSize will be 0
 *
 * const emptyStr = '';
 * const emptyStrSize = size(emptyStr);
 * // emptyStrSize will be 0
 *
 * const emptyObj = {};
 * const emptyObjSize = size(emptyObj);
 * // emptyObjSize will be 0
 */ export function size(target) {
  if (isNil(target)) {
    return 0;
  }
  if (target instanceof Map || target instanceof Set) {
    return target.size;
  }
  return Object.keys(target).length;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvYXJyYXkvc2l6ZS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBpc05pbCB9IGZyb20gJy4uLy4uL3ByZWRpY2F0ZS9pc05pbC50cyc7XG5cbi8qKlxuICogUmV0dXJucyB0aGUgbGVuZ3RoIG9mIGFuIGFycmF5LCBzdHJpbmcsIG9yIG9iamVjdC5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIHRha2VzIGFuIGFycmF5LCBzdHJpbmcsIG9yIG9iamVjdCBhbmQgcmV0dXJucyBpdHMgbGVuZ3RoLlxuICogRm9yIGFycmF5cyBhbmQgc3RyaW5ncywgaXQgcmV0dXJucyB0aGUgbnVtYmVyIG9mIGVsZW1lbnRzIG9yIGNoYXJhY3RlcnMsIHJlc3BlY3RpdmVseS5cbiAqIEZvciBvYmplY3RzLCBpdCByZXR1cm5zIHRoZSBudW1iZXIgb2YgZW51bWVyYWJsZSBwcm9wZXJ0aWVzLlxuICpcbiAqIEB0ZW1wbGF0ZSBUIC0gVGhlIHR5cGUgb2YgdGhlIGlucHV0IHZhbHVlLlxuICogQHBhcmFtIHtUW10gfCBvYmplY3QgfCBzdHJpbmcgfCBNYXA8dW5rbm93biwgVD4gfCBTZXQ8VD4gfCBudWxsIHwgdW5kZWZpbmVkIH0gdGFyZ2V0IC0gVGhlIHZhbHVlIHdob3NlIHNpemUgaXMgdG8gYmUgZGV0ZXJtaW5lZC4gSXQgY2FuIGJlIGFuIGFycmF5LCBzdHJpbmcsIG9yIG9iamVjdC5cbiAqIEByZXR1cm5zIHtudW1iZXJ9IFRoZSBzaXplIG9mIHRoZSBpbnB1dCB2YWx1ZS5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgYXJyID0gWzEsIDIsIDNdO1xuICogY29uc3QgYXJyU2l6ZSA9IHNpemUoYXJyKTtcbiAqIC8vIGFyclNpemUgd2lsbCBiZSAzXG4gKlxuICogY29uc3Qgc3RyID0gJ2hlbGxvJztcbiAqIGNvbnN0IHN0clNpemUgPSBzaXplKHN0cik7XG4gKiAvLyBzdHJTaXplIHdpbGwgYmUgNVxuICpcbiAqIGNvbnN0IG9iaiA9IHsgYTogMSwgYjogMiwgYzogMyB9O1xuICogY29uc3Qgb2JqU2l6ZSA9IHNpemUob2JqKTtcbiAqIC8vIG9ialNpemUgd2lsbCBiZSAzXG4gKlxuICogY29uc3QgZW1wdHlBcnIgPSBbXTtcbiAqIGNvbnN0IGVtcHR5QXJyU2l6ZSA9IHNpemUoZW1wdHlBcnIpO1xuICogLy8gZW1wdHlBcnJTaXplIHdpbGwgYmUgMFxuICpcbiAqIGNvbnN0IGVtcHR5U3RyID0gJyc7XG4gKiBjb25zdCBlbXB0eVN0clNpemUgPSBzaXplKGVtcHR5U3RyKTtcbiAqIC8vIGVtcHR5U3RyU2l6ZSB3aWxsIGJlIDBcbiAqXG4gKiBjb25zdCBlbXB0eU9iaiA9IHt9O1xuICogY29uc3QgZW1wdHlPYmpTaXplID0gc2l6ZShlbXB0eU9iaik7XG4gKiAvLyBlbXB0eU9ialNpemUgd2lsbCBiZSAwXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzaXplPFQ+KHRhcmdldDogcmVhZG9ubHkgVFtdIHwgb2JqZWN0IHwgc3RyaW5nIHwgTWFwPHVua25vd24sIFQ+IHwgU2V0PFQ+IHwgbnVsbCB8IHVuZGVmaW5lZCk6IG51bWJlciB7XG4gIGlmIChpc05pbCh0YXJnZXQpKSB7XG4gICAgcmV0dXJuIDA7XG4gIH1cblxuICBpZiAodGFyZ2V0IGluc3RhbmNlb2YgTWFwIHx8IHRhcmdldCBpbnN0YW5jZW9mIFNldCkge1xuICAgIHJldHVybiB0YXJnZXQuc2l6ZTtcbiAgfVxuXG4gIHJldHVybiBPYmplY3Qua2V5cyh0YXJnZXQpLmxlbmd0aDtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLEtBQUssUUFBUSwyQkFBMkI7QUFFakQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBbUNDLEdBQ0QsT0FBTyxTQUFTLEtBQVEsTUFBb0Y7RUFDMUcsSUFBSSxNQUFNLFNBQVM7SUFDakIsT0FBTztFQUNUO0VBRUEsSUFBSSxrQkFBa0IsT0FBTyxrQkFBa0IsS0FBSztJQUNsRCxPQUFPLE9BQU8sSUFBSTtFQUNwQjtFQUVBLE9BQU8sT0FBTyxJQUFJLENBQUMsUUFBUSxNQUFNO0FBQ25DIn0=
// denoCacheMetadata=17237966408849688327,2831017574059321161