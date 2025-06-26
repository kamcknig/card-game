import { isTypedArray as isTypedArrayToolkit } from '../../predicate/isTypedArray.ts';
/**
 * Checks if a value is a TypedArray.
 * @param {unknown} x The value to check.
 * @returns {x is
 *     Uint8Array
 *   | Uint8ClampedArray
 *   | Uint16Array
 *   | Uint32Array
 *   | BigUint64Array
 *   | Int8Array
 *   | Int16Array
 *   | Int32Array
 *   | BigInt64Array
 *   | Float32Array
 *   | Float64Array} Returns true if `x` is a TypedArray, false otherwise.
 *
 * @example
 * const arr = new Uint8Array([1, 2, 3]);
 * isTypedArray(arr); // true
 *
 * const regularArray = [1, 2, 3];
 * isTypedArray(regularArray); // false
 *
 * const buffer = new ArrayBuffer(16);
 * isTypedArray(buffer); // false
 */ export function isTypedArray(x) {
  return isTypedArrayToolkit(x);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvcHJlZGljYXRlL2lzVHlwZWRBcnJheS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBpc1R5cGVkQXJyYXkgYXMgaXNUeXBlZEFycmF5VG9vbGtpdCB9IGZyb20gJy4uLy4uL3ByZWRpY2F0ZS9pc1R5cGVkQXJyYXkudHMnO1xuXG4vKipcbiAqIENoZWNrcyBpZiBhIHZhbHVlIGlzIGEgVHlwZWRBcnJheS5cbiAqIEBwYXJhbSB7dW5rbm93bn0geCBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7eCBpc1xuICogICAgIFVpbnQ4QXJyYXlcbiAqICAgfCBVaW50OENsYW1wZWRBcnJheVxuICogICB8IFVpbnQxNkFycmF5XG4gKiAgIHwgVWludDMyQXJyYXlcbiAqICAgfCBCaWdVaW50NjRBcnJheVxuICogICB8IEludDhBcnJheVxuICogICB8IEludDE2QXJyYXlcbiAqICAgfCBJbnQzMkFycmF5XG4gKiAgIHwgQmlnSW50NjRBcnJheVxuICogICB8IEZsb2F0MzJBcnJheVxuICogICB8IEZsb2F0NjRBcnJheX0gUmV0dXJucyB0cnVlIGlmIGB4YCBpcyBhIFR5cGVkQXJyYXksIGZhbHNlIG90aGVyd2lzZS5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgYXJyID0gbmV3IFVpbnQ4QXJyYXkoWzEsIDIsIDNdKTtcbiAqIGlzVHlwZWRBcnJheShhcnIpOyAvLyB0cnVlXG4gKlxuICogY29uc3QgcmVndWxhckFycmF5ID0gWzEsIDIsIDNdO1xuICogaXNUeXBlZEFycmF5KHJlZ3VsYXJBcnJheSk7IC8vIGZhbHNlXG4gKlxuICogY29uc3QgYnVmZmVyID0gbmV3IEFycmF5QnVmZmVyKDE2KTtcbiAqIGlzVHlwZWRBcnJheShidWZmZXIpOyAvLyBmYWxzZVxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNUeXBlZEFycmF5KFxuICB4PzogdW5rbm93blxuKTogeCBpc1xuICB8IFVpbnQ4QXJyYXlcbiAgfCBVaW50OENsYW1wZWRBcnJheVxuICB8IFVpbnQxNkFycmF5XG4gIHwgVWludDMyQXJyYXlcbiAgfCBCaWdVaW50NjRBcnJheVxuICB8IEludDhBcnJheVxuICB8IEludDE2QXJyYXlcbiAgfCBJbnQzMkFycmF5XG4gIHwgQmlnSW50NjRBcnJheVxuICB8IEZsb2F0MzJBcnJheVxuICB8IEZsb2F0NjRBcnJheSB7XG4gIHJldHVybiBpc1R5cGVkQXJyYXlUb29sa2l0KHgpO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsZ0JBQWdCLG1CQUFtQixRQUFRLGtDQUFrQztBQUV0Rjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQXlCQyxHQUNELE9BQU8sU0FBUyxhQUNkLENBQVc7RUFhWCxPQUFPLG9CQUFvQjtBQUM3QiJ9
// denoCacheMetadata=12028971445052519570,7335950802869745366