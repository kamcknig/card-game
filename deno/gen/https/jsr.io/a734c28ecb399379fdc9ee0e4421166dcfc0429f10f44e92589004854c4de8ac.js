import { get } from './get.ts';
import { has } from './has.ts';
import { set } from './set.ts';
import { isNil } from '../predicate/isNil.ts';
/**
 * Creates a new object composed of the picked object properties.
 *
 * This function takes an object and an array of keys, and returns a new object that
 * includes only the properties corresponding to the specified keys.
 *
 * @template T - The type of object.
 * @param {T | null | undefined} obj - The object to pick keys from.
 * @param {...any} keysArr - An array of keys to be picked from the object. received keys goes through a flattening process before being used.
 * @param {PropertyKey | PropertyKey[] | PropertyKey[][]}} keys - An array of keys to be picked from the object. received keys goes through a flattening process before being used.
 * @returns {Partial<T, K>} A new object with the specified keys picked.
 *
 * @example
 * const obj = { a: 1, b: 2, c: 3 };
 * const result = pick(obj, ['a', 'c']);
 * // result will be { a: 1, c: 3 }
 *
 * // each path can be passed individually as an argument
 * const obj = { a: 1, b: 2, c: 3 };
 * const result = pick(obj, 'a', 'c');
 *
 * // pick a key over a path
 * const obj = { 'a.b': 1, a: { b: 2 } };
 * const result = pick(obj, 'a.b');
 * // result will be { 'a.b': 1 }
 */ export function pick(obj, ...keysArr) {
  if (isNil(obj)) {
    return {};
  }
  const result = {};
  for(let i = 0; i < keysArr.length; i++){
    let keys = keysArr[i];
    switch(typeof keys){
      case 'object':
        {
          if (!Array.isArray(keys)) {
            // eslint-disable-next-line
            // @ts-ignore
            keys = Array.from(keys);
          }
          break;
        }
      case 'string':
      case 'symbol':
      case 'number':
        {
          keys = [
            keys
          ];
          break;
        }
    }
    for (const key of keys){
      const value = get(obj, key);
      if (value === undefined && !has(obj, key)) {
        continue;
      }
      if (typeof key === 'string' && Object.hasOwn(obj, key)) {
        result[key] = value;
      } else {
        set(result, key, value);
      }
    }
  }
  return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvb2JqZWN0L3BpY2sudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgZ2V0IH0gZnJvbSAnLi9nZXQudHMnO1xuaW1wb3J0IHsgaGFzIH0gZnJvbSAnLi9oYXMudHMnO1xuaW1wb3J0IHsgc2V0IH0gZnJvbSAnLi9zZXQudHMnO1xuaW1wb3J0IHsgaXNOaWwgfSBmcm9tICcuLi9wcmVkaWNhdGUvaXNOaWwudHMnO1xuXG4vKipcbiAqIENyZWF0ZXMgYSBuZXcgb2JqZWN0IGNvbXBvc2VkIG9mIHRoZSBwaWNrZWQgb2JqZWN0IHByb3BlcnRpZXMuXG4gKlxuICogVGhpcyBmdW5jdGlvbiB0YWtlcyBhbiBvYmplY3QgYW5kIGFuIGFycmF5IG9mIGtleXMsIGFuZCByZXR1cm5zIGEgbmV3IG9iamVjdCB0aGF0XG4gKiBpbmNsdWRlcyBvbmx5IHRoZSBwcm9wZXJ0aWVzIGNvcnJlc3BvbmRpbmcgdG8gdGhlIHNwZWNpZmllZCBrZXlzLlxuICpcbiAqIEB0ZW1wbGF0ZSBUIC0gVGhlIHR5cGUgb2Ygb2JqZWN0LlxuICogQHRlbXBsYXRlIEsgLSBUaGUgdHlwZSBvZiBrZXlzIGluIG9iamVjdC5cbiAqIEBwYXJhbSB7VH0gb2JqIC0gVGhlIG9iamVjdCB0byBwaWNrIGtleXMgZnJvbS5cbiAqIEBwYXJhbSB7S1tdfSBrZXlzIC0gQW4gYXJyYXkgb2Yga2V5cyB0byBiZSBwaWNrZWQgZnJvbSB0aGUgb2JqZWN0LlxuICogQHJldHVybnMge1BpY2s8VCwgSz59IEEgbmV3IG9iamVjdCB3aXRoIHRoZSBzcGVjaWZpZWQga2V5cyBwaWNrZWQuXG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IG9iaiA9IHsgYTogMSwgYjogMiwgYzogMyB9O1xuICogY29uc3QgcmVzdWx0ID0gcGljayhvYmosIFsnYScsICdjJ10pO1xuICogLy8gcmVzdWx0IHdpbGwgYmUgeyBhOiAxLCBjOiAzIH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBpY2s8VCBleHRlbmRzIFJlY29yZDxzdHJpbmcsIGFueT4sIEsgZXh0ZW5kcyBrZXlvZiBUPihvYmo6IFQsIGtleXM6IHJlYWRvbmx5IEtbXSk6IFBpY2s8VCwgSz47XG5cbi8qKlxuICogQ3JlYXRlcyBhIG5ldyBvYmplY3QgY29tcG9zZWQgb2YgdGhlIHBpY2tlZCBvYmplY3QgcHJvcGVydGllcy5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIHRha2VzIGFuIG9iamVjdCBhbmQgYW4gYXJyYXkgb2Yga2V5cywgYW5kIHJldHVybnMgYSBuZXcgb2JqZWN0IHRoYXRcbiAqIGluY2x1ZGVzIG9ubHkgdGhlIHByb3BlcnRpZXMgY29ycmVzcG9uZGluZyB0byB0aGUgc3BlY2lmaWVkIGtleXMuXG4gKlxuICogQHRlbXBsYXRlIFQgLSBUaGUgdHlwZSBvZiBvYmplY3QuXG4gKiBAcGFyYW0ge1QgfCBudWxsIHwgdW5kZWZpbmVkfSBvYmogLSBUaGUgb2JqZWN0IHRvIHBpY2sga2V5cyBmcm9tLlxuICogQHBhcmFtIHsuLi5hbnl9IGtleXNcbiAqIEBwYXJhbSB7UHJvcGVydHlLZXkgfCBQcm9wZXJ0eUtleVtdIHwgUHJvcGVydHlLZXlbXVtdfX0ga2V5cyAtIEFuIGFycmF5IG9mIGtleXMgdG8gYmUgcGlja2VkIGZyb20gdGhlIG9iamVjdC4gcmVjZWl2ZWQga2V5cyBnb2VzIHRocm91Z2ggYSBmbGF0dGVuaW5nIHByb2Nlc3MgYmVmb3JlIGJlaW5nIHVzZWQuXG4gKiBAcmV0dXJucyB7UGFydGlhbDxULCBLPn0gQSBuZXcgb2JqZWN0IHdpdGggdGhlIHNwZWNpZmllZCBrZXlzIHBpY2tlZC5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3Qgb2JqID0geyBhOiAxLCBiOiAyLCBjOiAzIH07XG4gKiBjb25zdCByZXN1bHQgPSBwaWNrKG9iaiwgWydhJywgJ2MnXSk7XG4gKiAvLyByZXN1bHQgd2lsbCBiZSB7IGE6IDEsIGM6IDMgfVxuICpcbiAqIC8vIGVhY2ggcGF0aCBjYW4gYmUgcGFzc2VkIGluZGl2aWR1YWxseSBhcyBhbiBhcmd1bWVudFxuICogY29uc3Qgb2JqID0geyBhOiAxLCBiOiAyLCBjOiAzIH07XG4gKiBjb25zdCByZXN1bHQgPSBwaWNrKG9iaiwgJ2EnLCAnYycpO1xuICpcbiAqIC8vIHBpY2sgYSBrZXkgb3ZlciBhIHBhdGhcbiAqIGNvbnN0IG9iaiA9IHsgJ2EuYic6IDEsIGE6IHsgYjogMiB9IH07XG4gKiBjb25zdCByZXN1bHQgPSBwaWNrKG9iaiwgJ2EuYicpO1xuICogLy8gcmVzdWx0IHdpbGwgYmUgeyAnYS5iJzogMSB9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwaWNrPFxuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmVcbiAgVCBleHRlbmRzIHt9LFxuPihcbiAgb2JqOiBUIHwgbnVsbCB8IHVuZGVmaW5lZCxcbiAgLi4ua2V5czogQXJyYXk8UHJvcGVydHlLZXkgfCByZWFkb25seSBQcm9wZXJ0eUtleVtdIHwgUmVhZG9ubHlBcnJheTxyZWFkb25seSBQcm9wZXJ0eUtleVtdPj5cbik6IFBhcnRpYWw8VD47XG5cbi8qKlxuICogQ3JlYXRlcyBhIG5ldyBvYmplY3QgY29tcG9zZWQgb2YgdGhlIHBpY2tlZCBvYmplY3QgcHJvcGVydGllcy5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIHRha2VzIGFuIG9iamVjdCBhbmQgYW4gYXJyYXkgb2Yga2V5cywgYW5kIHJldHVybnMgYSBuZXcgb2JqZWN0IHRoYXRcbiAqIGluY2x1ZGVzIG9ubHkgdGhlIHByb3BlcnRpZXMgY29ycmVzcG9uZGluZyB0byB0aGUgc3BlY2lmaWVkIGtleXMuXG4gKlxuICogQHRlbXBsYXRlIFQgLSBUaGUgdHlwZSBvZiBvYmplY3QuXG4gKiBAcGFyYW0ge1QgfCBudWxsIHwgdW5kZWZpbmVkfSBvYmogLSBUaGUgb2JqZWN0IHRvIHBpY2sga2V5cyBmcm9tLlxuICogQHBhcmFtIHsuLi5hbnl9IGtleXNBcnIgLSBBbiBhcnJheSBvZiBrZXlzIHRvIGJlIHBpY2tlZCBmcm9tIHRoZSBvYmplY3QuIHJlY2VpdmVkIGtleXMgZ29lcyB0aHJvdWdoIGEgZmxhdHRlbmluZyBwcm9jZXNzIGJlZm9yZSBiZWluZyB1c2VkLlxuICogQHBhcmFtIHtQcm9wZXJ0eUtleSB8IFByb3BlcnR5S2V5W10gfCBQcm9wZXJ0eUtleVtdW119fSBrZXlzIC0gQW4gYXJyYXkgb2Yga2V5cyB0byBiZSBwaWNrZWQgZnJvbSB0aGUgb2JqZWN0LiByZWNlaXZlZCBrZXlzIGdvZXMgdGhyb3VnaCBhIGZsYXR0ZW5pbmcgcHJvY2VzcyBiZWZvcmUgYmVpbmcgdXNlZC5cbiAqIEByZXR1cm5zIHtQYXJ0aWFsPFQsIEs+fSBBIG5ldyBvYmplY3Qgd2l0aCB0aGUgc3BlY2lmaWVkIGtleXMgcGlja2VkLlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCBvYmogPSB7IGE6IDEsIGI6IDIsIGM6IDMgfTtcbiAqIGNvbnN0IHJlc3VsdCA9IHBpY2sob2JqLCBbJ2EnLCAnYyddKTtcbiAqIC8vIHJlc3VsdCB3aWxsIGJlIHsgYTogMSwgYzogMyB9XG4gKlxuICogLy8gZWFjaCBwYXRoIGNhbiBiZSBwYXNzZWQgaW5kaXZpZHVhbGx5IGFzIGFuIGFyZ3VtZW50XG4gKiBjb25zdCBvYmogPSB7IGE6IDEsIGI6IDIsIGM6IDMgfTtcbiAqIGNvbnN0IHJlc3VsdCA9IHBpY2sob2JqLCAnYScsICdjJyk7XG4gKlxuICogLy8gcGljayBhIGtleSBvdmVyIGEgcGF0aFxuICogY29uc3Qgb2JqID0geyAnYS5iJzogMSwgYTogeyBiOiAyIH0gfTtcbiAqIGNvbnN0IHJlc3VsdCA9IHBpY2sob2JqLCAnYS5iJyk7XG4gKiAvLyByZXN1bHQgd2lsbCBiZSB7ICdhLmInOiAxIH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBpY2s8XG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZVxuICBUIGV4dGVuZHMge30sXG4+KFxuICBvYmo6IFQgfCBudWxsIHwgdW5kZWZpbmVkLFxuICAuLi5rZXlzQXJyOiBBcnJheTxQcm9wZXJ0eUtleSB8IHJlYWRvbmx5IFByb3BlcnR5S2V5W10gfCBSZWFkb25seUFycmF5PHJlYWRvbmx5IFByb3BlcnR5S2V5W10+PlxuKTogUGFydGlhbDxUPiB7XG4gIGlmIChpc05pbChvYmopKSB7XG4gICAgcmV0dXJuIHt9O1xuICB9XG5cbiAgY29uc3QgcmVzdWx0OiBhbnkgPSB7fTtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IGtleXNBcnIubGVuZ3RoOyBpKyspIHtcbiAgICBsZXQga2V5cyA9IGtleXNBcnJbaV07XG4gICAgc3dpdGNoICh0eXBlb2Yga2V5cykge1xuICAgICAgY2FzZSAnb2JqZWN0Jzoge1xuICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkoa2V5cykpIHtcbiAgICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmVcbiAgICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgICAga2V5cyA9IEFycmF5LmZyb20oa2V5cykgYXMgUHJvcGVydHlLZXlbXTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgJ3N0cmluZyc6XG4gICAgICBjYXNlICdzeW1ib2wnOlxuICAgICAgY2FzZSAnbnVtYmVyJzoge1xuICAgICAgICBrZXlzID0gW2tleXNdO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IGtleSBvZiBrZXlzKSB7XG4gICAgICBjb25zdCB2YWx1ZSA9IGdldChvYmosIGtleSk7XG5cbiAgICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkICYmICFoYXMob2JqLCBrZXkpKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAodHlwZW9mIGtleSA9PT0gJ3N0cmluZycgJiYgT2JqZWN0Lmhhc093bihvYmosIGtleSkpIHtcbiAgICAgICAgcmVzdWx0W2tleV0gPSB2YWx1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNldChyZXN1bHQsIGtleSwgdmFsdWUpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiByZXN1bHQ7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxHQUFHLFFBQVEsV0FBVztBQUMvQixTQUFTLEdBQUcsUUFBUSxXQUFXO0FBQy9CLFNBQVMsR0FBRyxRQUFRLFdBQVc7QUFDL0IsU0FBUyxLQUFLLFFBQVEsd0JBQXdCO0FBdUQ5Qzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQXlCQyxHQUNELE9BQU8sU0FBUyxLQUlkLEdBQXlCLEVBQ3pCLEdBQUcsT0FBNEY7RUFFL0YsSUFBSSxNQUFNLE1BQU07SUFDZCxPQUFPLENBQUM7RUFDVjtFQUVBLE1BQU0sU0FBYyxDQUFDO0VBRXJCLElBQUssSUFBSSxJQUFJLEdBQUcsSUFBSSxRQUFRLE1BQU0sRUFBRSxJQUFLO0lBQ3ZDLElBQUksT0FBTyxPQUFPLENBQUMsRUFBRTtJQUNyQixPQUFRLE9BQU87TUFDYixLQUFLO1FBQVU7VUFDYixJQUFJLENBQUMsTUFBTSxPQUFPLENBQUMsT0FBTztZQUN4QiwyQkFBMkI7WUFDM0IsYUFBYTtZQUNiLE9BQU8sTUFBTSxJQUFJLENBQUM7VUFDcEI7VUFDQTtRQUNGO01BQ0EsS0FBSztNQUNMLEtBQUs7TUFDTCxLQUFLO1FBQVU7VUFDYixPQUFPO1lBQUM7V0FBSztVQUNiO1FBQ0Y7SUFDRjtJQUVBLEtBQUssTUFBTSxPQUFPLEtBQU07TUFDdEIsTUFBTSxRQUFRLElBQUksS0FBSztNQUV2QixJQUFJLFVBQVUsYUFBYSxDQUFDLElBQUksS0FBSyxNQUFNO1FBQ3pDO01BQ0Y7TUFFQSxJQUFJLE9BQU8sUUFBUSxZQUFZLE9BQU8sTUFBTSxDQUFDLEtBQUssTUFBTTtRQUN0RCxNQUFNLENBQUMsSUFBSSxHQUFHO01BQ2hCLE9BQU87UUFDTCxJQUFJLFFBQVEsS0FBSztNQUNuQjtJQUNGO0VBQ0Y7RUFFQSxPQUFPO0FBQ1QifQ==
// denoCacheMetadata=3146352157560077312,11086897843134891585