import { unzip as unzipToolkit } from '../../array/unzip.ts';
import { isArrayLikeObject } from '../predicate/isArrayLikeObject.ts';
/**
 * Gathers elements in the same position in an internal array
 * from a grouped array of elements and returns them as a new array.
 *
 * @template T - The type of elements in the nested array.
 * @param {T[][] | ArrayLike<ArrayLike<T>> | null | undefined} array - The nested array to unzip.
 * @returns {T[][]} A new array of unzipped elements.
 *
 * @example
 * const zipped = [['a', true, 1],['b', false, 2]];
 * const result = unzip(zipped);
 * // result will be [['a', 'b'], [true, false], [1, 2]]
 */ export function unzip(array) {
  if (!isArrayLikeObject(array) || !array.length) {
    return [];
  }
  if (Array.isArray(array)) {
    return unzipToolkit(array);
  }
  return unzipToolkit(Array.from(array, (value)=>Array.from(value)));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvYXJyYXkvdW56aXAudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgdW56aXAgYXMgdW56aXBUb29sa2l0IH0gZnJvbSAnLi4vLi4vYXJyYXkvdW56aXAudHMnO1xuaW1wb3J0IHsgaXNBcnJheUxpa2VPYmplY3QgfSBmcm9tICcuLi9wcmVkaWNhdGUvaXNBcnJheUxpa2VPYmplY3QudHMnO1xuXG4vKipcbiAqIEdhdGhlcnMgZWxlbWVudHMgaW4gdGhlIHNhbWUgcG9zaXRpb24gaW4gYW4gaW50ZXJuYWwgYXJyYXlcbiAqIGZyb20gYSBncm91cGVkIGFycmF5IG9mIGVsZW1lbnRzIGFuZCByZXR1cm5zIHRoZW0gYXMgYSBuZXcgYXJyYXkuXG4gKlxuICogQHRlbXBsYXRlIFQgLSBUaGUgdHlwZSBvZiBlbGVtZW50cyBpbiB0aGUgbmVzdGVkIGFycmF5LlxuICogQHBhcmFtIHtUW11bXSB8IEFycmF5TGlrZTxBcnJheUxpa2U8VD4+IHwgbnVsbCB8IHVuZGVmaW5lZH0gYXJyYXkgLSBUaGUgbmVzdGVkIGFycmF5IHRvIHVuemlwLlxuICogQHJldHVybnMge1RbXVtdfSBBIG5ldyBhcnJheSBvZiB1bnppcHBlZCBlbGVtZW50cy5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgemlwcGVkID0gW1snYScsIHRydWUsIDFdLFsnYicsIGZhbHNlLCAyXV07XG4gKiBjb25zdCByZXN1bHQgPSB1bnppcCh6aXBwZWQpO1xuICogLy8gcmVzdWx0IHdpbGwgYmUgW1snYScsICdiJ10sIFt0cnVlLCBmYWxzZV0sIFsxLCAyXV1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHVuemlwPFQ+KGFycmF5OiBUW11bXSB8IEFycmF5TGlrZTxBcnJheUxpa2U8VD4+IHwgbnVsbCB8IHVuZGVmaW5lZCk6IFRbXVtdIHtcbiAgaWYgKCFpc0FycmF5TGlrZU9iamVjdChhcnJheSkgfHwgIWFycmF5Lmxlbmd0aCkge1xuICAgIHJldHVybiBbXTtcbiAgfVxuICBpZiAoQXJyYXkuaXNBcnJheShhcnJheSkpIHtcbiAgICByZXR1cm4gdW56aXBUb29sa2l0KGFycmF5KTtcbiAgfVxuICByZXR1cm4gdW56aXBUb29sa2l0KEFycmF5LmZyb20oYXJyYXksIHZhbHVlID0+IEFycmF5LmZyb20odmFsdWUpKSk7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxTQUFTLFlBQVksUUFBUSx1QkFBdUI7QUFDN0QsU0FBUyxpQkFBaUIsUUFBUSxvQ0FBb0M7QUFFdEU7Ozs7Ozs7Ozs7OztDQVlDLEdBQ0QsT0FBTyxTQUFTLE1BQVMsS0FBeUQ7RUFDaEYsSUFBSSxDQUFDLGtCQUFrQixVQUFVLENBQUMsTUFBTSxNQUFNLEVBQUU7SUFDOUMsT0FBTyxFQUFFO0VBQ1g7RUFDQSxJQUFJLE1BQU0sT0FBTyxDQUFDLFFBQVE7SUFDeEIsT0FBTyxhQUFhO0VBQ3RCO0VBQ0EsT0FBTyxhQUFhLE1BQU0sSUFBSSxDQUFDLE9BQU8sQ0FBQSxRQUFTLE1BQU0sSUFBSSxDQUFDO0FBQzVEIn0=
// denoCacheMetadata=7918592175729218129,4935543776329859693