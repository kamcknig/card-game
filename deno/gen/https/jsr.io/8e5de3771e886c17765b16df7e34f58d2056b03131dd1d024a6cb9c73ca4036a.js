/**
 * Converts `value` to a string key if it's not a string or symbol.
 *
 * @private
 * @param {*} value The value to inspect.
 * @returns {string|symbol} Returns the key.
 */ export function toKey(value) {
  if (Object.is(value, -0)) {
    return '-0';
  }
  return value.toString();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvX2ludGVybmFsL3RvS2V5LnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQ29udmVydHMgYHZhbHVlYCB0byBhIHN0cmluZyBrZXkgaWYgaXQncyBub3QgYSBzdHJpbmcgb3Igc3ltYm9sLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBpbnNwZWN0LlxuICogQHJldHVybnMge3N0cmluZ3xzeW1ib2x9IFJldHVybnMgdGhlIGtleS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRvS2V5KHZhbHVlOiBudW1iZXIpIHtcbiAgaWYgKE9iamVjdC5pcyh2YWx1ZSwgLTApKSB7XG4gICAgcmV0dXJuICctMCc7XG4gIH1cbiAgcmV0dXJuIHZhbHVlLnRvU3RyaW5nKCk7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztDQU1DLEdBQ0QsT0FBTyxTQUFTLE1BQU0sS0FBYTtFQUNqQyxJQUFJLE9BQU8sRUFBRSxDQUFDLE9BQU8sQ0FBQyxJQUFJO0lBQ3hCLE9BQU87RUFDVDtFQUNBLE9BQU8sTUFBTSxRQUFRO0FBQ3ZCIn0=
// denoCacheMetadata=5590080128967103182,4205705597261324010