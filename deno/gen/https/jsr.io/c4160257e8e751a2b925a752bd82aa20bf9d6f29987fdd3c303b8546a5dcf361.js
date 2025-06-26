import { isArrayBuffer as isArrayBufferToolkit } from '../../predicate/isArrayBuffer.ts';
/**
 * Checks if a given value is `ArrayBuffer`.
 *
 * This function can also serve as a type predicate in TypeScript, narrowing the type of the argument to `ArrayBuffer`.
 *
 * @param {unknown} value The value to check if it is a `ArrayBuffer`.
 * @returns {value is ArrayBuffer} Returns `true` if `value` is a `ArrayBuffer`, else `false`.
 *
 * @example
 * const value1 = new ArrayBuffer();
 * const value2 = new Array();
 * const value3 = new Map();
 *
 * console.log(isArrayBuffer(value1)); // true
 * console.log(isArrayBuffer(value2)); // false
 * console.log(isArrayBuffer(value3)); // false
 */ export function isArrayBuffer(value) {
  return isArrayBufferToolkit(value);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvcHJlZGljYXRlL2lzQXJyYXlCdWZmZXIudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgaXNBcnJheUJ1ZmZlciBhcyBpc0FycmF5QnVmZmVyVG9vbGtpdCB9IGZyb20gJy4uLy4uL3ByZWRpY2F0ZS9pc0FycmF5QnVmZmVyLnRzJztcblxuLyoqXG4gKiBDaGVja3MgaWYgYSBnaXZlbiB2YWx1ZSBpcyBgQXJyYXlCdWZmZXJgLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gY2FuIGFsc28gc2VydmUgYXMgYSB0eXBlIHByZWRpY2F0ZSBpbiBUeXBlU2NyaXB0LCBuYXJyb3dpbmcgdGhlIHR5cGUgb2YgdGhlIGFyZ3VtZW50IHRvIGBBcnJheUJ1ZmZlcmAuXG4gKlxuICogQHBhcmFtIHt1bmtub3dufSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2sgaWYgaXQgaXMgYSBgQXJyYXlCdWZmZXJgLlxuICogQHJldHVybnMge3ZhbHVlIGlzIEFycmF5QnVmZmVyfSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGEgYEFycmF5QnVmZmVyYCwgZWxzZSBgZmFsc2VgLlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCB2YWx1ZTEgPSBuZXcgQXJyYXlCdWZmZXIoKTtcbiAqIGNvbnN0IHZhbHVlMiA9IG5ldyBBcnJheSgpO1xuICogY29uc3QgdmFsdWUzID0gbmV3IE1hcCgpO1xuICpcbiAqIGNvbnNvbGUubG9nKGlzQXJyYXlCdWZmZXIodmFsdWUxKSk7IC8vIHRydWVcbiAqIGNvbnNvbGUubG9nKGlzQXJyYXlCdWZmZXIodmFsdWUyKSk7IC8vIGZhbHNlXG4gKiBjb25zb2xlLmxvZyhpc0FycmF5QnVmZmVyKHZhbHVlMykpOyAvLyBmYWxzZVxuICovXG5cbmV4cG9ydCBmdW5jdGlvbiBpc0FycmF5QnVmZmVyKHZhbHVlPzogdW5rbm93bik6IHZhbHVlIGlzIEFycmF5QnVmZmVyIHtcbiAgcmV0dXJuIGlzQXJyYXlCdWZmZXJUb29sa2l0KHZhbHVlKTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLGlCQUFpQixvQkFBb0IsUUFBUSxtQ0FBbUM7QUFFekY7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FnQkMsR0FFRCxPQUFPLFNBQVMsY0FBYyxLQUFlO0VBQzNDLE9BQU8scUJBQXFCO0FBQzlCIn0=
// denoCacheMetadata=5615363565382831205,13300585044401324987