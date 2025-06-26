import { get } from './get.ts';
import { isDeepKey } from '../_internal/isDeepKey.ts';
import { toKey } from '../_internal/toKey.ts';
import { toPath } from '../util/toPath.ts';
/**
 * Removes the property at the given path of the object.
 *
 * @param {unknown} obj - The object to modify.
 * @param {PropertyKey | readonly PropertyKey[]} path - The path of the property to unset.
 * @returns {boolean} - Returns true if the property is deleted, else false.
 *
 * @example
 * const obj = { a: { b: { c: 42 } } };
 * unset(obj, 'a.b.c'); // true
 * console.log(obj); // { a: { b: {} } }
 *
 * @example
 * const obj = { a: { b: { c: 42 } } };
 * unset(obj, ['a', 'b', 'c']); // true
 * console.log(obj); // { a: { b: {} } }
 */ export function unset(obj, path) {
  if (obj == null) {
    return true;
  }
  switch(typeof path){
    case 'symbol':
    case 'number':
    case 'object':
      {
        if (Array.isArray(path)) {
          return unsetWithPath(obj, path);
        }
        if (typeof path === 'number') {
          path = toKey(path);
        } else if (typeof path === 'object') {
          if (Object.is(path?.valueOf(), -0)) {
            path = '-0';
          } else {
            path = String(path);
          }
        }
        if (obj?.[path] === undefined) {
          return true;
        }
        try {
          delete obj[path];
          return true;
        } catch  {
          return false;
        }
      }
    case 'string':
      {
        if (obj?.[path] === undefined && isDeepKey(path)) {
          return unsetWithPath(obj, toPath(path));
        }
        try {
          delete obj[path];
          return true;
        } catch  {
          return false;
        }
      }
  }
}
function unsetWithPath(obj, path) {
  const parent = get(obj, path.slice(0, -1), obj);
  const lastKey = path[path.length - 1];
  if (parent?.[lastKey] === undefined) {
    return true;
  }
  try {
    delete parent[lastKey];
    return true;
  } catch  {
    return false;
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvb2JqZWN0L3Vuc2V0LnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGdldCB9IGZyb20gJy4vZ2V0LnRzJztcbmltcG9ydCB7IGlzRGVlcEtleSB9IGZyb20gJy4uL19pbnRlcm5hbC9pc0RlZXBLZXkudHMnO1xuaW1wb3J0IHsgdG9LZXkgfSBmcm9tICcuLi9faW50ZXJuYWwvdG9LZXkudHMnO1xuaW1wb3J0IHsgdG9QYXRoIH0gZnJvbSAnLi4vdXRpbC90b1BhdGgudHMnO1xuXG4vKipcbiAqIFJlbW92ZXMgdGhlIHByb3BlcnR5IGF0IHRoZSBnaXZlbiBwYXRoIG9mIHRoZSBvYmplY3QuXG4gKlxuICogQHBhcmFtIHt1bmtub3dufSBvYmogLSBUaGUgb2JqZWN0IHRvIG1vZGlmeS5cbiAqIEBwYXJhbSB7UHJvcGVydHlLZXkgfCByZWFkb25seSBQcm9wZXJ0eUtleVtdfSBwYXRoIC0gVGhlIHBhdGggb2YgdGhlIHByb3BlcnR5IHRvIHVuc2V0LlxuICogQHJldHVybnMge2Jvb2xlYW59IC0gUmV0dXJucyB0cnVlIGlmIHRoZSBwcm9wZXJ0eSBpcyBkZWxldGVkLCBlbHNlIGZhbHNlLlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCBvYmogPSB7IGE6IHsgYjogeyBjOiA0MiB9IH0gfTtcbiAqIHVuc2V0KG9iaiwgJ2EuYi5jJyk7IC8vIHRydWVcbiAqIGNvbnNvbGUubG9nKG9iaik7IC8vIHsgYTogeyBiOiB7fSB9IH1cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3Qgb2JqID0geyBhOiB7IGI6IHsgYzogNDIgfSB9IH07XG4gKiB1bnNldChvYmosIFsnYScsICdiJywgJ2MnXSk7IC8vIHRydWVcbiAqIGNvbnNvbGUubG9nKG9iaik7IC8vIHsgYTogeyBiOiB7fSB9IH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHVuc2V0KG9iajogYW55LCBwYXRoOiBQcm9wZXJ0eUtleSB8IHJlYWRvbmx5IFByb3BlcnR5S2V5W10pOiBib29sZWFuIHtcbiAgaWYgKG9iaiA9PSBudWxsKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBzd2l0Y2ggKHR5cGVvZiBwYXRoKSB7XG4gICAgY2FzZSAnc3ltYm9sJzpcbiAgICBjYXNlICdudW1iZXInOlxuICAgIGNhc2UgJ29iamVjdCc6IHtcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KHBhdGgpKSB7XG4gICAgICAgIHJldHVybiB1bnNldFdpdGhQYXRoKG9iaiwgcGF0aCk7XG4gICAgICB9XG5cbiAgICAgIGlmICh0eXBlb2YgcGF0aCA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgcGF0aCA9IHRvS2V5KHBhdGgpO1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2YgcGF0aCA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgaWYgKE9iamVjdC5pcyhwYXRoPy52YWx1ZU9mKCksIC0wKSkge1xuICAgICAgICAgIHBhdGggPSAnLTAnO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBhdGggPSBTdHJpbmcocGF0aCk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKG9iaj8uW3BhdGhdID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG5cbiAgICAgIHRyeSB7XG4gICAgICAgIGRlbGV0ZSBvYmpbcGF0aF07XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSBjYXRjaCB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG4gICAgY2FzZSAnc3RyaW5nJzoge1xuICAgICAgaWYgKG9iaj8uW3BhdGhdID09PSB1bmRlZmluZWQgJiYgaXNEZWVwS2V5KHBhdGgpKSB7XG4gICAgICAgIHJldHVybiB1bnNldFdpdGhQYXRoKG9iaiwgdG9QYXRoKHBhdGgpKTtcbiAgICAgIH1cblxuICAgICAgdHJ5IHtcbiAgICAgICAgZGVsZXRlIG9ialtwYXRoXTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiB1bnNldFdpdGhQYXRoKG9iajogdW5rbm93biwgcGF0aDogcmVhZG9ubHkgUHJvcGVydHlLZXlbXSk6IGJvb2xlYW4ge1xuICBjb25zdCBwYXJlbnQgPSBnZXQob2JqLCBwYXRoLnNsaWNlKDAsIC0xKSwgb2JqKTtcbiAgY29uc3QgbGFzdEtleSA9IHBhdGhbcGF0aC5sZW5ndGggLSAxXTtcblxuICBpZiAocGFyZW50Py5bbGFzdEtleV0gPT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgdHJ5IHtcbiAgICBkZWxldGUgcGFyZW50W2xhc3RLZXldO1xuICAgIHJldHVybiB0cnVlO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLEdBQUcsUUFBUSxXQUFXO0FBQy9CLFNBQVMsU0FBUyxRQUFRLDRCQUE0QjtBQUN0RCxTQUFTLEtBQUssUUFBUSx3QkFBd0I7QUFDOUMsU0FBUyxNQUFNLFFBQVEsb0JBQW9CO0FBRTNDOzs7Ozs7Ozs7Ozs7Ozs7O0NBZ0JDLEdBQ0QsT0FBTyxTQUFTLE1BQU0sR0FBUSxFQUFFLElBQTBDO0VBQ3hFLElBQUksT0FBTyxNQUFNO0lBQ2YsT0FBTztFQUNUO0VBRUEsT0FBUSxPQUFPO0lBQ2IsS0FBSztJQUNMLEtBQUs7SUFDTCxLQUFLO01BQVU7UUFDYixJQUFJLE1BQU0sT0FBTyxDQUFDLE9BQU87VUFDdkIsT0FBTyxjQUFjLEtBQUs7UUFDNUI7UUFFQSxJQUFJLE9BQU8sU0FBUyxVQUFVO1VBQzVCLE9BQU8sTUFBTTtRQUNmLE9BQU8sSUFBSSxPQUFPLFNBQVMsVUFBVTtVQUNuQyxJQUFJLE9BQU8sRUFBRSxDQUFDLE1BQU0sV0FBVyxDQUFDLElBQUk7WUFDbEMsT0FBTztVQUNULE9BQU87WUFDTCxPQUFPLE9BQU87VUFDaEI7UUFDRjtRQUVBLElBQUksS0FBSyxDQUFDLEtBQUssS0FBSyxXQUFXO1VBQzdCLE9BQU87UUFDVDtRQUVBLElBQUk7VUFDRixPQUFPLEdBQUcsQ0FBQyxLQUFLO1VBQ2hCLE9BQU87UUFDVCxFQUFFLE9BQU07VUFDTixPQUFPO1FBQ1Q7TUFDRjtJQUNBLEtBQUs7TUFBVTtRQUNiLElBQUksS0FBSyxDQUFDLEtBQUssS0FBSyxhQUFhLFVBQVUsT0FBTztVQUNoRCxPQUFPLGNBQWMsS0FBSyxPQUFPO1FBQ25DO1FBRUEsSUFBSTtVQUNGLE9BQU8sR0FBRyxDQUFDLEtBQUs7VUFDaEIsT0FBTztRQUNULEVBQUUsT0FBTTtVQUNOLE9BQU87UUFDVDtNQUNGO0VBQ0Y7QUFDRjtBQUVBLFNBQVMsY0FBYyxHQUFZLEVBQUUsSUFBNEI7RUFDL0QsTUFBTSxTQUFTLElBQUksS0FBSyxLQUFLLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSTtFQUMzQyxNQUFNLFVBQVUsSUFBSSxDQUFDLEtBQUssTUFBTSxHQUFHLEVBQUU7RUFFckMsSUFBSSxRQUFRLENBQUMsUUFBUSxLQUFLLFdBQVc7SUFDbkMsT0FBTztFQUNUO0VBRUEsSUFBSTtJQUNGLE9BQU8sTUFBTSxDQUFDLFFBQVE7SUFDdEIsT0FBTztFQUNULEVBQUUsT0FBTTtJQUNOLE9BQU87RUFDVDtBQUNGIn0=
// denoCacheMetadata=3003236519691470512,9335481680242223204