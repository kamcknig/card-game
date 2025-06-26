/**
 * Defers invoking the `func` until the current call stack has cleared. Any additional arguments are provided to func when it's invoked.
 *
 * @param {F} func The function to defer.
 * @param {Parameters<F>} args The arguments to invoke `func` with.
 * @returns {number} Returns the timer id.
 *
 * @example
 * defer((text) => {
 *   console.log(text);
 * }, 'deferred');
 * // => Logs 'deferred' after the current call stack has cleared.
 */ export function defer(func, ...args) {
  if (typeof func !== 'function') {
    throw new TypeError('Expected a function');
  }
  return setTimeout(func, 1, ...args);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvZnVuY3Rpb24vZGVmZXIudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBEZWZlcnMgaW52b2tpbmcgdGhlIGBmdW5jYCB1bnRpbCB0aGUgY3VycmVudCBjYWxsIHN0YWNrIGhhcyBjbGVhcmVkLiBBbnkgYWRkaXRpb25hbCBhcmd1bWVudHMgYXJlIHByb3ZpZGVkIHRvIGZ1bmMgd2hlbiBpdCdzIGludm9rZWQuXG4gKlxuICogQHBhcmFtIHtGfSBmdW5jIFRoZSBmdW5jdGlvbiB0byBkZWZlci5cbiAqIEBwYXJhbSB7UGFyYW1ldGVyczxGPn0gYXJncyBUaGUgYXJndW1lbnRzIHRvIGludm9rZSBgZnVuY2Agd2l0aC5cbiAqIEByZXR1cm5zIHtudW1iZXJ9IFJldHVybnMgdGhlIHRpbWVyIGlkLlxuICpcbiAqIEBleGFtcGxlXG4gKiBkZWZlcigodGV4dCkgPT4ge1xuICogICBjb25zb2xlLmxvZyh0ZXh0KTtcbiAqIH0sICdkZWZlcnJlZCcpO1xuICogLy8gPT4gTG9ncyAnZGVmZXJyZWQnIGFmdGVyIHRoZSBjdXJyZW50IGNhbGwgc3RhY2sgaGFzIGNsZWFyZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkZWZlcjxGIGV4dGVuZHMgKC4uLmFyZ3M6IGFueVtdKSA9PiBhbnk+KGZ1bmM6IEYsIC4uLmFyZ3M6IFBhcmFtZXRlcnM8Rj4pOiBudW1iZXIge1xuICBpZiAodHlwZW9mIGZ1bmMgIT09ICdmdW5jdGlvbicpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdFeHBlY3RlZCBhIGZ1bmN0aW9uJyk7XG4gIH1cbiAgcmV0dXJuIHNldFRpbWVvdXQoZnVuYywgMSwgLi4uYXJncyk7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7Ozs7OztDQVlDLEdBQ0QsT0FBTyxTQUFTLE1BQXlDLElBQU8sRUFBRSxHQUFHLElBQW1CO0VBQ3RGLElBQUksT0FBTyxTQUFTLFlBQVk7SUFDOUIsTUFBTSxJQUFJLFVBQVU7RUFDdEI7RUFDQSxPQUFPLFdBQVcsTUFBTSxNQUFNO0FBQ2hDIn0=
// denoCacheMetadata=619459278456089623,6321726462950174751