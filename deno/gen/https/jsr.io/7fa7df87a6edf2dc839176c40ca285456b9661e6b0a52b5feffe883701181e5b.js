/**
 * Converts `value` to a string.
 *
 * An empty string is returned for `null` and `undefined` values.
 * The sign of `-0` is preserved.
 *
 * @param {unknown} value - The value to convert.
 * @returns {string} Returns the converted string.
 *
 * @example
 * toString(null) // returns ''
 * toString(undefined) // returns ''
 * toString(-0) // returns '-0'
 * toString([1, 2, -0]) // returns '1,2,-0'
 * toString([Symbol('a'), Symbol('b')]) // returns 'Symbol(a),Symbol(b)'
 */ export function toString(value) {
  if (value == null) {
    return '';
  }
  if (Array.isArray(value)) {
    return value.map(toString).join(',');
  }
  const result = String(value);
  if (result === '0' && Object.is(Number(value), -0)) {
    return '-0';
  }
  return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvdXRpbC90b1N0cmluZy50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIENvbnZlcnRzIGB2YWx1ZWAgdG8gYSBzdHJpbmcuXG4gKlxuICogQW4gZW1wdHkgc3RyaW5nIGlzIHJldHVybmVkIGZvciBgbnVsbGAgYW5kIGB1bmRlZmluZWRgIHZhbHVlcy5cbiAqIFRoZSBzaWduIG9mIGAtMGAgaXMgcHJlc2VydmVkLlxuICpcbiAqIEBwYXJhbSB7dW5rbm93bn0gdmFsdWUgLSBUaGUgdmFsdWUgdG8gY29udmVydC5cbiAqIEByZXR1cm5zIHtzdHJpbmd9IFJldHVybnMgdGhlIGNvbnZlcnRlZCBzdHJpbmcuXG4gKlxuICogQGV4YW1wbGVcbiAqIHRvU3RyaW5nKG51bGwpIC8vIHJldHVybnMgJydcbiAqIHRvU3RyaW5nKHVuZGVmaW5lZCkgLy8gcmV0dXJucyAnJ1xuICogdG9TdHJpbmcoLTApIC8vIHJldHVybnMgJy0wJ1xuICogdG9TdHJpbmcoWzEsIDIsIC0wXSkgLy8gcmV0dXJucyAnMSwyLC0wJ1xuICogdG9TdHJpbmcoW1N5bWJvbCgnYScpLCBTeW1ib2woJ2InKV0pIC8vIHJldHVybnMgJ1N5bWJvbChhKSxTeW1ib2woYiknXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0b1N0cmluZyh2YWx1ZT86IHVua25vd24pOiBzdHJpbmcge1xuICBpZiAodmFsdWUgPT0gbnVsbCkge1xuICAgIHJldHVybiAnJztcbiAgfVxuXG4gIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgIHJldHVybiB2YWx1ZS5tYXAodG9TdHJpbmcpLmpvaW4oJywnKTtcbiAgfVxuXG4gIGNvbnN0IHJlc3VsdCA9IFN0cmluZyh2YWx1ZSk7XG5cbiAgaWYgKHJlc3VsdCA9PT0gJzAnICYmIE9iamVjdC5pcyhOdW1iZXIodmFsdWUpLCAtMCkpIHtcbiAgICByZXR1cm4gJy0wJztcbiAgfVxuXG4gIHJldHVybiByZXN1bHQ7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7Ozs7Ozs7OztDQWVDLEdBQ0QsT0FBTyxTQUFTLFNBQVMsS0FBZTtFQUN0QyxJQUFJLFNBQVMsTUFBTTtJQUNqQixPQUFPO0VBQ1Q7RUFFQSxJQUFJLE1BQU0sT0FBTyxDQUFDLFFBQVE7SUFDeEIsT0FBTyxNQUFNLEdBQUcsQ0FBQyxVQUFVLElBQUksQ0FBQztFQUNsQztFQUVBLE1BQU0sU0FBUyxPQUFPO0VBRXRCLElBQUksV0FBVyxPQUFPLE9BQU8sRUFBRSxDQUFDLE9BQU8sUUFBUSxDQUFDLElBQUk7SUFDbEQsT0FBTztFQUNUO0VBRUEsT0FBTztBQUNUIn0=
// denoCacheMetadata=5957298079558591286,12332690383524766409