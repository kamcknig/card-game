/**
 * Creates a new object with specified keys omitted.
 *
 * This function takes an object and an array of keys, and returns a new object that
 * excludes the properties corresponding to the specified keys.
 *
 * @template T - The type of object.
 * @template K - The type of keys in object.
 * @param {T} obj - The object to omit keys from.
 * @param {K[]} keys - An array of keys to be omitted from the object.
 * @returns {Omit<T, K>} A new object with the specified keys omitted.
 *
 * @example
 * const obj = { a: 1, b: 2, c: 3 };
 * const result = omit(obj, ['b', 'c']);
 * // result will be { a: 1 }
 */ export function omit(obj, keys) {
  const result = {
    ...obj
  };
  for(let i = 0; i < keys.length; i++){
    const key = keys[i];
    delete result[key];
  }
  return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9vYmplY3Qvb21pdC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIENyZWF0ZXMgYSBuZXcgb2JqZWN0IHdpdGggc3BlY2lmaWVkIGtleXMgb21pdHRlZC5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIHRha2VzIGFuIG9iamVjdCBhbmQgYW4gYXJyYXkgb2Yga2V5cywgYW5kIHJldHVybnMgYSBuZXcgb2JqZWN0IHRoYXRcbiAqIGV4Y2x1ZGVzIHRoZSBwcm9wZXJ0aWVzIGNvcnJlc3BvbmRpbmcgdG8gdGhlIHNwZWNpZmllZCBrZXlzLlxuICpcbiAqIEB0ZW1wbGF0ZSBUIC0gVGhlIHR5cGUgb2Ygb2JqZWN0LlxuICogQHRlbXBsYXRlIEsgLSBUaGUgdHlwZSBvZiBrZXlzIGluIG9iamVjdC5cbiAqIEBwYXJhbSB7VH0gb2JqIC0gVGhlIG9iamVjdCB0byBvbWl0IGtleXMgZnJvbS5cbiAqIEBwYXJhbSB7S1tdfSBrZXlzIC0gQW4gYXJyYXkgb2Yga2V5cyB0byBiZSBvbWl0dGVkIGZyb20gdGhlIG9iamVjdC5cbiAqIEByZXR1cm5zIHtPbWl0PFQsIEs+fSBBIG5ldyBvYmplY3Qgd2l0aCB0aGUgc3BlY2lmaWVkIGtleXMgb21pdHRlZC5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3Qgb2JqID0geyBhOiAxLCBiOiAyLCBjOiAzIH07XG4gKiBjb25zdCByZXN1bHQgPSBvbWl0KG9iaiwgWydiJywgJ2MnXSk7XG4gKiAvLyByZXN1bHQgd2lsbCBiZSB7IGE6IDEgfVxuICovXG5leHBvcnQgZnVuY3Rpb24gb21pdDxUIGV4dGVuZHMgUmVjb3JkPHN0cmluZywgYW55PiwgSyBleHRlbmRzIGtleW9mIFQ+KG9iajogVCwga2V5czogcmVhZG9ubHkgS1tdKTogT21pdDxULCBLPiB7XG4gIGNvbnN0IHJlc3VsdCA9IHsgLi4ub2JqIH07XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBrZXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3Qga2V5ID0ga2V5c1tpXTtcbiAgICBkZWxldGUgcmVzdWx0W2tleV07XG4gIH1cblxuICByZXR1cm4gcmVzdWx0IGFzIE9taXQ8VCwgSz47XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FnQkMsR0FDRCxPQUFPLFNBQVMsS0FBdUQsR0FBTSxFQUFFLElBQWtCO0VBQy9GLE1BQU0sU0FBUztJQUFFLEdBQUcsR0FBRztFQUFDO0VBRXhCLElBQUssSUFBSSxJQUFJLEdBQUcsSUFBSSxLQUFLLE1BQU0sRUFBRSxJQUFLO0lBQ3BDLE1BQU0sTUFBTSxJQUFJLENBQUMsRUFBRTtJQUNuQixPQUFPLE1BQU0sQ0FBQyxJQUFJO0VBQ3BCO0VBRUEsT0FBTztBQUNUIn0=
// denoCacheMetadata=4595143166115622810,3080852680645974460