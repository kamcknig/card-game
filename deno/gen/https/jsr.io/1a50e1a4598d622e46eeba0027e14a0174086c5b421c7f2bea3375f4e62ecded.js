import { isBuffer as isBufferToolkit } from '../../predicate/isBuffer.ts';
/**
 * Checks if the given value is a Buffer instance.
 *
 * This function tests whether the provided value is an instance of Buffer.
 * It returns `true` if the value is a Buffer, and `false` otherwise.
 *
 * This function can also serve as a type predicate in TypeScript, narrowing the type of the argument to `Buffer`.
 *
 * @param {unknown} x - The value to check if it is a Buffer.
 * @returns {boolean} Returns `true` if `x` is a Buffer, else `false`.
 *
 * @example
 * const buffer = Buffer.from("test");
 * console.log(isBuffer(buffer)); // true
 *
 * const notBuffer = "not a buffer";
 * console.log(isBuffer(notBuffer)); // false
 */ export function isBuffer(x) {
  return isBufferToolkit(x);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvcHJlZGljYXRlL2lzQnVmZmVyLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGlzQnVmZmVyIGFzIGlzQnVmZmVyVG9vbGtpdCB9IGZyb20gJy4uLy4uL3ByZWRpY2F0ZS9pc0J1ZmZlci50cyc7XG5cbi8qKlxuICogQ2hlY2tzIGlmIHRoZSBnaXZlbiB2YWx1ZSBpcyBhIEJ1ZmZlciBpbnN0YW5jZS5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIHRlc3RzIHdoZXRoZXIgdGhlIHByb3ZpZGVkIHZhbHVlIGlzIGFuIGluc3RhbmNlIG9mIEJ1ZmZlci5cbiAqIEl0IHJldHVybnMgYHRydWVgIGlmIHRoZSB2YWx1ZSBpcyBhIEJ1ZmZlciwgYW5kIGBmYWxzZWAgb3RoZXJ3aXNlLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gY2FuIGFsc28gc2VydmUgYXMgYSB0eXBlIHByZWRpY2F0ZSBpbiBUeXBlU2NyaXB0LCBuYXJyb3dpbmcgdGhlIHR5cGUgb2YgdGhlIGFyZ3VtZW50IHRvIGBCdWZmZXJgLlxuICpcbiAqIEBwYXJhbSB7dW5rbm93bn0geCAtIFRoZSB2YWx1ZSB0byBjaGVjayBpZiBpdCBpcyBhIEJ1ZmZlci5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgeGAgaXMgYSBCdWZmZXIsIGVsc2UgYGZhbHNlYC5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgYnVmZmVyID0gQnVmZmVyLmZyb20oXCJ0ZXN0XCIpO1xuICogY29uc29sZS5sb2coaXNCdWZmZXIoYnVmZmVyKSk7IC8vIHRydWVcbiAqXG4gKiBjb25zdCBub3RCdWZmZXIgPSBcIm5vdCBhIGJ1ZmZlclwiO1xuICogY29uc29sZS5sb2coaXNCdWZmZXIobm90QnVmZmVyKSk7IC8vIGZhbHNlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc0J1ZmZlcih4PzogdW5rbm93bik6IGJvb2xlYW4ge1xuICByZXR1cm4gaXNCdWZmZXJUb29sa2l0KHgpO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsWUFBWSxlQUFlLFFBQVEsOEJBQThCO0FBRTFFOzs7Ozs7Ozs7Ozs7Ozs7OztDQWlCQyxHQUNELE9BQU8sU0FBUyxTQUFTLENBQVc7RUFDbEMsT0FBTyxnQkFBZ0I7QUFDekIifQ==
// denoCacheMetadata=10809051243012155630,14046865901216687314