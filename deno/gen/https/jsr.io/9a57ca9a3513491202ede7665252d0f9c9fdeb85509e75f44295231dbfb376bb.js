/**
 * Checks if `object` conforms to `source` by invoking the predicate properties of `source` with the corresponding property values of `object`.
 *
 * Note: This method is equivalent to `conforms` when source is partially applied.
 *
 * @param {Record<PropertyKey, any>} target The object to inspect.
 * @param {Record<PropertyKey, (value: any) => boolean>} source The object of property predicates to conform to.
 * @returns {boolean} Returns `true` if `object` conforms, else `false`.
 *
 * @example
 *
 * const object = { 'a': 1, 'b': 2 };
 * const source = {
 *   'a': (n) => n > 0,
 *   'b': (n) => n > 1
 * };
 *
 * console.log(conformsTo(object, source)); // => true
 *
 * const source2 = {
 *   'a': (n) => n > 1,
 *   'b': (n) => n > 1
 * };
 *
 * console.log(conformsTo(object, source2)); // => false
 */ export function conformsTo(target, source) {
  if (source == null) {
    return true;
  }
  if (target == null) {
    return Object.keys(source).length === 0;
  }
  const keys = Object.keys(source);
  for(let i = 0; i < keys.length; i++){
    const key = keys[i];
    const predicate = source[key];
    const value = target[key];
    if (value === undefined && !(key in target) || !predicate(value)) {
      return false;
    }
  }
  return true;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvcHJlZGljYXRlL2NvbmZvcm1zVG8udHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBDaGVja3MgaWYgYG9iamVjdGAgY29uZm9ybXMgdG8gYHNvdXJjZWAgYnkgaW52b2tpbmcgdGhlIHByZWRpY2F0ZSBwcm9wZXJ0aWVzIG9mIGBzb3VyY2VgIHdpdGggdGhlIGNvcnJlc3BvbmRpbmcgcHJvcGVydHkgdmFsdWVzIG9mIGBvYmplY3RgLlxuICpcbiAqIE5vdGU6IFRoaXMgbWV0aG9kIGlzIGVxdWl2YWxlbnQgdG8gYGNvbmZvcm1zYCB3aGVuIHNvdXJjZSBpcyBwYXJ0aWFsbHkgYXBwbGllZC5cbiAqXG4gKiBAcGFyYW0ge1JlY29yZDxQcm9wZXJ0eUtleSwgYW55Pn0gdGFyZ2V0IFRoZSBvYmplY3QgdG8gaW5zcGVjdC5cbiAqIEBwYXJhbSB7UmVjb3JkPFByb3BlcnR5S2V5LCAodmFsdWU6IGFueSkgPT4gYm9vbGVhbj59IHNvdXJjZSBUaGUgb2JqZWN0IG9mIHByb3BlcnR5IHByZWRpY2F0ZXMgdG8gY29uZm9ybSB0by5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgb2JqZWN0YCBjb25mb3JtcywgZWxzZSBgZmFsc2VgLlxuICpcbiAqIEBleGFtcGxlXG4gKlxuICogY29uc3Qgb2JqZWN0ID0geyAnYSc6IDEsICdiJzogMiB9O1xuICogY29uc3Qgc291cmNlID0ge1xuICogICAnYSc6IChuKSA9PiBuID4gMCxcbiAqICAgJ2InOiAobikgPT4gbiA+IDFcbiAqIH07XG4gKlxuICogY29uc29sZS5sb2coY29uZm9ybXNUbyhvYmplY3QsIHNvdXJjZSkpOyAvLyA9PiB0cnVlXG4gKlxuICogY29uc3Qgc291cmNlMiA9IHtcbiAqICAgJ2EnOiAobikgPT4gbiA+IDEsXG4gKiAgICdiJzogKG4pID0+IG4gPiAxXG4gKiB9O1xuICpcbiAqIGNvbnNvbGUubG9nKGNvbmZvcm1zVG8ob2JqZWN0LCBzb3VyY2UyKSk7IC8vID0+IGZhbHNlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb25mb3Jtc1RvKFxuICB0YXJnZXQ6IFJlY29yZDxQcm9wZXJ0eUtleSwgYW55PixcbiAgc291cmNlOiBSZWNvcmQ8UHJvcGVydHlLZXksICh2YWx1ZTogYW55KSA9PiBib29sZWFuPlxuKTogYm9vbGVhbiB7XG4gIGlmIChzb3VyY2UgPT0gbnVsbCkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgaWYgKHRhcmdldCA9PSBudWxsKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHNvdXJjZSkubGVuZ3RoID09PSAwO1xuICB9XG5cbiAgY29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKHNvdXJjZSk7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwga2V5cy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGtleSA9IGtleXNbaV07XG4gICAgY29uc3QgcHJlZGljYXRlID0gc291cmNlW2tleV07XG4gICAgY29uc3QgdmFsdWUgPSB0YXJnZXRba2V5XTtcbiAgICBpZiAoKHZhbHVlID09PSB1bmRlZmluZWQgJiYgIShrZXkgaW4gdGFyZ2V0KSkgfHwgIXByZWRpY2F0ZSh2YWx1ZSkpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0F5QkMsR0FDRCxPQUFPLFNBQVMsV0FDZCxNQUFnQyxFQUNoQyxNQUFvRDtFQUVwRCxJQUFJLFVBQVUsTUFBTTtJQUNsQixPQUFPO0VBQ1Q7RUFFQSxJQUFJLFVBQVUsTUFBTTtJQUNsQixPQUFPLE9BQU8sSUFBSSxDQUFDLFFBQVEsTUFBTSxLQUFLO0VBQ3hDO0VBRUEsTUFBTSxPQUFPLE9BQU8sSUFBSSxDQUFDO0VBQ3pCLElBQUssSUFBSSxJQUFJLEdBQUcsSUFBSSxLQUFLLE1BQU0sRUFBRSxJQUFLO0lBQ3BDLE1BQU0sTUFBTSxJQUFJLENBQUMsRUFBRTtJQUNuQixNQUFNLFlBQVksTUFBTSxDQUFDLElBQUk7SUFDN0IsTUFBTSxRQUFRLE1BQU0sQ0FBQyxJQUFJO0lBQ3pCLElBQUksQUFBQyxVQUFVLGFBQWEsQ0FBQyxDQUFDLE9BQU8sTUFBTSxLQUFNLENBQUMsVUFBVSxRQUFRO01BQ2xFLE9BQU87SUFDVDtFQUNGO0VBQ0EsT0FBTztBQUNUIn0=
// denoCacheMetadata=1986915243654743419,2323467153428050603