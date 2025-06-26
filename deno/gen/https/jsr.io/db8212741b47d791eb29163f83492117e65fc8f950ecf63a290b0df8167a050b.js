import { isObjectLike } from '../compat/predicate/isObjectLike.ts';
/**
 * Merges the properties of the source object into the target object.
 *
 * You can provide a custom `merge` function to control how properties are merged. It should return the value to be set in the target object.
 *
 * If it returns `undefined`, a default deep merge will be applied for arrays and objects:
 *
 * - If a property in the source object is an array or an object and the corresponding property in the target object is also an array or object, they will be merged.
 * - If a property in the source object is undefined, it will not overwrite a defined property in the target object.
 *
 * Note that this function mutates the target object.
 *
 * @param {T} target - The target object into which the source object properties will be merged. This object is modified in place.
 * @param {S} source - The source object whose properties will be merged into the target object.
 * @param {(targetValue: any, sourceValue: any, key: string, target: T, source: S) => any} merge - A custom merge function that defines how properties should be combined. It receives the following arguments:
 *   - `targetValue`: The current value of the property in the target object.
 *   - `sourceValue`: The value of the property in the source object.
 *   - `key`: The key of the property being merged.
 *   - `target`: The target object.
 *   - `source`: The source object.
 *
 * @returns {T & S} The updated target object with properties from the source object merged in.
 *
 * @template T - Type of the target object.
 * @template S - Type of the source object.
 *
 * @example
 * const target = { a: 1, b: 2 };
 * const source = { b: 3, c: 4 };
 *
 * mergeWith(target, source, (targetValue, sourceValue) => {
 *   if (typeof targetValue === 'number' && typeof sourceValue === 'number') {
 *     return targetValue + sourceValue;
 *   }
 * });
 * // Returns { a: 1, b: 5, c: 4 }
 * @example
 * const target = { a: [1], b: [2] };
 * const source = { a: [3], b: [4] };
 *
 * const result = mergeWith(target, source, (objValue, srcValue) => {
 *   if (Array.isArray(objValue)) {
 *     return objValue.concat(srcValue);
 *   }
 * });
 *
 * expect(result).toEqual({ a: [1, 3], b: [2, 4] });
 */ export function mergeWith(target, source, merge) {
  const sourceKeys = Object.keys(source);
  for(let i = 0; i < sourceKeys.length; i++){
    const key = sourceKeys[i];
    const sourceValue = source[key];
    const targetValue = target[key];
    const merged = merge(targetValue, sourceValue, key, target, source);
    if (merged != null) {
      target[key] = merged;
    } else if (Array.isArray(sourceValue)) {
      target[key] = mergeWith(targetValue ?? [], sourceValue, merge);
    } else if (isObjectLike(targetValue) && isObjectLike(sourceValue)) {
      target[key] = mergeWith(targetValue ?? {}, sourceValue, merge);
    } else if (targetValue === undefined || sourceValue !== undefined) {
      target[key] = sourceValue;
    }
  }
  return target;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9vYmplY3QvbWVyZ2VXaXRoLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGlzT2JqZWN0TGlrZSB9IGZyb20gJy4uL2NvbXBhdC9wcmVkaWNhdGUvaXNPYmplY3RMaWtlLnRzJztcblxuLyoqXG4gKiBNZXJnZXMgdGhlIHByb3BlcnRpZXMgb2YgdGhlIHNvdXJjZSBvYmplY3QgaW50byB0aGUgdGFyZ2V0IG9iamVjdC5cbiAqXG4gKiBZb3UgY2FuIHByb3ZpZGUgYSBjdXN0b20gYG1lcmdlYCBmdW5jdGlvbiB0byBjb250cm9sIGhvdyBwcm9wZXJ0aWVzIGFyZSBtZXJnZWQuIEl0IHNob3VsZCByZXR1cm4gdGhlIHZhbHVlIHRvIGJlIHNldCBpbiB0aGUgdGFyZ2V0IG9iamVjdC5cbiAqXG4gKiBJZiBpdCByZXR1cm5zIGB1bmRlZmluZWRgLCBhIGRlZmF1bHQgZGVlcCBtZXJnZSB3aWxsIGJlIGFwcGxpZWQgZm9yIGFycmF5cyBhbmQgb2JqZWN0czpcbiAqXG4gKiAtIElmIGEgcHJvcGVydHkgaW4gdGhlIHNvdXJjZSBvYmplY3QgaXMgYW4gYXJyYXkgb3IgYW4gb2JqZWN0IGFuZCB0aGUgY29ycmVzcG9uZGluZyBwcm9wZXJ0eSBpbiB0aGUgdGFyZ2V0IG9iamVjdCBpcyBhbHNvIGFuIGFycmF5IG9yIG9iamVjdCwgdGhleSB3aWxsIGJlIG1lcmdlZC5cbiAqIC0gSWYgYSBwcm9wZXJ0eSBpbiB0aGUgc291cmNlIG9iamVjdCBpcyB1bmRlZmluZWQsIGl0IHdpbGwgbm90IG92ZXJ3cml0ZSBhIGRlZmluZWQgcHJvcGVydHkgaW4gdGhlIHRhcmdldCBvYmplY3QuXG4gKlxuICogTm90ZSB0aGF0IHRoaXMgZnVuY3Rpb24gbXV0YXRlcyB0aGUgdGFyZ2V0IG9iamVjdC5cbiAqXG4gKiBAcGFyYW0ge1R9IHRhcmdldCAtIFRoZSB0YXJnZXQgb2JqZWN0IGludG8gd2hpY2ggdGhlIHNvdXJjZSBvYmplY3QgcHJvcGVydGllcyB3aWxsIGJlIG1lcmdlZC4gVGhpcyBvYmplY3QgaXMgbW9kaWZpZWQgaW4gcGxhY2UuXG4gKiBAcGFyYW0ge1N9IHNvdXJjZSAtIFRoZSBzb3VyY2Ugb2JqZWN0IHdob3NlIHByb3BlcnRpZXMgd2lsbCBiZSBtZXJnZWQgaW50byB0aGUgdGFyZ2V0IG9iamVjdC5cbiAqIEBwYXJhbSB7KHRhcmdldFZhbHVlOiBhbnksIHNvdXJjZVZhbHVlOiBhbnksIGtleTogc3RyaW5nLCB0YXJnZXQ6IFQsIHNvdXJjZTogUykgPT4gYW55fSBtZXJnZSAtIEEgY3VzdG9tIG1lcmdlIGZ1bmN0aW9uIHRoYXQgZGVmaW5lcyBob3cgcHJvcGVydGllcyBzaG91bGQgYmUgY29tYmluZWQuIEl0IHJlY2VpdmVzIHRoZSBmb2xsb3dpbmcgYXJndW1lbnRzOlxuICogICAtIGB0YXJnZXRWYWx1ZWA6IFRoZSBjdXJyZW50IHZhbHVlIG9mIHRoZSBwcm9wZXJ0eSBpbiB0aGUgdGFyZ2V0IG9iamVjdC5cbiAqICAgLSBgc291cmNlVmFsdWVgOiBUaGUgdmFsdWUgb2YgdGhlIHByb3BlcnR5IGluIHRoZSBzb3VyY2Ugb2JqZWN0LlxuICogICAtIGBrZXlgOiBUaGUga2V5IG9mIHRoZSBwcm9wZXJ0eSBiZWluZyBtZXJnZWQuXG4gKiAgIC0gYHRhcmdldGA6IFRoZSB0YXJnZXQgb2JqZWN0LlxuICogICAtIGBzb3VyY2VgOiBUaGUgc291cmNlIG9iamVjdC5cbiAqXG4gKiBAcmV0dXJucyB7VCAmIFN9IFRoZSB1cGRhdGVkIHRhcmdldCBvYmplY3Qgd2l0aCBwcm9wZXJ0aWVzIGZyb20gdGhlIHNvdXJjZSBvYmplY3QgbWVyZ2VkIGluLlxuICpcbiAqIEB0ZW1wbGF0ZSBUIC0gVHlwZSBvZiB0aGUgdGFyZ2V0IG9iamVjdC5cbiAqIEB0ZW1wbGF0ZSBTIC0gVHlwZSBvZiB0aGUgc291cmNlIG9iamVjdC5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgdGFyZ2V0ID0geyBhOiAxLCBiOiAyIH07XG4gKiBjb25zdCBzb3VyY2UgPSB7IGI6IDMsIGM6IDQgfTtcbiAqXG4gKiBtZXJnZVdpdGgodGFyZ2V0LCBzb3VyY2UsICh0YXJnZXRWYWx1ZSwgc291cmNlVmFsdWUpID0+IHtcbiAqICAgaWYgKHR5cGVvZiB0YXJnZXRWYWx1ZSA9PT0gJ251bWJlcicgJiYgdHlwZW9mIHNvdXJjZVZhbHVlID09PSAnbnVtYmVyJykge1xuICogICAgIHJldHVybiB0YXJnZXRWYWx1ZSArIHNvdXJjZVZhbHVlO1xuICogICB9XG4gKiB9KTtcbiAqIC8vIFJldHVybnMgeyBhOiAxLCBiOiA1LCBjOiA0IH1cbiAqIEBleGFtcGxlXG4gKiBjb25zdCB0YXJnZXQgPSB7IGE6IFsxXSwgYjogWzJdIH07XG4gKiBjb25zdCBzb3VyY2UgPSB7IGE6IFszXSwgYjogWzRdIH07XG4gKlxuICogY29uc3QgcmVzdWx0ID0gbWVyZ2VXaXRoKHRhcmdldCwgc291cmNlLCAob2JqVmFsdWUsIHNyY1ZhbHVlKSA9PiB7XG4gKiAgIGlmIChBcnJheS5pc0FycmF5KG9ialZhbHVlKSkge1xuICogICAgIHJldHVybiBvYmpWYWx1ZS5jb25jYXQoc3JjVmFsdWUpO1xuICogICB9XG4gKiB9KTtcbiAqXG4gKiBleHBlY3QocmVzdWx0KS50b0VxdWFsKHsgYTogWzEsIDNdLCBiOiBbMiwgNF0gfSk7XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBtZXJnZVdpdGg8VCBleHRlbmRzIFJlY29yZDxQcm9wZXJ0eUtleSwgYW55PiwgUyBleHRlbmRzIFJlY29yZDxQcm9wZXJ0eUtleSwgYW55Pj4oXG4gIHRhcmdldDogVCxcbiAgc291cmNlOiBTLFxuICBtZXJnZTogKHRhcmdldFZhbHVlOiBhbnksIHNvdXJjZVZhbHVlOiBhbnksIGtleTogc3RyaW5nLCB0YXJnZXQ6IFQsIHNvdXJjZTogUykgPT4gYW55XG4pOiBUICYgUyB7XG4gIGNvbnN0IHNvdXJjZUtleXMgPSBPYmplY3Qua2V5cyhzb3VyY2UpIGFzIEFycmF5PGtleW9mIFQ+O1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgc291cmNlS2V5cy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGtleSA9IHNvdXJjZUtleXNbaV07XG5cbiAgICBjb25zdCBzb3VyY2VWYWx1ZSA9IHNvdXJjZVtrZXldO1xuICAgIGNvbnN0IHRhcmdldFZhbHVlID0gdGFyZ2V0W2tleV07XG5cbiAgICBjb25zdCBtZXJnZWQgPSBtZXJnZSh0YXJnZXRWYWx1ZSwgc291cmNlVmFsdWUsIGtleSBhcyBzdHJpbmcsIHRhcmdldCwgc291cmNlKTtcblxuICAgIGlmIChtZXJnZWQgIT0gbnVsbCkge1xuICAgICAgdGFyZ2V0W2tleV0gPSBtZXJnZWQ7XG4gICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KHNvdXJjZVZhbHVlKSkge1xuICAgICAgdGFyZ2V0W2tleV0gPSBtZXJnZVdpdGg8YW55LCBTW2tleW9mIFRdPih0YXJnZXRWYWx1ZSA/PyBbXSwgc291cmNlVmFsdWUsIG1lcmdlKTtcbiAgICB9IGVsc2UgaWYgKGlzT2JqZWN0TGlrZSh0YXJnZXRWYWx1ZSkgJiYgaXNPYmplY3RMaWtlKHNvdXJjZVZhbHVlKSkge1xuICAgICAgdGFyZ2V0W2tleV0gPSBtZXJnZVdpdGg8YW55LCBTW2tleW9mIFRdPih0YXJnZXRWYWx1ZSA/PyB7fSwgc291cmNlVmFsdWUsIG1lcmdlKTtcbiAgICB9IGVsc2UgaWYgKHRhcmdldFZhbHVlID09PSB1bmRlZmluZWQgfHwgc291cmNlVmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgdGFyZ2V0W2tleV0gPSBzb3VyY2VWYWx1ZTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGFyZ2V0O1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsWUFBWSxRQUFRLHNDQUFzQztBQUVuRTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0ErQ0MsR0FDRCxPQUFPLFNBQVMsVUFDZCxNQUFTLEVBQ1QsTUFBUyxFQUNULEtBQXFGO0VBRXJGLE1BQU0sYUFBYSxPQUFPLElBQUksQ0FBQztFQUUvQixJQUFLLElBQUksSUFBSSxHQUFHLElBQUksV0FBVyxNQUFNLEVBQUUsSUFBSztJQUMxQyxNQUFNLE1BQU0sVUFBVSxDQUFDLEVBQUU7SUFFekIsTUFBTSxjQUFjLE1BQU0sQ0FBQyxJQUFJO0lBQy9CLE1BQU0sY0FBYyxNQUFNLENBQUMsSUFBSTtJQUUvQixNQUFNLFNBQVMsTUFBTSxhQUFhLGFBQWEsS0FBZSxRQUFRO0lBRXRFLElBQUksVUFBVSxNQUFNO01BQ2xCLE1BQU0sQ0FBQyxJQUFJLEdBQUc7SUFDaEIsT0FBTyxJQUFJLE1BQU0sT0FBTyxDQUFDLGNBQWM7TUFDckMsTUFBTSxDQUFDLElBQUksR0FBRyxVQUEyQixlQUFlLEVBQUUsRUFBRSxhQUFhO0lBQzNFLE9BQU8sSUFBSSxhQUFhLGdCQUFnQixhQUFhLGNBQWM7TUFDakUsTUFBTSxDQUFDLElBQUksR0FBRyxVQUEyQixlQUFlLENBQUMsR0FBRyxhQUFhO0lBQzNFLE9BQU8sSUFBSSxnQkFBZ0IsYUFBYSxnQkFBZ0IsV0FBVztNQUNqRSxNQUFNLENBQUMsSUFBSSxHQUFHO0lBQ2hCO0VBQ0Y7RUFFQSxPQUFPO0FBQ1QifQ==
// denoCacheMetadata=17091169064711853524,4731326419853250232