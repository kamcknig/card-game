/**
 * Checks whether a value is a JavaScript primitive.
 * JavaScript primitives include null, undefined, strings, numbers, booleans, symbols, and bigints.
 *
 * @param {unknown} value The value to check.
 * @returns {value is
 *     null
 *   | undefined
 *   | string
 *   | number
 *   | boolean
 *   | symbol
 *   | bigint} Returns true if `value` is a primitive, false otherwise.
 *
 * @example
 * isPrimitive(null); // true
 * isPrimitive(undefined); // true
 * isPrimitive('123'); // true
 * isPrimitive(false); // true
 * isPrimitive(true); // true
 * isPrimitive(Symbol('a')); // true
 * isPrimitive(123n); // true
 * isPrimitive({}); // false
 * isPrimitive(new Date()); // false
 * isPrimitive(new Map()); // false
 * isPrimitive(new Set()); // false
 * isPrimitive([1, 2, 3]); // false
 */ export function isPrimitive(value) {
  return value == null || typeof value !== 'object' && typeof value !== 'function';
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9wcmVkaWNhdGUvaXNQcmltaXRpdmUudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBDaGVja3Mgd2hldGhlciBhIHZhbHVlIGlzIGEgSmF2YVNjcmlwdCBwcmltaXRpdmUuXG4gKiBKYXZhU2NyaXB0IHByaW1pdGl2ZXMgaW5jbHVkZSBudWxsLCB1bmRlZmluZWQsIHN0cmluZ3MsIG51bWJlcnMsIGJvb2xlYW5zLCBzeW1ib2xzLCBhbmQgYmlnaW50cy5cbiAqXG4gKiBAcGFyYW0ge3Vua25vd259IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHt2YWx1ZSBpc1xuICogICAgIG51bGxcbiAqICAgfCB1bmRlZmluZWRcbiAqICAgfCBzdHJpbmdcbiAqICAgfCBudW1iZXJcbiAqICAgfCBib29sZWFuXG4gKiAgIHwgc3ltYm9sXG4gKiAgIHwgYmlnaW50fSBSZXR1cm5zIHRydWUgaWYgYHZhbHVlYCBpcyBhIHByaW1pdGl2ZSwgZmFsc2Ugb3RoZXJ3aXNlLlxuICpcbiAqIEBleGFtcGxlXG4gKiBpc1ByaW1pdGl2ZShudWxsKTsgLy8gdHJ1ZVxuICogaXNQcmltaXRpdmUodW5kZWZpbmVkKTsgLy8gdHJ1ZVxuICogaXNQcmltaXRpdmUoJzEyMycpOyAvLyB0cnVlXG4gKiBpc1ByaW1pdGl2ZShmYWxzZSk7IC8vIHRydWVcbiAqIGlzUHJpbWl0aXZlKHRydWUpOyAvLyB0cnVlXG4gKiBpc1ByaW1pdGl2ZShTeW1ib2woJ2EnKSk7IC8vIHRydWVcbiAqIGlzUHJpbWl0aXZlKDEyM24pOyAvLyB0cnVlXG4gKiBpc1ByaW1pdGl2ZSh7fSk7IC8vIGZhbHNlXG4gKiBpc1ByaW1pdGl2ZShuZXcgRGF0ZSgpKTsgLy8gZmFsc2VcbiAqIGlzUHJpbWl0aXZlKG5ldyBNYXAoKSk7IC8vIGZhbHNlXG4gKiBpc1ByaW1pdGl2ZShuZXcgU2V0KCkpOyAvLyBmYWxzZVxuICogaXNQcmltaXRpdmUoWzEsIDIsIDNdKTsgLy8gZmFsc2VcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzUHJpbWl0aXZlKHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgbnVsbCB8IHVuZGVmaW5lZCB8IHN0cmluZyB8IG51bWJlciB8IGJvb2xlYW4gfCBzeW1ib2wgfCBiaWdpbnQge1xuICByZXR1cm4gdmFsdWUgPT0gbnVsbCB8fCAodHlwZW9mIHZhbHVlICE9PSAnb2JqZWN0JyAmJiB0eXBlb2YgdmFsdWUgIT09ICdmdW5jdGlvbicpO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0EyQkMsR0FDRCxPQUFPLFNBQVMsWUFBWSxLQUFjO0VBQ3hDLE9BQU8sU0FBUyxRQUFTLE9BQU8sVUFBVSxZQUFZLE9BQU8sVUFBVTtBQUN6RSJ9
// denoCacheMetadata=17375780034800426040,13930178896393048600