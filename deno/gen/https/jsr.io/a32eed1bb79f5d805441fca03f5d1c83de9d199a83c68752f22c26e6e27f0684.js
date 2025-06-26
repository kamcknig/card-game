import { toNumber } from '../util/toNumber.ts';
/**
 * Invokes the specified function after a delay of the given number of milliseconds.
 * Any additional arguments are passed to the function when it is invoked.
 *
 * @param {(...args: any[]) => any} func - The function to delay.
 * @param {number} wait - The number of milliseconds to delay the invocation.
 * @param {...any[]} args - The arguments to pass to the function when it is invoked.
 * @returns {number} Returns the timer id.
 * @throws {TypeError} If the first argument is not a function.
 *
 * @example
 * // Example 1: Delayed function execution
 * const timerId = delay(
 *   (greeting, recipient) => {
 *     console.log(`${greeting}, ${recipient}!`);
 *   },
 *   1000,
 *   'Hello',
 *   'Alice'
 * );
 * // => 'Hello, Alice!' will be logged after one second.
 *
 * // Example 2: Clearing the timeout before execution
 * clearTimeout(timerId);
 * // The function will not be executed because the timeout was cleared.
 */ export function delay(func, wait, ...args) {
  if (typeof func !== 'function') {
    throw new TypeError('Expected a function');
  }
  return setTimeout(func, toNumber(wait) || 0, ...args);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvZnVuY3Rpb24vZGVsYXkudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgdG9OdW1iZXIgfSBmcm9tICcuLi91dGlsL3RvTnVtYmVyLnRzJztcblxuLyoqXG4gKiBJbnZva2VzIHRoZSBzcGVjaWZpZWQgZnVuY3Rpb24gYWZ0ZXIgYSBkZWxheSBvZiB0aGUgZ2l2ZW4gbnVtYmVyIG9mIG1pbGxpc2Vjb25kcy5cbiAqIEFueSBhZGRpdGlvbmFsIGFyZ3VtZW50cyBhcmUgcGFzc2VkIHRvIHRoZSBmdW5jdGlvbiB3aGVuIGl0IGlzIGludm9rZWQuXG4gKlxuICogQHBhcmFtIHsoLi4uYXJnczogYW55W10pID0+IGFueX0gZnVuYyAtIFRoZSBmdW5jdGlvbiB0byBkZWxheS5cbiAqIEBwYXJhbSB7bnVtYmVyfSB3YWl0IC0gVGhlIG51bWJlciBvZiBtaWxsaXNlY29uZHMgdG8gZGVsYXkgdGhlIGludm9jYXRpb24uXG4gKiBAcGFyYW0gey4uLmFueVtdfSBhcmdzIC0gVGhlIGFyZ3VtZW50cyB0byBwYXNzIHRvIHRoZSBmdW5jdGlvbiB3aGVuIGl0IGlzIGludm9rZWQuXG4gKiBAcmV0dXJucyB7bnVtYmVyfSBSZXR1cm5zIHRoZSB0aW1lciBpZC5cbiAqIEB0aHJvd3Mge1R5cGVFcnJvcn0gSWYgdGhlIGZpcnN0IGFyZ3VtZW50IGlzIG5vdCBhIGZ1bmN0aW9uLlxuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBFeGFtcGxlIDE6IERlbGF5ZWQgZnVuY3Rpb24gZXhlY3V0aW9uXG4gKiBjb25zdCB0aW1lcklkID0gZGVsYXkoXG4gKiAgIChncmVldGluZywgcmVjaXBpZW50KSA9PiB7XG4gKiAgICAgY29uc29sZS5sb2coYCR7Z3JlZXRpbmd9LCAke3JlY2lwaWVudH0hYCk7XG4gKiAgIH0sXG4gKiAgIDEwMDAsXG4gKiAgICdIZWxsbycsXG4gKiAgICdBbGljZSdcbiAqICk7XG4gKiAvLyA9PiAnSGVsbG8sIEFsaWNlIScgd2lsbCBiZSBsb2dnZWQgYWZ0ZXIgb25lIHNlY29uZC5cbiAqXG4gKiAvLyBFeGFtcGxlIDI6IENsZWFyaW5nIHRoZSB0aW1lb3V0IGJlZm9yZSBleGVjdXRpb25cbiAqIGNsZWFyVGltZW91dCh0aW1lcklkKTtcbiAqIC8vIFRoZSBmdW5jdGlvbiB3aWxsIG5vdCBiZSBleGVjdXRlZCBiZWNhdXNlIHRoZSB0aW1lb3V0IHdhcyBjbGVhcmVkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZGVsYXkoZnVuYzogKC4uLmFyZ3M6IGFueVtdKSA9PiBhbnksIHdhaXQ6IG51bWJlciwgLi4uYXJnczogYW55W10pOiBudW1iZXIge1xuICBpZiAodHlwZW9mIGZ1bmMgIT09ICdmdW5jdGlvbicpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdFeHBlY3RlZCBhIGZ1bmN0aW9uJyk7XG4gIH1cblxuICByZXR1cm4gc2V0VGltZW91dChmdW5jLCB0b051bWJlcih3YWl0KSB8fCAwLCAuLi5hcmdzKTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLFFBQVEsUUFBUSxzQkFBc0I7QUFFL0M7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0F5QkMsR0FDRCxPQUFPLFNBQVMsTUFBTSxJQUE2QixFQUFFLElBQVksRUFBRSxHQUFHLElBQVc7RUFDL0UsSUFBSSxPQUFPLFNBQVMsWUFBWTtJQUM5QixNQUFNLElBQUksVUFBVTtFQUN0QjtFQUVBLE9BQU8sV0FBVyxNQUFNLFNBQVMsU0FBUyxNQUFNO0FBQ2xEIn0=
// denoCacheMetadata=9467875854063625846,15530109375386105381