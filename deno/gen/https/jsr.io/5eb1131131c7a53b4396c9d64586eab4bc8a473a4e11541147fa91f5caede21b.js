/**
 * Escapes the RegExp special characters "^", "$", "\\", ".", "*", "+", "?", "(", ")", "[", "]", "{", "}", and "|" in `str`.
 *
 * @param {string} str The string to escape.
 * @returns {string} Returns the escaped string.
 *
 * @example
 * import { escapeRegExp } from 'es-toolkit/string';
 *
 * escapeRegExp('[es-toolkit](https://es-toolkit.slash.page/)'); // returns '\[es-toolkit\]\(https://es-toolkit\.slash\.page/\)'
 */ export function escapeRegExp(str) {
  return str.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9zdHJpbmcvZXNjYXBlUmVnRXhwLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogRXNjYXBlcyB0aGUgUmVnRXhwIHNwZWNpYWwgY2hhcmFjdGVycyBcIl5cIiwgXCIkXCIsIFwiXFxcXFwiLCBcIi5cIiwgXCIqXCIsIFwiK1wiLCBcIj9cIiwgXCIoXCIsIFwiKVwiLCBcIltcIiwgXCJdXCIsIFwie1wiLCBcIn1cIiwgYW5kIFwifFwiIGluIGBzdHJgLlxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSBzdHIgVGhlIHN0cmluZyB0byBlc2NhcGUuXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBSZXR1cm5zIHRoZSBlc2NhcGVkIHN0cmluZy5cbiAqXG4gKiBAZXhhbXBsZVxuICogaW1wb3J0IHsgZXNjYXBlUmVnRXhwIH0gZnJvbSAnZXMtdG9vbGtpdC9zdHJpbmcnO1xuICpcbiAqIGVzY2FwZVJlZ0V4cCgnW2VzLXRvb2xraXRdKGh0dHBzOi8vZXMtdG9vbGtpdC5zbGFzaC5wYWdlLyknKTsgLy8gcmV0dXJucyAnXFxbZXMtdG9vbGtpdFxcXVxcKGh0dHBzOi8vZXMtdG9vbGtpdFxcLnNsYXNoXFwucGFnZS9cXCknXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBlc2NhcGVSZWdFeHAoc3RyOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gc3RyLnJlcGxhY2UoL1tcXFxcXiQuKis/KClbXFxde318XS9nLCAnXFxcXCQmJyk7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7Ozs7Q0FVQyxHQUNELE9BQU8sU0FBUyxhQUFhLEdBQVc7RUFDdEMsT0FBTyxJQUFJLE9BQU8sQ0FBQyx1QkFBdUI7QUFDNUMifQ==
// denoCacheMetadata=3225243230982908682,4951876017388763172