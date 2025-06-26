/**
 * Creates a function that is restricted to invoking the provided function `func` once.
 * Repeated calls to the function will return the value from the first invocation.
 *
 * @template F - The type of function.
 * @param {F extends () => any} func - The function to restrict.
 * @returns {F} A new function that invokes `func` once and caches the result.
 *
 * @example
 * const initialize = once(() => {
 *   console.log('Initialized!');
 *   return true;
 * });
 *
 * initialize(); // Logs: 'Initialized!' and returns true
 * initialize(); // Returns true without logging
 */ /**
 * Creates a function that is restricted to invoking the provided function `func` once.
 * Repeated calls to the function will return the value from the first invocation.
 *
 * @template F - The type of function.
 * @param {F} func - The function to restrict.
 * @returns {(...args: Parameters<F>) => ReturnType<F>} A new function that invokes `func` once and caches the result.
 *
 * @example
 * const initialize = once(() => {
 *   console.log('Initialized!');
 *   return true;
 * });
 *
 * initialize(); // Logs: 'Initialized!' and returns true
 * initialize(); // Returns true without logging
 */ export function once(func) {
  let called = false;
  let cache;
  return function(...args) {
    if (!called) {
      called = true;
      cache = func(...args);
    }
    return cache;
  };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9mdW5jdGlvbi9vbmNlLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQ3JlYXRlcyBhIGZ1bmN0aW9uIHRoYXQgaXMgcmVzdHJpY3RlZCB0byBpbnZva2luZyB0aGUgcHJvdmlkZWQgZnVuY3Rpb24gYGZ1bmNgIG9uY2UuXG4gKiBSZXBlYXRlZCBjYWxscyB0byB0aGUgZnVuY3Rpb24gd2lsbCByZXR1cm4gdGhlIHZhbHVlIGZyb20gdGhlIGZpcnN0IGludm9jYXRpb24uXG4gKlxuICogQHRlbXBsYXRlIEYgLSBUaGUgdHlwZSBvZiBmdW5jdGlvbi5cbiAqIEBwYXJhbSB7RiBleHRlbmRzICgpID0+IGFueX0gZnVuYyAtIFRoZSBmdW5jdGlvbiB0byByZXN0cmljdC5cbiAqIEByZXR1cm5zIHtGfSBBIG5ldyBmdW5jdGlvbiB0aGF0IGludm9rZXMgYGZ1bmNgIG9uY2UgYW5kIGNhY2hlcyB0aGUgcmVzdWx0LlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCBpbml0aWFsaXplID0gb25jZSgoKSA9PiB7XG4gKiAgIGNvbnNvbGUubG9nKCdJbml0aWFsaXplZCEnKTtcbiAqICAgcmV0dXJuIHRydWU7XG4gKiB9KTtcbiAqXG4gKiBpbml0aWFsaXplKCk7IC8vIExvZ3M6ICdJbml0aWFsaXplZCEnIGFuZCByZXR1cm5zIHRydWVcbiAqIGluaXRpYWxpemUoKTsgLy8gUmV0dXJucyB0cnVlIHdpdGhvdXQgbG9nZ2luZ1xuICovXG5leHBvcnQgZnVuY3Rpb24gb25jZTxGIGV4dGVuZHMgKCkgPT4gYW55PihmdW5jOiBGKTogRjtcbi8qKlxuICogQ3JlYXRlcyBhIGZ1bmN0aW9uIHRoYXQgaXMgcmVzdHJpY3RlZCB0byBpbnZva2luZyB0aGUgcHJvdmlkZWQgZnVuY3Rpb24gYGZ1bmNgIG9uY2UuXG4gKiBSZXBlYXRlZCBjYWxscyB0byB0aGUgZnVuY3Rpb24gd2lsbCByZXR1cm4gdGhlIHZhbHVlIGZyb20gdGhlIGZpcnN0IGludm9jYXRpb24uXG4gKlxuICogQHRlbXBsYXRlIEYgLSBUaGUgdHlwZSBvZiBmdW5jdGlvbi5cbiAqIEBwYXJhbSB7RiBleHRlbmRzICguLi5hcmdzOiBhbnlbXSkgPT4gdm9pZH0gZnVuYyAtIFRoZSBmdW5jdGlvbiB0byByZXN0cmljdCB3aXRoIGFyZ3VtZW50cy5cbiAqIEByZXR1cm5zIHtGfSBBIG5ldyBmdW5jdGlvbiB0aGF0IGludm9rZXMgYGZ1bmNgIG9uY2UuXG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IGxvZyA9IG9uY2UoY29uc29sZS5sb2cpO1xuICpcbiAqIGxvZygnSGVsbG8sIHdvcmxkIScpOyAvLyBwcmludHMgJ0hlbGxvLCB3b3JsZCEnIGFuZCBkb2Vzbid0IHJldHVybiBhbnl0aGluZ1xuICogbG9nKCdIZWxsbywgd29ybGQhJyk7IC8vIGRvZXNuJ3QgcHJpbnQgYW55dGhpbmcgYW5kIGRvZXNuJ3QgcmV0dXJuIGFueXRoaW5nXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBvbmNlPEYgZXh0ZW5kcyAoLi4uYXJnczogYW55W10pID0+IHZvaWQ+KGZ1bmM6IEYpOiBGO1xuLyoqXG4gKiBDcmVhdGVzIGEgZnVuY3Rpb24gdGhhdCBpcyByZXN0cmljdGVkIHRvIGludm9raW5nIHRoZSBwcm92aWRlZCBmdW5jdGlvbiBgZnVuY2Agb25jZS5cbiAqIFJlcGVhdGVkIGNhbGxzIHRvIHRoZSBmdW5jdGlvbiB3aWxsIHJldHVybiB0aGUgdmFsdWUgZnJvbSB0aGUgZmlyc3QgaW52b2NhdGlvbi5cbiAqXG4gKiBAdGVtcGxhdGUgRiAtIFRoZSB0eXBlIG9mIGZ1bmN0aW9uLlxuICogQHBhcmFtIHtGfSBmdW5jIC0gVGhlIGZ1bmN0aW9uIHRvIHJlc3RyaWN0LlxuICogQHJldHVybnMgeyguLi5hcmdzOiBQYXJhbWV0ZXJzPEY+KSA9PiBSZXR1cm5UeXBlPEY+fSBBIG5ldyBmdW5jdGlvbiB0aGF0IGludm9rZXMgYGZ1bmNgIG9uY2UgYW5kIGNhY2hlcyB0aGUgcmVzdWx0LlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCBpbml0aWFsaXplID0gb25jZSgoKSA9PiB7XG4gKiAgIGNvbnNvbGUubG9nKCdJbml0aWFsaXplZCEnKTtcbiAqICAgcmV0dXJuIHRydWU7XG4gKiB9KTtcbiAqXG4gKiBpbml0aWFsaXplKCk7IC8vIExvZ3M6ICdJbml0aWFsaXplZCEnIGFuZCByZXR1cm5zIHRydWVcbiAqIGluaXRpYWxpemUoKTsgLy8gUmV0dXJucyB0cnVlIHdpdGhvdXQgbG9nZ2luZ1xuICovXG5leHBvcnQgZnVuY3Rpb24gb25jZTxGIGV4dGVuZHMgKCgpID0+IGFueSkgfCAoKC4uLmFyZ3M6IGFueVtdKSA9PiB2b2lkKT4oZnVuYzogRik6IEYge1xuICBsZXQgY2FsbGVkID0gZmFsc2U7XG4gIGxldCBjYWNoZTogUmV0dXJuVHlwZTxGPjtcblxuICByZXR1cm4gZnVuY3Rpb24gKC4uLmFyZ3M6IFBhcmFtZXRlcnM8Rj4pOiBSZXR1cm5UeXBlPEY+IHtcbiAgICBpZiAoIWNhbGxlZCkge1xuICAgICAgY2FsbGVkID0gdHJ1ZTtcbiAgICAgIGNhY2hlID0gZnVuYyguLi5hcmdzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gY2FjaGU7XG4gIH0gYXMgRjtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7Ozs7OztDQWdCQyxHQWlCRDs7Ozs7Ozs7Ozs7Ozs7OztDQWdCQyxHQUNELE9BQU8sU0FBUyxLQUF5RCxJQUFPO0VBQzlFLElBQUksU0FBUztFQUNiLElBQUk7RUFFSixPQUFPLFNBQVUsR0FBRyxJQUFtQjtJQUNyQyxJQUFJLENBQUMsUUFBUTtNQUNYLFNBQVM7TUFDVCxRQUFRLFFBQVE7SUFDbEI7SUFFQSxPQUFPO0VBQ1Q7QUFDRiJ9
// denoCacheMetadata=17972862102352375858,18213529061209971372