import { isMatch } from './isMatch.ts';
import { cloneDeep } from '../../object/cloneDeep.ts';
/**
 * Creates a function that performs a deep comparison between a given target and the source object.
 *
 * @param {unknown} source - The source object to create the matcher from.
 * @returns {(target: unknown) => boolean} - Returns a function that takes a target object and returns `true` if the target matches the source, otherwise `false`.
 *
 * @example
 * // Basic usage
 * const matcher = matches({ a: 1, b: 2 });
 * matcher({ a: 1, b: 2, c: 3 }); // true
 * matcher({ a: 1, c: 3 }); // false
 *
 * @example
 * // Matching arrays
 * const arrayMatcher = matches([1, 2, 3]);
 * arrayMatcher([1, 2, 3, 4]); // true
 * arrayMatcher([4, 5, 6]); // false
 *
 * @example
 * // Matching objects with nested structures
 * const nestedMatcher = matches({ a: { b: 2 } });
 * nestedMatcher({ a: { b: 2, c: 3 } }); // true
 * nestedMatcher({ a: { c: 3 } }); // false
 */ export function matches(source) {
  source = cloneDeep(source);
  return (target)=>{
    return isMatch(target, source);
  };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvcHJlZGljYXRlL21hdGNoZXMudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgaXNNYXRjaCB9IGZyb20gJy4vaXNNYXRjaC50cyc7XG5pbXBvcnQgeyBjbG9uZURlZXAgfSBmcm9tICcuLi8uLi9vYmplY3QvY2xvbmVEZWVwLnRzJztcblxuLyoqXG4gKiBDcmVhdGVzIGEgZnVuY3Rpb24gdGhhdCBwZXJmb3JtcyBhIGRlZXAgY29tcGFyaXNvbiBiZXR3ZWVuIGEgZ2l2ZW4gdGFyZ2V0IGFuZCB0aGUgc291cmNlIG9iamVjdC5cbiAqXG4gKiBAcGFyYW0ge3Vua25vd259IHNvdXJjZSAtIFRoZSBzb3VyY2Ugb2JqZWN0IHRvIGNyZWF0ZSB0aGUgbWF0Y2hlciBmcm9tLlxuICogQHJldHVybnMgeyh0YXJnZXQ6IHVua25vd24pID0+IGJvb2xlYW59IC0gUmV0dXJucyBhIGZ1bmN0aW9uIHRoYXQgdGFrZXMgYSB0YXJnZXQgb2JqZWN0IGFuZCByZXR1cm5zIGB0cnVlYCBpZiB0aGUgdGFyZ2V0IG1hdGNoZXMgdGhlIHNvdXJjZSwgb3RoZXJ3aXNlIGBmYWxzZWAuXG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIEJhc2ljIHVzYWdlXG4gKiBjb25zdCBtYXRjaGVyID0gbWF0Y2hlcyh7IGE6IDEsIGI6IDIgfSk7XG4gKiBtYXRjaGVyKHsgYTogMSwgYjogMiwgYzogMyB9KTsgLy8gdHJ1ZVxuICogbWF0Y2hlcih7IGE6IDEsIGM6IDMgfSk7IC8vIGZhbHNlXG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIE1hdGNoaW5nIGFycmF5c1xuICogY29uc3QgYXJyYXlNYXRjaGVyID0gbWF0Y2hlcyhbMSwgMiwgM10pO1xuICogYXJyYXlNYXRjaGVyKFsxLCAyLCAzLCA0XSk7IC8vIHRydWVcbiAqIGFycmF5TWF0Y2hlcihbNCwgNSwgNl0pOyAvLyBmYWxzZVxuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBNYXRjaGluZyBvYmplY3RzIHdpdGggbmVzdGVkIHN0cnVjdHVyZXNcbiAqIGNvbnN0IG5lc3RlZE1hdGNoZXIgPSBtYXRjaGVzKHsgYTogeyBiOiAyIH0gfSk7XG4gKiBuZXN0ZWRNYXRjaGVyKHsgYTogeyBiOiAyLCBjOiAzIH0gfSk7IC8vIHRydWVcbiAqIG5lc3RlZE1hdGNoZXIoeyBhOiB7IGM6IDMgfSB9KTsgLy8gZmFsc2VcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1hdGNoZXMoc291cmNlOiB1bmtub3duKTogKHRhcmdldDogdW5rbm93bikgPT4gYm9vbGVhbiB7XG4gIHNvdXJjZSA9IGNsb25lRGVlcChzb3VyY2UpO1xuXG4gIHJldHVybiAodGFyZ2V0PzogdW5rbm93bik6IGJvb2xlYW4gPT4ge1xuICAgIHJldHVybiBpc01hdGNoKHRhcmdldCwgc291cmNlKTtcbiAgfTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLE9BQU8sUUFBUSxlQUFlO0FBQ3ZDLFNBQVMsU0FBUyxRQUFRLDRCQUE0QjtBQUV0RDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0F1QkMsR0FDRCxPQUFPLFNBQVMsUUFBUSxNQUFlO0VBQ3JDLFNBQVMsVUFBVTtFQUVuQixPQUFPLENBQUM7SUFDTixPQUFPLFFBQVEsUUFBUTtFQUN6QjtBQUNGIn0=
// denoCacheMetadata=8511795393211400253,3340902384043859827