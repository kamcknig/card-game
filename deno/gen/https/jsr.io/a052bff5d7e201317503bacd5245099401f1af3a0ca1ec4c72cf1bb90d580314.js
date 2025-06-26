import { differenceWith } from './differenceWith.ts';
/**
 * Checks if the `subset` array is entirely contained within the `superset` array based on a custom equality function.
 *
 * This function takes two arrays and a custom comparison function. It returns a boolean indicating
 * whether all elements in the subset array are present in the superset array, as determined by the provided
 * custom equality function.
 *
 * @template T - The type of elements contained in the arrays.
 * @param {T[]} superset - The array that may contain all elements of the subset.
 * @param {T[]} subset - The array to check against the superset.
 * @param {(x: T, y: T) => boolean} areItemsEqual - A function to determine if two items are equal.
 * @returns {boolean} - Returns `true` if all elements of the subset are present in the superset
 * according to the custom equality function, otherwise returns `false`.
 *
 * @example
 * ```typescript
 * const superset = [{ id: 1 }, { id: 2 }, { id: 3 }];
 * const subset = [{ id: 2 }, { id: 1 }];
 * const areItemsEqual = (a, b) => a.id === b.id;
 * isSubsetWith(superset, subset, areItemsEqual); // true
 * ```
 *
 * @example
 * ```typescript
 * const superset = [{ id: 1 }, { id: 2 }, { id: 3 }];
 * const subset = [{ id: 4 }];
 * const areItemsEqual = (a, b) => a.id === b.id;
 * isSubsetWith(superset, subset, areItemsEqual); // false
 * ```
 */ export function isSubsetWith(superset, subset, areItemsEqual) {
  return differenceWith(subset, superset, areItemsEqual).length === 0;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9hcnJheS9pc1N1YnNldFdpdGgudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgZGlmZmVyZW5jZVdpdGggfSBmcm9tICcuL2RpZmZlcmVuY2VXaXRoLnRzJztcblxuLyoqXG4gKiBDaGVja3MgaWYgdGhlIGBzdWJzZXRgIGFycmF5IGlzIGVudGlyZWx5IGNvbnRhaW5lZCB3aXRoaW4gdGhlIGBzdXBlcnNldGAgYXJyYXkgYmFzZWQgb24gYSBjdXN0b20gZXF1YWxpdHkgZnVuY3Rpb24uXG4gKlxuICogVGhpcyBmdW5jdGlvbiB0YWtlcyB0d28gYXJyYXlzIGFuZCBhIGN1c3RvbSBjb21wYXJpc29uIGZ1bmN0aW9uLiBJdCByZXR1cm5zIGEgYm9vbGVhbiBpbmRpY2F0aW5nXG4gKiB3aGV0aGVyIGFsbCBlbGVtZW50cyBpbiB0aGUgc3Vic2V0IGFycmF5IGFyZSBwcmVzZW50IGluIHRoZSBzdXBlcnNldCBhcnJheSwgYXMgZGV0ZXJtaW5lZCBieSB0aGUgcHJvdmlkZWRcbiAqIGN1c3RvbSBlcXVhbGl0eSBmdW5jdGlvbi5cbiAqXG4gKiBAdGVtcGxhdGUgVCAtIFRoZSB0eXBlIG9mIGVsZW1lbnRzIGNvbnRhaW5lZCBpbiB0aGUgYXJyYXlzLlxuICogQHBhcmFtIHtUW119IHN1cGVyc2V0IC0gVGhlIGFycmF5IHRoYXQgbWF5IGNvbnRhaW4gYWxsIGVsZW1lbnRzIG9mIHRoZSBzdWJzZXQuXG4gKiBAcGFyYW0ge1RbXX0gc3Vic2V0IC0gVGhlIGFycmF5IHRvIGNoZWNrIGFnYWluc3QgdGhlIHN1cGVyc2V0LlxuICogQHBhcmFtIHsoeDogVCwgeTogVCkgPT4gYm9vbGVhbn0gYXJlSXRlbXNFcXVhbCAtIEEgZnVuY3Rpb24gdG8gZGV0ZXJtaW5lIGlmIHR3byBpdGVtcyBhcmUgZXF1YWwuXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gLSBSZXR1cm5zIGB0cnVlYCBpZiBhbGwgZWxlbWVudHMgb2YgdGhlIHN1YnNldCBhcmUgcHJlc2VudCBpbiB0aGUgc3VwZXJzZXRcbiAqIGFjY29yZGluZyB0byB0aGUgY3VzdG9tIGVxdWFsaXR5IGZ1bmN0aW9uLCBvdGhlcndpc2UgcmV0dXJucyBgZmFsc2VgLlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBjb25zdCBzdXBlcnNldCA9IFt7IGlkOiAxIH0sIHsgaWQ6IDIgfSwgeyBpZDogMyB9XTtcbiAqIGNvbnN0IHN1YnNldCA9IFt7IGlkOiAyIH0sIHsgaWQ6IDEgfV07XG4gKiBjb25zdCBhcmVJdGVtc0VxdWFsID0gKGEsIGIpID0+IGEuaWQgPT09IGIuaWQ7XG4gKiBpc1N1YnNldFdpdGgoc3VwZXJzZXQsIHN1YnNldCwgYXJlSXRlbXNFcXVhbCk7IC8vIHRydWVcbiAqIGBgYFxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBjb25zdCBzdXBlcnNldCA9IFt7IGlkOiAxIH0sIHsgaWQ6IDIgfSwgeyBpZDogMyB9XTtcbiAqIGNvbnN0IHN1YnNldCA9IFt7IGlkOiA0IH1dO1xuICogY29uc3QgYXJlSXRlbXNFcXVhbCA9IChhLCBiKSA9PiBhLmlkID09PSBiLmlkO1xuICogaXNTdWJzZXRXaXRoKHN1cGVyc2V0LCBzdWJzZXQsIGFyZUl0ZW1zRXF1YWwpOyAvLyBmYWxzZVxuICogYGBgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc1N1YnNldFdpdGg8VD4oXG4gIHN1cGVyc2V0OiByZWFkb25seSBUW10sXG4gIHN1YnNldDogcmVhZG9ubHkgVFtdLFxuICBhcmVJdGVtc0VxdWFsOiAoeDogVCwgeTogVCkgPT4gYm9vbGVhblxuKTogYm9vbGVhbiB7XG4gIHJldHVybiBkaWZmZXJlbmNlV2l0aChzdWJzZXQsIHN1cGVyc2V0LCBhcmVJdGVtc0VxdWFsKS5sZW5ndGggPT09IDA7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxjQUFjLFFBQVEsc0JBQXNCO0FBRXJEOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQTZCQyxHQUNELE9BQU8sU0FBUyxhQUNkLFFBQXNCLEVBQ3RCLE1BQW9CLEVBQ3BCLGFBQXNDO0VBRXRDLE9BQU8sZUFBZSxRQUFRLFVBQVUsZUFBZSxNQUFNLEtBQUs7QUFDcEUifQ==
// denoCacheMetadata=12799811799598679953,3705510672112532190