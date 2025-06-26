import { get } from './get.ts';
/**
 * Creates a function that returns the value at a given path of an object.
 *
 * @param {PropertyKey | PropertyKey[]} path - The path of the property to get.
 * @returns {(object: unknown) => any} - Returns a new function that takes an object and returns the value at the specified path.
 *
 * @example
 * const getObjectValue = property('a.b.c');
 * const result = getObjectValue({ a: { b: { c: 3 } } });
 * console.log(result); // => 3
 *
 * @example
 * const getObjectValue = property(['a', 'b', 'c']);
 * const result = getObjectValue({ a: { b: { c: 3 } } });
 * console.log(result); // => 3
 */ export function property(path) {
  return function(object) {
    return get(object, path);
  };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvb2JqZWN0L3Byb3BlcnR5LnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGdldCB9IGZyb20gJy4vZ2V0LnRzJztcblxuLyoqXG4gKiBDcmVhdGVzIGEgZnVuY3Rpb24gdGhhdCByZXR1cm5zIHRoZSB2YWx1ZSBhdCBhIGdpdmVuIHBhdGggb2YgYW4gb2JqZWN0LlxuICpcbiAqIEBwYXJhbSB7UHJvcGVydHlLZXkgfCBQcm9wZXJ0eUtleVtdfSBwYXRoIC0gVGhlIHBhdGggb2YgdGhlIHByb3BlcnR5IHRvIGdldC5cbiAqIEByZXR1cm5zIHsob2JqZWN0OiB1bmtub3duKSA9PiBhbnl9IC0gUmV0dXJucyBhIG5ldyBmdW5jdGlvbiB0aGF0IHRha2VzIGFuIG9iamVjdCBhbmQgcmV0dXJucyB0aGUgdmFsdWUgYXQgdGhlIHNwZWNpZmllZCBwYXRoLlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCBnZXRPYmplY3RWYWx1ZSA9IHByb3BlcnR5KCdhLmIuYycpO1xuICogY29uc3QgcmVzdWx0ID0gZ2V0T2JqZWN0VmFsdWUoeyBhOiB7IGI6IHsgYzogMyB9IH0gfSk7XG4gKiBjb25zb2xlLmxvZyhyZXN1bHQpOyAvLyA9PiAzXG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IGdldE9iamVjdFZhbHVlID0gcHJvcGVydHkoWydhJywgJ2InLCAnYyddKTtcbiAqIGNvbnN0IHJlc3VsdCA9IGdldE9iamVjdFZhbHVlKHsgYTogeyBiOiB7IGM6IDMgfSB9IH0pO1xuICogY29uc29sZS5sb2cocmVzdWx0KTsgLy8gPT4gM1xuICovXG5leHBvcnQgZnVuY3Rpb24gcHJvcGVydHkocGF0aDogUHJvcGVydHlLZXkgfCByZWFkb25seSBQcm9wZXJ0eUtleVtdKTogKG9iamVjdDogdW5rbm93bikgPT4gYW55IHtcbiAgcmV0dXJuIGZ1bmN0aW9uIChvYmplY3Q6IHVua25vd24pIHtcbiAgICByZXR1cm4gZ2V0KG9iamVjdCwgcGF0aCk7XG4gIH07XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxHQUFHLFFBQVEsV0FBVztBQUUvQjs7Ozs7Ozs7Ozs7Ozs7O0NBZUMsR0FDRCxPQUFPLFNBQVMsU0FBUyxJQUEwQztFQUNqRSxPQUFPLFNBQVUsTUFBZTtJQUM5QixPQUFPLElBQUksUUFBUTtFQUNyQjtBQUNGIn0=
// denoCacheMetadata=3521037110131618402,6754494314518198409