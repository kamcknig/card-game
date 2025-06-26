import { difference } from './difference.ts';
/**
 * Checks if the `subset` array is entirely contained within the `superset` array.
 *
 *
 * @template T - The type of elements contained in the arrays.
 * @param {T[]} superset - The array that may contain all elements of the subset.
 * @param {T[]} subset - The array to check against the superset.
 * @returns {boolean} - Returns `true` if all elements of the `subset` are present in the `superset`, otherwise returns `false`.
 *
 * @example
 * ```typescript
 * const superset = [1, 2, 3, 4, 5];
 * const subset = [2, 3, 4];
 * isSubset(superset, subset); // true
 * ```
 *
 * @example
 * ```typescript
 * const superset = ['a', 'b', 'c'];
 * const subset = ['a', 'd'];
 * isSubset(superset, subset); // false
 * ```
 */ export function isSubset(superset, subset) {
  return difference(subset, superset).length === 0;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9hcnJheS9pc1N1YnNldC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBkaWZmZXJlbmNlIH0gZnJvbSAnLi9kaWZmZXJlbmNlLnRzJztcblxuLyoqXG4gKiBDaGVja3MgaWYgdGhlIGBzdWJzZXRgIGFycmF5IGlzIGVudGlyZWx5IGNvbnRhaW5lZCB3aXRoaW4gdGhlIGBzdXBlcnNldGAgYXJyYXkuXG4gKlxuICpcbiAqIEB0ZW1wbGF0ZSBUIC0gVGhlIHR5cGUgb2YgZWxlbWVudHMgY29udGFpbmVkIGluIHRoZSBhcnJheXMuXG4gKiBAcGFyYW0ge1RbXX0gc3VwZXJzZXQgLSBUaGUgYXJyYXkgdGhhdCBtYXkgY29udGFpbiBhbGwgZWxlbWVudHMgb2YgdGhlIHN1YnNldC5cbiAqIEBwYXJhbSB7VFtdfSBzdWJzZXQgLSBUaGUgYXJyYXkgdG8gY2hlY2sgYWdhaW5zdCB0aGUgc3VwZXJzZXQuXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gLSBSZXR1cm5zIGB0cnVlYCBpZiBhbGwgZWxlbWVudHMgb2YgdGhlIGBzdWJzZXRgIGFyZSBwcmVzZW50IGluIHRoZSBgc3VwZXJzZXRgLCBvdGhlcndpc2UgcmV0dXJucyBgZmFsc2VgLlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBjb25zdCBzdXBlcnNldCA9IFsxLCAyLCAzLCA0LCA1XTtcbiAqIGNvbnN0IHN1YnNldCA9IFsyLCAzLCA0XTtcbiAqIGlzU3Vic2V0KHN1cGVyc2V0LCBzdWJzZXQpOyAvLyB0cnVlXG4gKiBgYGBcbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogY29uc3Qgc3VwZXJzZXQgPSBbJ2EnLCAnYicsICdjJ107XG4gKiBjb25zdCBzdWJzZXQgPSBbJ2EnLCAnZCddO1xuICogaXNTdWJzZXQoc3VwZXJzZXQsIHN1YnNldCk7IC8vIGZhbHNlXG4gKiBgYGBcbiAqL1xuXG5leHBvcnQgZnVuY3Rpb24gaXNTdWJzZXQ8VD4oc3VwZXJzZXQ6IHJlYWRvbmx5IFRbXSwgc3Vic2V0OiByZWFkb25seSBUW10pOiBib29sZWFuIHtcbiAgcmV0dXJuIGRpZmZlcmVuY2Uoc3Vic2V0LCBzdXBlcnNldCkubGVuZ3RoID09PSAwO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsVUFBVSxRQUFRLGtCQUFrQjtBQUU3Qzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQXNCQyxHQUVELE9BQU8sU0FBUyxTQUFZLFFBQXNCLEVBQUUsTUFBb0I7RUFDdEUsT0FBTyxXQUFXLFFBQVEsVUFBVSxNQUFNLEtBQUs7QUFDakQifQ==
// denoCacheMetadata=16628114787841836831,13677478481873023869