import { isPlainObject } from '../predicate/isPlainObject.ts';
/**
 * Flattens a nested object into a single level object with delimiter-separated keys.
 *
 * @param {object} object - The object to flatten.
 * @param {string} [options.delimiter='.'] - The delimiter to use between nested keys.
 * @returns {Record<string, any>} - The flattened object.
 *
 * @example
 * const nestedObject = {
 *   a: {
 *     b: {
 *       c: 1
 *     }
 *   },
 *   d: [2, 3]
 * };
 *
 * const flattened = flattenObject(nestedObject);
 * console.log(flattened);
 * // Output:
 * // {
 * //   'a.b.c': 1,
 * //   'd.0': 2,
 * //   'd.1': 3
 * // }
 */ export function flattenObject(object, { delimiter = '.' } = {}) {
  return flattenObjectImpl(object, '', delimiter);
}
function flattenObjectImpl(object, prefix = '', delimiter = '.') {
  const result = {};
  const keys = Object.keys(object);
  for(let i = 0; i < keys.length; i++){
    const key = keys[i];
    const value = object[key];
    const prefixedKey = prefix ? `${prefix}${delimiter}${key}` : key;
    if (isPlainObject(value) && Object.keys(value).length > 0) {
      Object.assign(result, flattenObjectImpl(value, prefixedKey, delimiter));
      continue;
    }
    if (Array.isArray(value)) {
      Object.assign(result, flattenObjectImpl(value, prefixedKey, delimiter));
      continue;
    }
    result[prefixedKey] = value;
  }
  return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9vYmplY3QvZmxhdHRlbk9iamVjdC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBpc1BsYWluT2JqZWN0IH0gZnJvbSAnLi4vcHJlZGljYXRlL2lzUGxhaW5PYmplY3QudHMnO1xuXG5pbnRlcmZhY2UgRmxhdHRlbk9iamVjdE9wdGlvbnMge1xuICAvKipcbiAgICogVGhlIGRlbGltaXRlciB0byB1c2UgYmV0d2VlbiBuZXN0ZWQga2V5cy5cbiAgICogQGRlZmF1bHQgJy4nXG4gICAqL1xuICBkZWxpbWl0ZXI/OiBzdHJpbmc7XG59XG5cbi8qKlxuICogRmxhdHRlbnMgYSBuZXN0ZWQgb2JqZWN0IGludG8gYSBzaW5nbGUgbGV2ZWwgb2JqZWN0IHdpdGggZGVsaW1pdGVyLXNlcGFyYXRlZCBrZXlzLlxuICpcbiAqIEBwYXJhbSB7b2JqZWN0fSBvYmplY3QgLSBUaGUgb2JqZWN0IHRvIGZsYXR0ZW4uXG4gKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMuZGVsaW1pdGVyPScuJ10gLSBUaGUgZGVsaW1pdGVyIHRvIHVzZSBiZXR3ZWVuIG5lc3RlZCBrZXlzLlxuICogQHJldHVybnMge1JlY29yZDxzdHJpbmcsIGFueT59IC0gVGhlIGZsYXR0ZW5lZCBvYmplY3QuXG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IG5lc3RlZE9iamVjdCA9IHtcbiAqICAgYToge1xuICogICAgIGI6IHtcbiAqICAgICAgIGM6IDFcbiAqICAgICB9XG4gKiAgIH0sXG4gKiAgIGQ6IFsyLCAzXVxuICogfTtcbiAqXG4gKiBjb25zdCBmbGF0dGVuZWQgPSBmbGF0dGVuT2JqZWN0KG5lc3RlZE9iamVjdCk7XG4gKiBjb25zb2xlLmxvZyhmbGF0dGVuZWQpO1xuICogLy8gT3V0cHV0OlxuICogLy8ge1xuICogLy8gICAnYS5iLmMnOiAxLFxuICogLy8gICAnZC4wJzogMixcbiAqIC8vICAgJ2QuMSc6IDNcbiAqIC8vIH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGZsYXR0ZW5PYmplY3Qob2JqZWN0OiBvYmplY3QsIHsgZGVsaW1pdGVyID0gJy4nIH06IEZsYXR0ZW5PYmplY3RPcHRpb25zID0ge30pOiBSZWNvcmQ8c3RyaW5nLCBhbnk+IHtcbiAgcmV0dXJuIGZsYXR0ZW5PYmplY3RJbXBsKG9iamVjdCwgJycsIGRlbGltaXRlcik7XG59XG5cbmZ1bmN0aW9uIGZsYXR0ZW5PYmplY3RJbXBsKG9iamVjdDogb2JqZWN0LCBwcmVmaXggPSAnJywgZGVsaW1pdGVyID0gJy4nKTogUmVjb3JkPHN0cmluZywgYW55PiB7XG4gIGNvbnN0IHJlc3VsdDogUmVjb3JkPHN0cmluZywgYW55PiA9IHt9O1xuICBjb25zdCBrZXlzID0gT2JqZWN0LmtleXMob2JqZWN0KTtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IGtleXMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBrZXkgPSBrZXlzW2ldO1xuICAgIGNvbnN0IHZhbHVlID0gKG9iamVjdCBhcyBhbnkpW2tleV07XG5cbiAgICBjb25zdCBwcmVmaXhlZEtleSA9IHByZWZpeCA/IGAke3ByZWZpeH0ke2RlbGltaXRlcn0ke2tleX1gIDoga2V5O1xuXG4gICAgaWYgKGlzUGxhaW5PYmplY3QodmFsdWUpICYmIE9iamVjdC5rZXlzKHZhbHVlKS5sZW5ndGggPiAwKSB7XG4gICAgICBPYmplY3QuYXNzaWduKHJlc3VsdCwgZmxhdHRlbk9iamVjdEltcGwodmFsdWUsIHByZWZpeGVkS2V5LCBkZWxpbWl0ZXIpKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgICAgT2JqZWN0LmFzc2lnbihyZXN1bHQsIGZsYXR0ZW5PYmplY3RJbXBsKHZhbHVlLCBwcmVmaXhlZEtleSwgZGVsaW1pdGVyKSk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICByZXN1bHRbcHJlZml4ZWRLZXldID0gdmFsdWU7XG4gIH1cblxuICByZXR1cm4gcmVzdWx0O1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsYUFBYSxRQUFRLGdDQUFnQztBQVU5RDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQXlCQyxHQUNELE9BQU8sU0FBUyxjQUFjLE1BQWMsRUFBRSxFQUFFLFlBQVksR0FBRyxFQUF3QixHQUFHLENBQUMsQ0FBQztFQUMxRixPQUFPLGtCQUFrQixRQUFRLElBQUk7QUFDdkM7QUFFQSxTQUFTLGtCQUFrQixNQUFjLEVBQUUsU0FBUyxFQUFFLEVBQUUsWUFBWSxHQUFHO0VBQ3JFLE1BQU0sU0FBOEIsQ0FBQztFQUNyQyxNQUFNLE9BQU8sT0FBTyxJQUFJLENBQUM7RUFFekIsSUFBSyxJQUFJLElBQUksR0FBRyxJQUFJLEtBQUssTUFBTSxFQUFFLElBQUs7SUFDcEMsTUFBTSxNQUFNLElBQUksQ0FBQyxFQUFFO0lBQ25CLE1BQU0sUUFBUSxBQUFDLE1BQWMsQ0FBQyxJQUFJO0lBRWxDLE1BQU0sY0FBYyxTQUFTLEdBQUcsU0FBUyxZQUFZLEtBQUssR0FBRztJQUU3RCxJQUFJLGNBQWMsVUFBVSxPQUFPLElBQUksQ0FBQyxPQUFPLE1BQU0sR0FBRyxHQUFHO01BQ3pELE9BQU8sTUFBTSxDQUFDLFFBQVEsa0JBQWtCLE9BQU8sYUFBYTtNQUM1RDtJQUNGO0lBRUEsSUFBSSxNQUFNLE9BQU8sQ0FBQyxRQUFRO01BQ3hCLE9BQU8sTUFBTSxDQUFDLFFBQVEsa0JBQWtCLE9BQU8sYUFBYTtNQUM1RDtJQUNGO0lBRUEsTUFBTSxDQUFDLFlBQVksR0FBRztFQUN4QjtFQUVBLE9BQU87QUFDVCJ9
// denoCacheMetadata=1611812358942782230,3492594380008424354