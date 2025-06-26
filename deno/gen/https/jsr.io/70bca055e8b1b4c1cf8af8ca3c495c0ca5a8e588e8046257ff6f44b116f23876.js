import { isEqualWith } from './isEqualWith.ts';
import { noop } from '../function/noop.ts';
/**
 * Checks if two values are equal, including support for `Date`, `RegExp`, and deep object comparison.
 *
 * @param {unknown} a - The first value to compare.
 * @param {unknown} b - The second value to compare.
 * @returns {boolean} `true` if the values are equal, otherwise `false`.
 *
 * @example
 * isEqual(1, 1); // true
 * isEqual({ a: 1 }, { a: 1 }); // true
 * isEqual(/abc/g, /abc/g); // true
 * isEqual(new Date('2020-01-01'), new Date('2020-01-01')); // true
 * isEqual([1, 2, 3], [1, 2, 3]); // true
 */ export function isEqual(a, b) {
  return isEqualWith(a, b, noop);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9wcmVkaWNhdGUvaXNFcXVhbC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBpc0VxdWFsV2l0aCB9IGZyb20gJy4vaXNFcXVhbFdpdGgudHMnO1xuaW1wb3J0IHsgbm9vcCB9IGZyb20gJy4uL2Z1bmN0aW9uL25vb3AudHMnO1xuXG4vKipcbiAqIENoZWNrcyBpZiB0d28gdmFsdWVzIGFyZSBlcXVhbCwgaW5jbHVkaW5nIHN1cHBvcnQgZm9yIGBEYXRlYCwgYFJlZ0V4cGAsIGFuZCBkZWVwIG9iamVjdCBjb21wYXJpc29uLlxuICpcbiAqIEBwYXJhbSB7dW5rbm93bn0gYSAtIFRoZSBmaXJzdCB2YWx1ZSB0byBjb21wYXJlLlxuICogQHBhcmFtIHt1bmtub3dufSBiIC0gVGhlIHNlY29uZCB2YWx1ZSB0byBjb21wYXJlLlxuICogQHJldHVybnMge2Jvb2xlYW59IGB0cnVlYCBpZiB0aGUgdmFsdWVzIGFyZSBlcXVhbCwgb3RoZXJ3aXNlIGBmYWxzZWAuXG4gKlxuICogQGV4YW1wbGVcbiAqIGlzRXF1YWwoMSwgMSk7IC8vIHRydWVcbiAqIGlzRXF1YWwoeyBhOiAxIH0sIHsgYTogMSB9KTsgLy8gdHJ1ZVxuICogaXNFcXVhbCgvYWJjL2csIC9hYmMvZyk7IC8vIHRydWVcbiAqIGlzRXF1YWwobmV3IERhdGUoJzIwMjAtMDEtMDEnKSwgbmV3IERhdGUoJzIwMjAtMDEtMDEnKSk7IC8vIHRydWVcbiAqIGlzRXF1YWwoWzEsIDIsIDNdLCBbMSwgMiwgM10pOyAvLyB0cnVlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc0VxdWFsKGE6IGFueSwgYjogYW55KTogYm9vbGVhbiB7XG4gIHJldHVybiBpc0VxdWFsV2l0aChhLCBiLCBub29wKTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLFdBQVcsUUFBUSxtQkFBbUI7QUFDL0MsU0FBUyxJQUFJLFFBQVEsc0JBQXNCO0FBRTNDOzs7Ozs7Ozs7Ozs7O0NBYUMsR0FDRCxPQUFPLFNBQVMsUUFBUSxDQUFNLEVBQUUsQ0FBTTtFQUNwQyxPQUFPLFlBQVksR0FBRyxHQUFHO0FBQzNCIn0=
// denoCacheMetadata=15142546171607807686,14734521006557751697