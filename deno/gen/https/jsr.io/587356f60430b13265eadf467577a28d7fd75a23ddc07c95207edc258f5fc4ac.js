/**
 * Checks if a given value is a plain object.
 *
 * A plain object is an object created by the `{}` literal, `new Object()`, or
 * `Object.create(null)`.
 *
 * This function also handles objects with custom
 * `Symbol.toStringTag` properties.
 *
 * `Symbol.toStringTag` is a built-in symbol that a constructor can use to customize the
 * default string description of objects.
 *
 * @param {unknown} [object] - The value to check.
 * @returns {boolean} - True if the value is a plain object, otherwise false.
 *
 * @example
 * console.log(isPlainObject({})); // true
 * console.log(isPlainObject([])); // false
 * console.log(isPlainObject(null)); // false
 * console.log(isPlainObject(Object.create(null))); // true
 * console.log(isPlainObject(new Map())); // false
 */ export function isPlainObject(object) {
  if (typeof object !== 'object') {
    return false;
  }
  if (object == null) {
    return false;
  }
  if (Object.getPrototypeOf(object) === null) {
    return true;
  }
  if (Object.prototype.toString.call(object) !== '[object Object]') {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const tag = object[Symbol.toStringTag];
    if (tag == null) {
      return false;
    }
    const isTagReadonly = !Object.getOwnPropertyDescriptor(object, Symbol.toStringTag)?.writable;
    if (isTagReadonly) {
      return false;
    }
    return object.toString() === `[object ${tag}]`;
  }
  let proto = object;
  while(Object.getPrototypeOf(proto) !== null){
    proto = Object.getPrototypeOf(proto);
  }
  return Object.getPrototypeOf(object) === proto;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvcHJlZGljYXRlL2lzUGxhaW5PYmplY3QudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBDaGVja3MgaWYgYSBnaXZlbiB2YWx1ZSBpcyBhIHBsYWluIG9iamVjdC5cbiAqXG4gKiBBIHBsYWluIG9iamVjdCBpcyBhbiBvYmplY3QgY3JlYXRlZCBieSB0aGUgYHt9YCBsaXRlcmFsLCBgbmV3IE9iamVjdCgpYCwgb3JcbiAqIGBPYmplY3QuY3JlYXRlKG51bGwpYC5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIGFsc28gaGFuZGxlcyBvYmplY3RzIHdpdGggY3VzdG9tXG4gKiBgU3ltYm9sLnRvU3RyaW5nVGFnYCBwcm9wZXJ0aWVzLlxuICpcbiAqIGBTeW1ib2wudG9TdHJpbmdUYWdgIGlzIGEgYnVpbHQtaW4gc3ltYm9sIHRoYXQgYSBjb25zdHJ1Y3RvciBjYW4gdXNlIHRvIGN1c3RvbWl6ZSB0aGVcbiAqIGRlZmF1bHQgc3RyaW5nIGRlc2NyaXB0aW9uIG9mIG9iamVjdHMuXG4gKlxuICogQHBhcmFtIHt1bmtub3dufSBbb2JqZWN0XSAtIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSAtIFRydWUgaWYgdGhlIHZhbHVlIGlzIGEgcGxhaW4gb2JqZWN0LCBvdGhlcndpc2UgZmFsc2UuXG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnNvbGUubG9nKGlzUGxhaW5PYmplY3Qoe30pKTsgLy8gdHJ1ZVxuICogY29uc29sZS5sb2coaXNQbGFpbk9iamVjdChbXSkpOyAvLyBmYWxzZVxuICogY29uc29sZS5sb2coaXNQbGFpbk9iamVjdChudWxsKSk7IC8vIGZhbHNlXG4gKiBjb25zb2xlLmxvZyhpc1BsYWluT2JqZWN0KE9iamVjdC5jcmVhdGUobnVsbCkpKTsgLy8gdHJ1ZVxuICogY29uc29sZS5sb2coaXNQbGFpbk9iamVjdChuZXcgTWFwKCkpKTsgLy8gZmFsc2VcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzUGxhaW5PYmplY3Qob2JqZWN0PzogdW5rbm93bik6IGJvb2xlYW4ge1xuICBpZiAodHlwZW9mIG9iamVjdCAhPT0gJ29iamVjdCcpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBpZiAob2JqZWN0ID09IG51bGwpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBpZiAoT2JqZWN0LmdldFByb3RvdHlwZU9mKG9iamVjdCkgPT09IG51bGwpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIGlmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqZWN0KSAhPT0gJ1tvYmplY3QgT2JqZWN0XScpIHtcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L2Jhbi10cy1jb21tZW50XG4gICAgLy8gQHRzLWlnbm9yZVxuICAgIGNvbnN0IHRhZyA9IG9iamVjdFtTeW1ib2wudG9TdHJpbmdUYWddO1xuXG4gICAgaWYgKHRhZyA9PSBudWxsKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgY29uc3QgaXNUYWdSZWFkb25seSA9ICFPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKG9iamVjdCwgU3ltYm9sLnRvU3RyaW5nVGFnKT8ud3JpdGFibGU7XG5cbiAgICBpZiAoaXNUYWdSZWFkb25seSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiBvYmplY3QudG9TdHJpbmcoKSA9PT0gYFtvYmplY3QgJHt0YWd9XWA7XG4gIH1cblxuICBsZXQgcHJvdG8gPSBvYmplY3Q7XG5cbiAgd2hpbGUgKE9iamVjdC5nZXRQcm90b3R5cGVPZihwcm90bykgIT09IG51bGwpIHtcbiAgICBwcm90byA9IE9iamVjdC5nZXRQcm90b3R5cGVPZihwcm90byk7XG4gIH1cblxuICByZXR1cm4gT2JqZWN0LmdldFByb3RvdHlwZU9mKG9iamVjdCkgPT09IHByb3RvO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FxQkMsR0FDRCxPQUFPLFNBQVMsY0FBYyxNQUFnQjtFQUM1QyxJQUFJLE9BQU8sV0FBVyxVQUFVO0lBQzlCLE9BQU87RUFDVDtFQUVBLElBQUksVUFBVSxNQUFNO0lBQ2xCLE9BQU87RUFDVDtFQUVBLElBQUksT0FBTyxjQUFjLENBQUMsWUFBWSxNQUFNO0lBQzFDLE9BQU87RUFDVDtFQUVBLElBQUksT0FBTyxTQUFTLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxZQUFZLG1CQUFtQjtJQUNoRSw2REFBNkQ7SUFDN0QsYUFBYTtJQUNiLE1BQU0sTUFBTSxNQUFNLENBQUMsT0FBTyxXQUFXLENBQUM7SUFFdEMsSUFBSSxPQUFPLE1BQU07TUFDZixPQUFPO0lBQ1Q7SUFFQSxNQUFNLGdCQUFnQixDQUFDLE9BQU8sd0JBQXdCLENBQUMsUUFBUSxPQUFPLFdBQVcsR0FBRztJQUVwRixJQUFJLGVBQWU7TUFDakIsT0FBTztJQUNUO0lBRUEsT0FBTyxPQUFPLFFBQVEsT0FBTyxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsQ0FBQztFQUNoRDtFQUVBLElBQUksUUFBUTtFQUVaLE1BQU8sT0FBTyxjQUFjLENBQUMsV0FBVyxLQUFNO0lBQzVDLFFBQVEsT0FBTyxjQUFjLENBQUM7RUFDaEM7RUFFQSxPQUFPLE9BQU8sY0FBYyxDQUFDLFlBQVk7QUFDM0MifQ==
// denoCacheMetadata=5844535263757187437,4516345288376091439