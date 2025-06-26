/**
 * Creates a new object composed of the properties that do not satisfy the predicate function.
 *
 * This function takes an object and a predicate function, and returns a new object that
 * includes only the properties for which the predicate function returns false.
 *
 * @template T - The type of object.
 * @param {T} obj - The object to omit properties from.
 * @param {(value: T[string], key: keyof T) => boolean} shouldOmit - A predicate function that determines
 * whether a property should be omitted. It takes the property's key and value as arguments and returns `true`
 * if the property should be omitted, and `false` otherwise.
 * @returns {Partial<T>} A new object with the properties that do not satisfy the predicate function.
 *
 * @example
 * const obj = { a: 1, b: 'omit', c: 3 };
 * const shouldOmit = (value) => typeof value === 'string';
 * const result = omitBy(obj, shouldOmit);
 * // result will be { a: 1, c: 3 }
 */ export function omitBy(obj, shouldOmit) {
  const result = {};
  const keys = Object.keys(obj);
  for(let i = 0; i < keys.length; i++){
    const key = keys[i];
    const value = obj[key];
    if (!shouldOmit(value, key)) {
      result[key] = value;
    }
  }
  return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9vYmplY3Qvb21pdEJ5LnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQ3JlYXRlcyBhIG5ldyBvYmplY3QgY29tcG9zZWQgb2YgdGhlIHByb3BlcnRpZXMgdGhhdCBkbyBub3Qgc2F0aXNmeSB0aGUgcHJlZGljYXRlIGZ1bmN0aW9uLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gdGFrZXMgYW4gb2JqZWN0IGFuZCBhIHByZWRpY2F0ZSBmdW5jdGlvbiwgYW5kIHJldHVybnMgYSBuZXcgb2JqZWN0IHRoYXRcbiAqIGluY2x1ZGVzIG9ubHkgdGhlIHByb3BlcnRpZXMgZm9yIHdoaWNoIHRoZSBwcmVkaWNhdGUgZnVuY3Rpb24gcmV0dXJucyBmYWxzZS5cbiAqXG4gKiBAdGVtcGxhdGUgVCAtIFRoZSB0eXBlIG9mIG9iamVjdC5cbiAqIEBwYXJhbSB7VH0gb2JqIC0gVGhlIG9iamVjdCB0byBvbWl0IHByb3BlcnRpZXMgZnJvbS5cbiAqIEBwYXJhbSB7KHZhbHVlOiBUW3N0cmluZ10sIGtleToga2V5b2YgVCkgPT4gYm9vbGVhbn0gc2hvdWxkT21pdCAtIEEgcHJlZGljYXRlIGZ1bmN0aW9uIHRoYXQgZGV0ZXJtaW5lc1xuICogd2hldGhlciBhIHByb3BlcnR5IHNob3VsZCBiZSBvbWl0dGVkLiBJdCB0YWtlcyB0aGUgcHJvcGVydHkncyBrZXkgYW5kIHZhbHVlIGFzIGFyZ3VtZW50cyBhbmQgcmV0dXJucyBgdHJ1ZWBcbiAqIGlmIHRoZSBwcm9wZXJ0eSBzaG91bGQgYmUgb21pdHRlZCwgYW5kIGBmYWxzZWAgb3RoZXJ3aXNlLlxuICogQHJldHVybnMge1BhcnRpYWw8VD59IEEgbmV3IG9iamVjdCB3aXRoIHRoZSBwcm9wZXJ0aWVzIHRoYXQgZG8gbm90IHNhdGlzZnkgdGhlIHByZWRpY2F0ZSBmdW5jdGlvbi5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3Qgb2JqID0geyBhOiAxLCBiOiAnb21pdCcsIGM6IDMgfTtcbiAqIGNvbnN0IHNob3VsZE9taXQgPSAodmFsdWUpID0+IHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZyc7XG4gKiBjb25zdCByZXN1bHQgPSBvbWl0Qnkob2JqLCBzaG91bGRPbWl0KTtcbiAqIC8vIHJlc3VsdCB3aWxsIGJlIHsgYTogMSwgYzogMyB9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBvbWl0Qnk8VCBleHRlbmRzIFJlY29yZDxzdHJpbmcsIGFueT4+KFxuICBvYmo6IFQsXG4gIHNob3VsZE9taXQ6ICh2YWx1ZTogVFtrZXlvZiBUXSwga2V5OiBrZXlvZiBUKSA9PiBib29sZWFuXG4pOiBQYXJ0aWFsPFQ+IHtcbiAgY29uc3QgcmVzdWx0OiBQYXJ0aWFsPFQ+ID0ge307XG5cbiAgY29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKG9iaikgYXMgQXJyYXk8a2V5b2YgVD47XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBrZXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3Qga2V5ID0ga2V5c1tpXTtcbiAgICBjb25zdCB2YWx1ZSA9IG9ialtrZXldO1xuXG4gICAgaWYgKCFzaG91bGRPbWl0KHZhbHVlLCBrZXkpKSB7XG4gICAgICByZXN1bHRba2V5XSA9IHZhbHVlO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiByZXN1bHQ7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQWtCQyxHQUNELE9BQU8sU0FBUyxPQUNkLEdBQU0sRUFDTixVQUF3RDtFQUV4RCxNQUFNLFNBQXFCLENBQUM7RUFFNUIsTUFBTSxPQUFPLE9BQU8sSUFBSSxDQUFDO0VBRXpCLElBQUssSUFBSSxJQUFJLEdBQUcsSUFBSSxLQUFLLE1BQU0sRUFBRSxJQUFLO0lBQ3BDLE1BQU0sTUFBTSxJQUFJLENBQUMsRUFBRTtJQUNuQixNQUFNLFFBQVEsR0FBRyxDQUFDLElBQUk7SUFFdEIsSUFBSSxDQUFDLFdBQVcsT0FBTyxNQUFNO01BQzNCLE1BQU0sQ0FBQyxJQUFJLEdBQUc7SUFDaEI7RUFDRjtFQUVBLE9BQU87QUFDVCJ9
// denoCacheMetadata=4898176500762701321,6875008631225521265