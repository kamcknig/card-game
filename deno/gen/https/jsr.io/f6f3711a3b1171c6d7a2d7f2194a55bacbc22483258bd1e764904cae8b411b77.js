/**
 * Converts `string` to an integer of the specified radix. If `radix` is undefined or 0, a `radix` of 10 is used unless `string` is a hexadecimal, in which case a `radix` of 16 is used.
 *
 * @param {string} string The string to convert to an integer.
 * @param {number} radix The radix to use when converting the string to an integer. Defaults to `0`.
 * @param {unknown} guard Enables use as an iteratee for methods like `Array#map`.
 * @returns {number} Returns the converted integer.
 *
 * @example
 * parseInt('08'); // => 8
 * parseInt('0x20'); // => 32
 *
 * parseInt('08', 10); // => 8
 * parseInt('0x20', 16); // => 32
 *
 * ['6', '08', '10'].map(parseInt); // => [6, 8, 10]
 */ export function parseInt(string, radix = 0, guard) {
  if (guard) {
    radix = 0;
  }
  return Number.parseInt(string, radix);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvbWF0aC9wYXJzZUludC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIENvbnZlcnRzIGBzdHJpbmdgIHRvIGFuIGludGVnZXIgb2YgdGhlIHNwZWNpZmllZCByYWRpeC4gSWYgYHJhZGl4YCBpcyB1bmRlZmluZWQgb3IgMCwgYSBgcmFkaXhgIG9mIDEwIGlzIHVzZWQgdW5sZXNzIGBzdHJpbmdgIGlzIGEgaGV4YWRlY2ltYWwsIGluIHdoaWNoIGNhc2UgYSBgcmFkaXhgIG9mIDE2IGlzIHVzZWQuXG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IHN0cmluZyBUaGUgc3RyaW5nIHRvIGNvbnZlcnQgdG8gYW4gaW50ZWdlci5cbiAqIEBwYXJhbSB7bnVtYmVyfSByYWRpeCBUaGUgcmFkaXggdG8gdXNlIHdoZW4gY29udmVydGluZyB0aGUgc3RyaW5nIHRvIGFuIGludGVnZXIuIERlZmF1bHRzIHRvIGAwYC5cbiAqIEBwYXJhbSB7dW5rbm93bn0gZ3VhcmQgRW5hYmxlcyB1c2UgYXMgYW4gaXRlcmF0ZWUgZm9yIG1ldGhvZHMgbGlrZSBgQXJyYXkjbWFwYC5cbiAqIEByZXR1cm5zIHtudW1iZXJ9IFJldHVybnMgdGhlIGNvbnZlcnRlZCBpbnRlZ2VyLlxuICpcbiAqIEBleGFtcGxlXG4gKiBwYXJzZUludCgnMDgnKTsgLy8gPT4gOFxuICogcGFyc2VJbnQoJzB4MjAnKTsgLy8gPT4gMzJcbiAqXG4gKiBwYXJzZUludCgnMDgnLCAxMCk7IC8vID0+IDhcbiAqIHBhcnNlSW50KCcweDIwJywgMTYpOyAvLyA9PiAzMlxuICpcbiAqIFsnNicsICcwOCcsICcxMCddLm1hcChwYXJzZUludCk7IC8vID0+IFs2LCA4LCAxMF1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlSW50KHN0cmluZzogc3RyaW5nLCByYWRpeCA9IDAsIGd1YXJkPzogdW5rbm93bik6IG51bWJlciB7XG4gIGlmIChndWFyZCkge1xuICAgIHJhZGl4ID0gMDtcbiAgfVxuICByZXR1cm4gTnVtYmVyLnBhcnNlSW50KHN0cmluZywgcmFkaXgpO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7Ozs7O0NBZ0JDLEdBQ0QsT0FBTyxTQUFTLFNBQVMsTUFBYyxFQUFFLFFBQVEsQ0FBQyxFQUFFLEtBQWU7RUFDakUsSUFBSSxPQUFPO0lBQ1QsUUFBUTtFQUNWO0VBQ0EsT0FBTyxPQUFPLFFBQVEsQ0FBQyxRQUFRO0FBQ2pDIn0=
// denoCacheMetadata=4683198611867286177,981924949608392665