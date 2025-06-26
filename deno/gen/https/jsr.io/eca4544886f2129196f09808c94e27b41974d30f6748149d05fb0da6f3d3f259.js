import { toFinite } from './toFinite.ts';
/**
 * Converts `value` to an integer.
 *
 * This function first converts `value` to a finite number. If the result has any decimal places,
 * they are removed by rounding down to the nearest whole number.
 *
 * @param {unknown} value - The value to convert.
 * @returns {number} Returns the number.
 *
 * @example
 * toInteger(3.2); // => 3
 * toInteger(Number.MIN_VALUE); // => 0
 * toInteger(Infinity); // => 1.7976931348623157e+308
 * toInteger('3.2'); // => 3
 * toInteger(Symbol.iterator); // => 0
 * toInteger(NaN); // => 0
 */ export function toInteger(value) {
  const finite = toFinite(value);
  const remainder = finite % 1;
  return remainder ? finite - remainder : finite;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvdXRpbC90b0ludGVnZXIudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgdG9GaW5pdGUgfSBmcm9tICcuL3RvRmluaXRlLnRzJztcblxuLyoqXG4gKiBDb252ZXJ0cyBgdmFsdWVgIHRvIGFuIGludGVnZXIuXG4gKlxuICogVGhpcyBmdW5jdGlvbiBmaXJzdCBjb252ZXJ0cyBgdmFsdWVgIHRvIGEgZmluaXRlIG51bWJlci4gSWYgdGhlIHJlc3VsdCBoYXMgYW55IGRlY2ltYWwgcGxhY2VzLFxuICogdGhleSBhcmUgcmVtb3ZlZCBieSByb3VuZGluZyBkb3duIHRvIHRoZSBuZWFyZXN0IHdob2xlIG51bWJlci5cbiAqXG4gKiBAcGFyYW0ge3Vua25vd259IHZhbHVlIC0gVGhlIHZhbHVlIHRvIGNvbnZlcnQuXG4gKiBAcmV0dXJucyB7bnVtYmVyfSBSZXR1cm5zIHRoZSBudW1iZXIuXG4gKlxuICogQGV4YW1wbGVcbiAqIHRvSW50ZWdlcigzLjIpOyAvLyA9PiAzXG4gKiB0b0ludGVnZXIoTnVtYmVyLk1JTl9WQUxVRSk7IC8vID0+IDBcbiAqIHRvSW50ZWdlcihJbmZpbml0eSk7IC8vID0+IDEuNzk3NjkzMTM0ODYyMzE1N2UrMzA4XG4gKiB0b0ludGVnZXIoJzMuMicpOyAvLyA9PiAzXG4gKiB0b0ludGVnZXIoU3ltYm9sLml0ZXJhdG9yKTsgLy8gPT4gMFxuICogdG9JbnRlZ2VyKE5hTik7IC8vID0+IDBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRvSW50ZWdlcih2YWx1ZT86IHVua25vd24pOiBudW1iZXIge1xuICBjb25zdCBmaW5pdGUgPSB0b0Zpbml0ZSh2YWx1ZSk7XG4gIGNvbnN0IHJlbWFpbmRlciA9IGZpbml0ZSAlIDE7XG5cbiAgcmV0dXJuIHJlbWFpbmRlciA/IGZpbml0ZSAtIHJlbWFpbmRlciA6IGZpbml0ZTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLFFBQVEsUUFBUSxnQkFBZ0I7QUFFekM7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FnQkMsR0FDRCxPQUFPLFNBQVMsVUFBVSxLQUFlO0VBQ3ZDLE1BQU0sU0FBUyxTQUFTO0VBQ3hCLE1BQU0sWUFBWSxTQUFTO0VBRTNCLE9BQU8sWUFBWSxTQUFTLFlBQVk7QUFDMUMifQ==
// denoCacheMetadata=15120244982403023660,18218562140330811740