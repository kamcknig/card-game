import { get } from './get.ts';
/**
 * Creates a function that returns the value at a given path of an object.
 *
 * Unlike `property`, which creates a function bound to a specific path and allows you to query different objects,
 * `propertyOf` creates a function bound to a specific object and allows you to query different paths within that object.
 *
 * @param {unknown} object - The object to query.
 * @returns {(path: PropertyKey | PropertyKey[]) => unknown} - Returns a new function that takes a path and retrieves the value from the object at the specified path.
 *
 * @example
 * const getValue = propertyOf({ a: { b: { c: 3 } } });
 * const result = getValue('a.b.c');
 * console.log(result); // => 3
 *
 * @example
 * const getValue = propertyOf({ a: { b: { c: 3 } } });
 * const result = getValue(['a', 'b', 'c']);
 * console.log(result); // => 3
 */ export function propertyOf(object) {
  return function(path) {
    return get(object, path);
  };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvb2JqZWN0L3Byb3BlcnR5T2YudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgZ2V0IH0gZnJvbSAnLi9nZXQudHMnO1xuXG4vKipcbiAqIENyZWF0ZXMgYSBmdW5jdGlvbiB0aGF0IHJldHVybnMgdGhlIHZhbHVlIGF0IGEgZ2l2ZW4gcGF0aCBvZiBhbiBvYmplY3QuXG4gKlxuICogVW5saWtlIGBwcm9wZXJ0eWAsIHdoaWNoIGNyZWF0ZXMgYSBmdW5jdGlvbiBib3VuZCB0byBhIHNwZWNpZmljIHBhdGggYW5kIGFsbG93cyB5b3UgdG8gcXVlcnkgZGlmZmVyZW50IG9iamVjdHMsXG4gKiBgcHJvcGVydHlPZmAgY3JlYXRlcyBhIGZ1bmN0aW9uIGJvdW5kIHRvIGEgc3BlY2lmaWMgb2JqZWN0IGFuZCBhbGxvd3MgeW91IHRvIHF1ZXJ5IGRpZmZlcmVudCBwYXRocyB3aXRoaW4gdGhhdCBvYmplY3QuXG4gKlxuICogQHBhcmFtIHt1bmtub3dufSBvYmplY3QgLSBUaGUgb2JqZWN0IHRvIHF1ZXJ5LlxuICogQHJldHVybnMgeyhwYXRoOiBQcm9wZXJ0eUtleSB8IFByb3BlcnR5S2V5W10pID0+IHVua25vd259IC0gUmV0dXJucyBhIG5ldyBmdW5jdGlvbiB0aGF0IHRha2VzIGEgcGF0aCBhbmQgcmV0cmlldmVzIHRoZSB2YWx1ZSBmcm9tIHRoZSBvYmplY3QgYXQgdGhlIHNwZWNpZmllZCBwYXRoLlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCBnZXRWYWx1ZSA9IHByb3BlcnR5T2YoeyBhOiB7IGI6IHsgYzogMyB9IH0gfSk7XG4gKiBjb25zdCByZXN1bHQgPSBnZXRWYWx1ZSgnYS5iLmMnKTtcbiAqIGNvbnNvbGUubG9nKHJlc3VsdCk7IC8vID0+IDNcbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgZ2V0VmFsdWUgPSBwcm9wZXJ0eU9mKHsgYTogeyBiOiB7IGM6IDMgfSB9IH0pO1xuICogY29uc3QgcmVzdWx0ID0gZ2V0VmFsdWUoWydhJywgJ2InLCAnYyddKTtcbiAqIGNvbnNvbGUubG9nKHJlc3VsdCk7IC8vID0+IDNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHByb3BlcnR5T2Yob2JqZWN0OiB1bmtub3duKTogKHBhdGg6IFByb3BlcnR5S2V5IHwgcmVhZG9ubHkgUHJvcGVydHlLZXlbXSkgPT4gdW5rbm93biB7XG4gIHJldHVybiBmdW5jdGlvbiAocGF0aDogUHJvcGVydHlLZXkgfCByZWFkb25seSBQcm9wZXJ0eUtleVtdKSB7XG4gICAgcmV0dXJuIGdldChvYmplY3QsIHBhdGgpO1xuICB9O1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsR0FBRyxRQUFRLFdBQVc7QUFFL0I7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQWtCQyxHQUNELE9BQU8sU0FBUyxXQUFXLE1BQWU7RUFDeEMsT0FBTyxTQUFVLElBQTBDO0lBQ3pELE9BQU8sSUFBSSxRQUFRO0VBQ3JCO0FBQ0YifQ==
// denoCacheMetadata=11153216242053657403,17592004315844400733