import { isPlainObject } from '../predicate/isPlainObject.ts';
/**
 * Merges the properties of the source object into the target object.
 *
 * This function performs a deep merge, meaning nested objects and arrays are merged recursively.
 * If a property in the source object is an array or an object and the corresponding property in the target object is also an array or object, they will be merged.
 * If a property in the source object is undefined, it will not overwrite a defined property in the target object.
 *
 * Note that this function mutates the target object.
 *
 * @param {T} target - The target object into which the source object properties will be merged. This object is modified in place.
 * @param {S} source - The source object whose properties will be merged into the target object.
 * @returns {T & S} The updated target object with properties from the source object merged in.
 *
 * @template T - Type of the target object.
 * @template S - Type of the source object.
 *
 * @example
 * const target = { a: 1, b: { x: 1, y: 2 } };
 * const source = { b: { y: 3, z: 4 }, c: 5 };
 *
 * const result = merge(target, source);
 * console.log(result);
 * // Output: { a: 1, b: { x: 1, y: 3, z: 4 }, c: 5 }
 *
 * @example
 * const target = { a: [1, 2], b: { x: 1 } };
 * const source = { a: [3], b: { y: 2 } };
 *
 * const result = merge(target, source);
 * console.log(result);
 * // Output: { a: [3, 2], b: { x: 1, y: 2 } }
 *
 * @example
 * const target = { a: null };
 * const source = { a: [1, 2, 3] };
 *
 * const result = merge(target, source);
 * console.log(result);
 * // Output: { a: [1, 2, 3] }
 */ export function merge(target, source) {
  const sourceKeys = Object.keys(source);
  for(let i = 0; i < sourceKeys.length; i++){
    const key = sourceKeys[i];
    const sourceValue = source[key];
    const targetValue = target[key];
    if (Array.isArray(sourceValue)) {
      if (Array.isArray(targetValue)) {
        target[key] = merge(targetValue, sourceValue);
      } else {
        target[key] = merge([], sourceValue);
      }
    } else if (isPlainObject(sourceValue)) {
      if (isPlainObject(targetValue)) {
        target[key] = merge(targetValue, sourceValue);
      } else {
        target[key] = merge({}, sourceValue);
      }
    } else if (targetValue === undefined || sourceValue !== undefined) {
      target[key] = sourceValue;
    }
  }
  return target;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9vYmplY3QvbWVyZ2UudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgaXNQbGFpbk9iamVjdCB9IGZyb20gJy4uL3ByZWRpY2F0ZS9pc1BsYWluT2JqZWN0LnRzJztcblxuLyoqXG4gKiBNZXJnZXMgdGhlIHByb3BlcnRpZXMgb2YgdGhlIHNvdXJjZSBvYmplY3QgaW50byB0aGUgdGFyZ2V0IG9iamVjdC5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIHBlcmZvcm1zIGEgZGVlcCBtZXJnZSwgbWVhbmluZyBuZXN0ZWQgb2JqZWN0cyBhbmQgYXJyYXlzIGFyZSBtZXJnZWQgcmVjdXJzaXZlbHkuXG4gKiBJZiBhIHByb3BlcnR5IGluIHRoZSBzb3VyY2Ugb2JqZWN0IGlzIGFuIGFycmF5IG9yIGFuIG9iamVjdCBhbmQgdGhlIGNvcnJlc3BvbmRpbmcgcHJvcGVydHkgaW4gdGhlIHRhcmdldCBvYmplY3QgaXMgYWxzbyBhbiBhcnJheSBvciBvYmplY3QsIHRoZXkgd2lsbCBiZSBtZXJnZWQuXG4gKiBJZiBhIHByb3BlcnR5IGluIHRoZSBzb3VyY2Ugb2JqZWN0IGlzIHVuZGVmaW5lZCwgaXQgd2lsbCBub3Qgb3ZlcndyaXRlIGEgZGVmaW5lZCBwcm9wZXJ0eSBpbiB0aGUgdGFyZ2V0IG9iamVjdC5cbiAqXG4gKiBOb3RlIHRoYXQgdGhpcyBmdW5jdGlvbiBtdXRhdGVzIHRoZSB0YXJnZXQgb2JqZWN0LlxuICpcbiAqIEBwYXJhbSB7VH0gdGFyZ2V0IC0gVGhlIHRhcmdldCBvYmplY3QgaW50byB3aGljaCB0aGUgc291cmNlIG9iamVjdCBwcm9wZXJ0aWVzIHdpbGwgYmUgbWVyZ2VkLiBUaGlzIG9iamVjdCBpcyBtb2RpZmllZCBpbiBwbGFjZS5cbiAqIEBwYXJhbSB7U30gc291cmNlIC0gVGhlIHNvdXJjZSBvYmplY3Qgd2hvc2UgcHJvcGVydGllcyB3aWxsIGJlIG1lcmdlZCBpbnRvIHRoZSB0YXJnZXQgb2JqZWN0LlxuICogQHJldHVybnMge1QgJiBTfSBUaGUgdXBkYXRlZCB0YXJnZXQgb2JqZWN0IHdpdGggcHJvcGVydGllcyBmcm9tIHRoZSBzb3VyY2Ugb2JqZWN0IG1lcmdlZCBpbi5cbiAqXG4gKiBAdGVtcGxhdGUgVCAtIFR5cGUgb2YgdGhlIHRhcmdldCBvYmplY3QuXG4gKiBAdGVtcGxhdGUgUyAtIFR5cGUgb2YgdGhlIHNvdXJjZSBvYmplY3QuXG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IHRhcmdldCA9IHsgYTogMSwgYjogeyB4OiAxLCB5OiAyIH0gfTtcbiAqIGNvbnN0IHNvdXJjZSA9IHsgYjogeyB5OiAzLCB6OiA0IH0sIGM6IDUgfTtcbiAqXG4gKiBjb25zdCByZXN1bHQgPSBtZXJnZSh0YXJnZXQsIHNvdXJjZSk7XG4gKiBjb25zb2xlLmxvZyhyZXN1bHQpO1xuICogLy8gT3V0cHV0OiB7IGE6IDEsIGI6IHsgeDogMSwgeTogMywgejogNCB9LCBjOiA1IH1cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgdGFyZ2V0ID0geyBhOiBbMSwgMl0sIGI6IHsgeDogMSB9IH07XG4gKiBjb25zdCBzb3VyY2UgPSB7IGE6IFszXSwgYjogeyB5OiAyIH0gfTtcbiAqXG4gKiBjb25zdCByZXN1bHQgPSBtZXJnZSh0YXJnZXQsIHNvdXJjZSk7XG4gKiBjb25zb2xlLmxvZyhyZXN1bHQpO1xuICogLy8gT3V0cHV0OiB7IGE6IFszLCAyXSwgYjogeyB4OiAxLCB5OiAyIH0gfVxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCB0YXJnZXQgPSB7IGE6IG51bGwgfTtcbiAqIGNvbnN0IHNvdXJjZSA9IHsgYTogWzEsIDIsIDNdIH07XG4gKlxuICogY29uc3QgcmVzdWx0ID0gbWVyZ2UodGFyZ2V0LCBzb3VyY2UpO1xuICogY29uc29sZS5sb2cocmVzdWx0KTtcbiAqIC8vIE91dHB1dDogeyBhOiBbMSwgMiwgM10gfVxuICovXG5leHBvcnQgZnVuY3Rpb24gbWVyZ2U8VCBleHRlbmRzIFJlY29yZDxQcm9wZXJ0eUtleSwgYW55PiwgUyBleHRlbmRzIFJlY29yZDxQcm9wZXJ0eUtleSwgYW55Pj4oXG4gIHRhcmdldDogVCxcbiAgc291cmNlOiBTXG4pOiBUICYgUyB7XG4gIGNvbnN0IHNvdXJjZUtleXMgPSBPYmplY3Qua2V5cyhzb3VyY2UpIGFzIEFycmF5PGtleW9mIFM+O1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgc291cmNlS2V5cy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGtleSA9IHNvdXJjZUtleXNbaV07XG5cbiAgICBjb25zdCBzb3VyY2VWYWx1ZSA9IHNvdXJjZVtrZXldO1xuICAgIGNvbnN0IHRhcmdldFZhbHVlID0gdGFyZ2V0W2tleV07XG5cbiAgICBpZiAoQXJyYXkuaXNBcnJheShzb3VyY2VWYWx1ZSkpIHtcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KHRhcmdldFZhbHVlKSkge1xuICAgICAgICB0YXJnZXRba2V5XSA9IG1lcmdlKHRhcmdldFZhbHVlLCBzb3VyY2VWYWx1ZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0YXJnZXRba2V5XSA9IG1lcmdlKFtdLCBzb3VyY2VWYWx1ZSk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChpc1BsYWluT2JqZWN0KHNvdXJjZVZhbHVlKSkge1xuICAgICAgaWYgKGlzUGxhaW5PYmplY3QodGFyZ2V0VmFsdWUpKSB7XG4gICAgICAgIHRhcmdldFtrZXldID0gbWVyZ2UodGFyZ2V0VmFsdWUsIHNvdXJjZVZhbHVlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRhcmdldFtrZXldID0gbWVyZ2Uoe30sIHNvdXJjZVZhbHVlKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHRhcmdldFZhbHVlID09PSB1bmRlZmluZWQgfHwgc291cmNlVmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgdGFyZ2V0W2tleV0gPSBzb3VyY2VWYWx1ZTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGFyZ2V0O1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsYUFBYSxRQUFRLGdDQUFnQztBQUU5RDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBdUNDLEdBQ0QsT0FBTyxTQUFTLE1BQ2QsTUFBUyxFQUNULE1BQVM7RUFFVCxNQUFNLGFBQWEsT0FBTyxJQUFJLENBQUM7RUFFL0IsSUFBSyxJQUFJLElBQUksR0FBRyxJQUFJLFdBQVcsTUFBTSxFQUFFLElBQUs7SUFDMUMsTUFBTSxNQUFNLFVBQVUsQ0FBQyxFQUFFO0lBRXpCLE1BQU0sY0FBYyxNQUFNLENBQUMsSUFBSTtJQUMvQixNQUFNLGNBQWMsTUFBTSxDQUFDLElBQUk7SUFFL0IsSUFBSSxNQUFNLE9BQU8sQ0FBQyxjQUFjO01BQzlCLElBQUksTUFBTSxPQUFPLENBQUMsY0FBYztRQUM5QixNQUFNLENBQUMsSUFBSSxHQUFHLE1BQU0sYUFBYTtNQUNuQyxPQUFPO1FBQ0wsTUFBTSxDQUFDLElBQUksR0FBRyxNQUFNLEVBQUUsRUFBRTtNQUMxQjtJQUNGLE9BQU8sSUFBSSxjQUFjLGNBQWM7TUFDckMsSUFBSSxjQUFjLGNBQWM7UUFDOUIsTUFBTSxDQUFDLElBQUksR0FBRyxNQUFNLGFBQWE7TUFDbkMsT0FBTztRQUNMLE1BQU0sQ0FBQyxJQUFJLEdBQUcsTUFBTSxDQUFDLEdBQUc7TUFDMUI7SUFDRixPQUFPLElBQUksZ0JBQWdCLGFBQWEsZ0JBQWdCLFdBQVc7TUFDakUsTUFBTSxDQUFDLElBQUksR0FBRztJQUNoQjtFQUNGO0VBRUEsT0FBTztBQUNUIn0=
// denoCacheMetadata=4397541466077105398,14852847495315912978