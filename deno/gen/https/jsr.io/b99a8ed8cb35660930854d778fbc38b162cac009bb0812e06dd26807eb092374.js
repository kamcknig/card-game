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
  return ArrayBuffer.isView(x) && !(x instanceof DataView);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9wcmVkaWNhdGUvaXNUeXBlZEFycmF5LnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQ2hlY2tzIGlmIGEgdmFsdWUgaXMgYSBUeXBlZEFycmF5LlxuICogQHBhcmFtIHt1bmtub3dufSB4IFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHt4IGlzXG4gKiAgICAgVWludDhBcnJheVxuICogICB8IFVpbnQ4Q2xhbXBlZEFycmF5XG4gKiAgIHwgVWludDE2QXJyYXlcbiAqICAgfCBVaW50MzJBcnJheVxuICogICB8IEJpZ1VpbnQ2NEFycmF5XG4gKiAgIHwgSW50OEFycmF5XG4gKiAgIHwgSW50MTZBcnJheVxuICogICB8IEludDMyQXJyYXlcbiAqICAgfCBCaWdJbnQ2NEFycmF5XG4gKiAgIHwgRmxvYXQzMkFycmF5XG4gKiAgIHwgRmxvYXQ2NEFycmF5fSBSZXR1cm5zIHRydWUgaWYgYHhgIGlzIGEgVHlwZWRBcnJheSwgZmFsc2Ugb3RoZXJ3aXNlLlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCBhcnIgPSBuZXcgVWludDhBcnJheShbMSwgMiwgM10pO1xuICogaXNUeXBlZEFycmF5KGFycik7IC8vIHRydWVcbiAqXG4gKiBjb25zdCByZWd1bGFyQXJyYXkgPSBbMSwgMiwgM107XG4gKiBpc1R5cGVkQXJyYXkocmVndWxhckFycmF5KTsgLy8gZmFsc2VcbiAqXG4gKiBjb25zdCBidWZmZXIgPSBuZXcgQXJyYXlCdWZmZXIoMTYpO1xuICogaXNUeXBlZEFycmF5KGJ1ZmZlcik7IC8vIGZhbHNlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc1R5cGVkQXJyYXkoXG4gIHg6IHVua25vd25cbik6IHggaXNcbiAgfCBVaW50OEFycmF5XG4gIHwgVWludDhDbGFtcGVkQXJyYXlcbiAgfCBVaW50MTZBcnJheVxuICB8IFVpbnQzMkFycmF5XG4gIHwgQmlnVWludDY0QXJyYXlcbiAgfCBJbnQ4QXJyYXlcbiAgfCBJbnQxNkFycmF5XG4gIHwgSW50MzJBcnJheVxuICB8IEJpZ0ludDY0QXJyYXlcbiAgfCBGbG9hdDMyQXJyYXlcbiAgfCBGbG9hdDY0QXJyYXkge1xuICByZXR1cm4gQXJyYXlCdWZmZXIuaXNWaWV3KHgpICYmICEoeCBpbnN0YW5jZW9mIERhdGFWaWV3KTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQXlCQyxHQUNELE9BQU8sU0FBUyxhQUNkLENBQVU7RUFhVixPQUFPLFlBQVksTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLGFBQWEsUUFBUTtBQUN6RCJ9
// denoCacheMetadata=5693413161387917680,2700006606033563596