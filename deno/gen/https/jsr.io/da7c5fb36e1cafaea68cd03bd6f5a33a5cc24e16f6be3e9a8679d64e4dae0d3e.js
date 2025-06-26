import { cloneDeep } from './cloneDeep.ts';
import { merge } from './merge.ts';
/**
 * Merges the properties of the source object into a deep clone of the target object.
 * Unlike `merge`, This function does not modify the original target object.
 *
 * This function performs a deep merge, meaning nested objects and arrays are merged recursively.
 *
 * - If a property in the source object is an array or object and the corresponding property in the target object is also an array or object, they will be merged.
 * - If a property in the source object is undefined, it will not overwrite a defined property in the target object.
 *
 * Note that this function does not mutate the target object.
 *
 * @param {T} target - The target object to be cloned and merged into. This object is not modified directly.
 * @param {S} source - The source object whose properties will be merged into the cloned target object.
 * @returns {T & S} A new object with properties from the source object merged into a deep clone of the target object.
 *
 * @template T - Type of the target object.
 * @template S - Type of the source object.
 *
 * @example
 * const target = { a: 1, b: { x: 1, y: 2 } };
 * const source = { b: { y: 3, z: 4 }, c: 5 };
 *
 * const result = toMerged(target, source);
 * console.log(result);
 * // Output: { a: 1, b: { x: 1, y: 3, z: 4 }, c: 5 }
 *
 * @example
 * const target = { a: [1, 2], b: { x: 1 } };
 * const source = { a: [3], b: { y: 2 } };
 *
 * const result = toMerged(target, source);
 * console.log(result);
 * // Output: { a: [3, 2], b: { x: 1, y: 2 } }
 *
 * @example
 * const target = { a: null };
 * const source = { a: [1, 2, 3] };
 *
 * const result = toMerged(target, source);
 * console.log(result);
 * // Output: { a: [1, 2, 3] }
 */ export function toMerged(target, source) {
  return merge(cloneDeep(target), source);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9vYmplY3QvdG9NZXJnZWQudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgY2xvbmVEZWVwIH0gZnJvbSAnLi9jbG9uZURlZXAudHMnO1xuaW1wb3J0IHsgbWVyZ2UgfSBmcm9tICcuL21lcmdlLnRzJztcblxuLyoqXG4gKiBNZXJnZXMgdGhlIHByb3BlcnRpZXMgb2YgdGhlIHNvdXJjZSBvYmplY3QgaW50byBhIGRlZXAgY2xvbmUgb2YgdGhlIHRhcmdldCBvYmplY3QuXG4gKiBVbmxpa2UgYG1lcmdlYCwgVGhpcyBmdW5jdGlvbiBkb2VzIG5vdCBtb2RpZnkgdGhlIG9yaWdpbmFsIHRhcmdldCBvYmplY3QuXG4gKlxuICogVGhpcyBmdW5jdGlvbiBwZXJmb3JtcyBhIGRlZXAgbWVyZ2UsIG1lYW5pbmcgbmVzdGVkIG9iamVjdHMgYW5kIGFycmF5cyBhcmUgbWVyZ2VkIHJlY3Vyc2l2ZWx5LlxuICpcbiAqIC0gSWYgYSBwcm9wZXJ0eSBpbiB0aGUgc291cmNlIG9iamVjdCBpcyBhbiBhcnJheSBvciBvYmplY3QgYW5kIHRoZSBjb3JyZXNwb25kaW5nIHByb3BlcnR5IGluIHRoZSB0YXJnZXQgb2JqZWN0IGlzIGFsc28gYW4gYXJyYXkgb3Igb2JqZWN0LCB0aGV5IHdpbGwgYmUgbWVyZ2VkLlxuICogLSBJZiBhIHByb3BlcnR5IGluIHRoZSBzb3VyY2Ugb2JqZWN0IGlzIHVuZGVmaW5lZCwgaXQgd2lsbCBub3Qgb3ZlcndyaXRlIGEgZGVmaW5lZCBwcm9wZXJ0eSBpbiB0aGUgdGFyZ2V0IG9iamVjdC5cbiAqXG4gKiBOb3RlIHRoYXQgdGhpcyBmdW5jdGlvbiBkb2VzIG5vdCBtdXRhdGUgdGhlIHRhcmdldCBvYmplY3QuXG4gKlxuICogQHBhcmFtIHtUfSB0YXJnZXQgLSBUaGUgdGFyZ2V0IG9iamVjdCB0byBiZSBjbG9uZWQgYW5kIG1lcmdlZCBpbnRvLiBUaGlzIG9iamVjdCBpcyBub3QgbW9kaWZpZWQgZGlyZWN0bHkuXG4gKiBAcGFyYW0ge1N9IHNvdXJjZSAtIFRoZSBzb3VyY2Ugb2JqZWN0IHdob3NlIHByb3BlcnRpZXMgd2lsbCBiZSBtZXJnZWQgaW50byB0aGUgY2xvbmVkIHRhcmdldCBvYmplY3QuXG4gKiBAcmV0dXJucyB7VCAmIFN9IEEgbmV3IG9iamVjdCB3aXRoIHByb3BlcnRpZXMgZnJvbSB0aGUgc291cmNlIG9iamVjdCBtZXJnZWQgaW50byBhIGRlZXAgY2xvbmUgb2YgdGhlIHRhcmdldCBvYmplY3QuXG4gKlxuICogQHRlbXBsYXRlIFQgLSBUeXBlIG9mIHRoZSB0YXJnZXQgb2JqZWN0LlxuICogQHRlbXBsYXRlIFMgLSBUeXBlIG9mIHRoZSBzb3VyY2Ugb2JqZWN0LlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCB0YXJnZXQgPSB7IGE6IDEsIGI6IHsgeDogMSwgeTogMiB9IH07XG4gKiBjb25zdCBzb3VyY2UgPSB7IGI6IHsgeTogMywgejogNCB9LCBjOiA1IH07XG4gKlxuICogY29uc3QgcmVzdWx0ID0gdG9NZXJnZWQodGFyZ2V0LCBzb3VyY2UpO1xuICogY29uc29sZS5sb2cocmVzdWx0KTtcbiAqIC8vIE91dHB1dDogeyBhOiAxLCBiOiB7IHg6IDEsIHk6IDMsIHo6IDQgfSwgYzogNSB9XG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IHRhcmdldCA9IHsgYTogWzEsIDJdLCBiOiB7IHg6IDEgfSB9O1xuICogY29uc3Qgc291cmNlID0geyBhOiBbM10sIGI6IHsgeTogMiB9IH07XG4gKlxuICogY29uc3QgcmVzdWx0ID0gdG9NZXJnZWQodGFyZ2V0LCBzb3VyY2UpO1xuICogY29uc29sZS5sb2cocmVzdWx0KTtcbiAqIC8vIE91dHB1dDogeyBhOiBbMywgMl0sIGI6IHsgeDogMSwgeTogMiB9IH1cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgdGFyZ2V0ID0geyBhOiBudWxsIH07XG4gKiBjb25zdCBzb3VyY2UgPSB7IGE6IFsxLCAyLCAzXSB9O1xuICpcbiAqIGNvbnN0IHJlc3VsdCA9IHRvTWVyZ2VkKHRhcmdldCwgc291cmNlKTtcbiAqIGNvbnNvbGUubG9nKHJlc3VsdCk7XG4gKiAvLyBPdXRwdXQ6IHsgYTogWzEsIDIsIDNdIH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRvTWVyZ2VkPFQgZXh0ZW5kcyBSZWNvcmQ8UHJvcGVydHlLZXksIGFueT4sIFMgZXh0ZW5kcyBSZWNvcmQ8UHJvcGVydHlLZXksIGFueT4+KFxuICB0YXJnZXQ6IFQsXG4gIHNvdXJjZTogU1xuKTogVCAmIFMge1xuICByZXR1cm4gbWVyZ2UoY2xvbmVEZWVwKHRhcmdldCksIHNvdXJjZSk7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxTQUFTLFFBQVEsaUJBQWlCO0FBQzNDLFNBQVMsS0FBSyxRQUFRLGFBQWE7QUFFbkM7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBeUNDLEdBQ0QsT0FBTyxTQUFTLFNBQ2QsTUFBUyxFQUNULE1BQVM7RUFFVCxPQUFPLE1BQU0sVUFBVSxTQUFTO0FBQ2xDIn0=
// denoCacheMetadata=16978213397556119923,5996844963633454373