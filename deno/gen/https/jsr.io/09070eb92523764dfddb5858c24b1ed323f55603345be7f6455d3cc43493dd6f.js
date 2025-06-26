/**
 * Creates a new function that always returns `undefined`.
 *
 * @returns {() => undefined} Returns the new constant function.
 */ /**
 * Creates a new function that always returns `value`.
 *
 * @template T - The type of the value to return.
 * @param {T} value - The value to return from the new function.
 * @returns {() => T | undefined} Returns the new constant function.
 *
 * @example
 * const object = { a: 1 };
 * const returnsObject = constant(object);
 *
 * returnsObject(); // => { a: 1 }
 * returnsObject() === object; // => true
 */ export function constant(value) {
  return ()=>value;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvdXRpbC9jb25zdGFudC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIENyZWF0ZXMgYSBuZXcgZnVuY3Rpb24gdGhhdCBhbHdheXMgcmV0dXJucyBgdW5kZWZpbmVkYC5cbiAqXG4gKiBAcmV0dXJucyB7KCkgPT4gdW5kZWZpbmVkfSBSZXR1cm5zIHRoZSBuZXcgY29uc3RhbnQgZnVuY3Rpb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb25zdGFudCgpOiAoKSA9PiB1bmRlZmluZWQ7XG5cbi8qKlxuICogQ3JlYXRlcyBhIG5ldyBmdW5jdGlvbiB0aGF0IGFsd2F5cyByZXR1cm5zIGB2YWx1ZWAuXG4gKlxuICogQHRlbXBsYXRlIFQgLSBUaGUgdHlwZSBvZiB0aGUgdmFsdWUgdG8gcmV0dXJuLlxuICogQHBhcmFtIHtUfSB2YWx1ZSAtIFRoZSB2YWx1ZSB0byByZXR1cm4gZnJvbSB0aGUgbmV3IGZ1bmN0aW9uLlxuICogQHJldHVybnMgeygpID0+IFR9IFJldHVybnMgdGhlIG5ldyBjb25zdGFudCBmdW5jdGlvbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbnN0YW50PFQ+KHZhbHVlOiBUKTogKCkgPT4gVDtcblxuLyoqXG4gKiBDcmVhdGVzIGEgbmV3IGZ1bmN0aW9uIHRoYXQgYWx3YXlzIHJldHVybnMgYHZhbHVlYC5cbiAqXG4gKiBAdGVtcGxhdGUgVCAtIFRoZSB0eXBlIG9mIHRoZSB2YWx1ZSB0byByZXR1cm4uXG4gKiBAcGFyYW0ge1R9IHZhbHVlIC0gVGhlIHZhbHVlIHRvIHJldHVybiBmcm9tIHRoZSBuZXcgZnVuY3Rpb24uXG4gKiBAcmV0dXJucyB7KCkgPT4gVCB8IHVuZGVmaW5lZH0gUmV0dXJucyB0aGUgbmV3IGNvbnN0YW50IGZ1bmN0aW9uLlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCBvYmplY3QgPSB7IGE6IDEgfTtcbiAqIGNvbnN0IHJldHVybnNPYmplY3QgPSBjb25zdGFudChvYmplY3QpO1xuICpcbiAqIHJldHVybnNPYmplY3QoKTsgLy8gPT4geyBhOiAxIH1cbiAqIHJldHVybnNPYmplY3QoKSA9PT0gb2JqZWN0OyAvLyA9PiB0cnVlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb25zdGFudDxUPih2YWx1ZT86IFQpOiAoKSA9PiBUIHwgdW5kZWZpbmVkIHtcbiAgcmV0dXJuICgpID0+IHZhbHVlO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7O0NBSUMsR0FZRDs7Ozs7Ozs7Ozs7OztDQWFDLEdBQ0QsT0FBTyxTQUFTLFNBQVksS0FBUztFQUNuQyxPQUFPLElBQU07QUFDZiJ9
// denoCacheMetadata=16558048110980463888,8704115895095649894