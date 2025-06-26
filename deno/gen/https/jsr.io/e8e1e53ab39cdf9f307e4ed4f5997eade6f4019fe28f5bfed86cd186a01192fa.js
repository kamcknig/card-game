/**
 * Checks if the given value is an object. An object is a value that is
 * not a primitive type (string, number, boolean, symbol, null, or undefined).
 *
 * This function tests whether the provided value is an object or not.
 * It returns `true` if the value is an object, and `false` otherwise.
 *
 * This function can also serve as a type predicate in TypeScript, narrowing the type of the argument to an object value.
 *
 * @param {unknown} value - The value to check if it is an object.
 * @returns {value is object} `true` if the value is an object, `false` otherwise.
 *
 * @example
 * const value1 = {};
 * const value2 = [1, 2, 3];
 * const value3 = () => {};
 * const value4 = null;
 *
 * console.log(isObject(value1)); // true
 * console.log(isObject(value2)); // true
 * console.log(isObject(value3)); // true
 * console.log(isObject(value4)); // false
 */ export function isObject(value) {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvcHJlZGljYXRlL2lzT2JqZWN0LnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQ2hlY2tzIGlmIHRoZSBnaXZlbiB2YWx1ZSBpcyBhbiBvYmplY3QuIEFuIG9iamVjdCBpcyBhIHZhbHVlIHRoYXQgaXNcbiAqIG5vdCBhIHByaW1pdGl2ZSB0eXBlIChzdHJpbmcsIG51bWJlciwgYm9vbGVhbiwgc3ltYm9sLCBudWxsLCBvciB1bmRlZmluZWQpLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gdGVzdHMgd2hldGhlciB0aGUgcHJvdmlkZWQgdmFsdWUgaXMgYW4gb2JqZWN0IG9yIG5vdC5cbiAqIEl0IHJldHVybnMgYHRydWVgIGlmIHRoZSB2YWx1ZSBpcyBhbiBvYmplY3QsIGFuZCBgZmFsc2VgIG90aGVyd2lzZS5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIGNhbiBhbHNvIHNlcnZlIGFzIGEgdHlwZSBwcmVkaWNhdGUgaW4gVHlwZVNjcmlwdCwgbmFycm93aW5nIHRoZSB0eXBlIG9mIHRoZSBhcmd1bWVudCB0byBhbiBvYmplY3QgdmFsdWUuXG4gKlxuICogQHBhcmFtIHt1bmtub3dufSB2YWx1ZSAtIFRoZSB2YWx1ZSB0byBjaGVjayBpZiBpdCBpcyBhbiBvYmplY3QuXG4gKiBAcmV0dXJucyB7dmFsdWUgaXMgb2JqZWN0fSBgdHJ1ZWAgaWYgdGhlIHZhbHVlIGlzIGFuIG9iamVjdCwgYGZhbHNlYCBvdGhlcndpc2UuXG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IHZhbHVlMSA9IHt9O1xuICogY29uc3QgdmFsdWUyID0gWzEsIDIsIDNdO1xuICogY29uc3QgdmFsdWUzID0gKCkgPT4ge307XG4gKiBjb25zdCB2YWx1ZTQgPSBudWxsO1xuICpcbiAqIGNvbnNvbGUubG9nKGlzT2JqZWN0KHZhbHVlMSkpOyAvLyB0cnVlXG4gKiBjb25zb2xlLmxvZyhpc09iamVjdCh2YWx1ZTIpKTsgLy8gdHJ1ZVxuICogY29uc29sZS5sb2coaXNPYmplY3QodmFsdWUzKSk7IC8vIHRydWVcbiAqIGNvbnNvbGUubG9nKGlzT2JqZWN0KHZhbHVlNCkpOyAvLyBmYWxzZVxuICovXG5cbmV4cG9ydCBmdW5jdGlvbiBpc09iamVjdCh2YWx1ZT86IHVua25vd24pOiB2YWx1ZSBpcyBvYmplY3Qge1xuICByZXR1cm4gdmFsdWUgIT09IG51bGwgJiYgKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgfHwgdHlwZW9mIHZhbHVlID09PSAnZnVuY3Rpb24nKTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQXNCQyxHQUVELE9BQU8sU0FBUyxTQUFTLEtBQWU7RUFDdEMsT0FBTyxVQUFVLFFBQVEsQ0FBQyxPQUFPLFVBQVUsWUFBWSxPQUFPLFVBQVUsVUFBVTtBQUNwRiJ9
// denoCacheMetadata=17155083846606057362,8610649292505907617