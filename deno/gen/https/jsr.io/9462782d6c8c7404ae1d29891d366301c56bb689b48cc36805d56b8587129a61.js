import { isDeepKey } from '../_internal/isDeepKey.ts';
import { isIndex } from '../_internal/isIndex.ts';
import { isArguments } from '../predicate/isArguments.ts';
import { toPath } from '../util/toPath.ts';
/**
 * Checks if a given path exists within an object.
 *
 * You can provide the path as a single property key, an array of property keys,
 * or a string representing a deep path.
 *
 * If the path is an index and the object is an array or an arguments object, the function will verify
 * if the index is valid and within the bounds of the array or arguments object, even if the array or
 * arguments object is sparse (i.e., not all indexes are defined).
 *
 * @param {object} object - The object to query.
 * @param {PropertyKey | PropertyKey[]} path - The path to check. This can be a single property key,
 *        an array of property keys, or a string representing a deep path.
 * @returns {boolean} Returns `true` if the path exists in the object, `false` otherwise.
 *
 * @example
 *
 * const obj = { a: { b: { c: 3 } } };
 *
 * has(obj, 'a'); // true
 * has(obj, ['a', 'b']); // true
 * has(obj, ['a', 'b', 'c']); // true
 * has(obj, 'a.b.c'); // true
 * has(obj, 'a.b.d'); // false
 * has(obj, ['a', 'b', 'c', 'd']); // false
 * has([], 0); // false
 * has([1, 2, 3], 2); // true
 * has([1, 2, 3], 5); // false
 */ export function has(object, path) {
  let resolvedPath;
  if (Array.isArray(path)) {
    resolvedPath = path;
  } else if (typeof path === 'string' && isDeepKey(path) && object?.[path] == null) {
    resolvedPath = toPath(path);
  } else {
    resolvedPath = [
      path
    ];
  }
  if (resolvedPath.length === 0) {
    return false;
  }
  let current = object;
  for(let i = 0; i < resolvedPath.length; i++){
    const key = resolvedPath[i];
    // Check if the current key is a direct property of the current object
    if (current == null || !Object.hasOwn(current, key)) {
      const isSparseIndex = (Array.isArray(current) || isArguments(current)) && isIndex(key) && key < current.length;
      if (!isSparseIndex) {
        return false;
      }
    }
    current = current[key];
  }
  return true;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvb2JqZWN0L2hhcy50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBpc0RlZXBLZXkgfSBmcm9tICcuLi9faW50ZXJuYWwvaXNEZWVwS2V5LnRzJztcbmltcG9ydCB7IGlzSW5kZXggfSBmcm9tICcuLi9faW50ZXJuYWwvaXNJbmRleC50cyc7XG5pbXBvcnQgeyBpc0FyZ3VtZW50cyB9IGZyb20gJy4uL3ByZWRpY2F0ZS9pc0FyZ3VtZW50cy50cyc7XG5pbXBvcnQgeyB0b1BhdGggfSBmcm9tICcuLi91dGlsL3RvUGF0aC50cyc7XG5cbi8qKlxuICogQ2hlY2tzIGlmIGEgZ2l2ZW4gcGF0aCBleGlzdHMgd2l0aGluIGFuIG9iamVjdC5cbiAqXG4gKiBZb3UgY2FuIHByb3ZpZGUgdGhlIHBhdGggYXMgYSBzaW5nbGUgcHJvcGVydHkga2V5LCBhbiBhcnJheSBvZiBwcm9wZXJ0eSBrZXlzLFxuICogb3IgYSBzdHJpbmcgcmVwcmVzZW50aW5nIGEgZGVlcCBwYXRoLlxuICpcbiAqIElmIHRoZSBwYXRoIGlzIGFuIGluZGV4IGFuZCB0aGUgb2JqZWN0IGlzIGFuIGFycmF5IG9yIGFuIGFyZ3VtZW50cyBvYmplY3QsIHRoZSBmdW5jdGlvbiB3aWxsIHZlcmlmeVxuICogaWYgdGhlIGluZGV4IGlzIHZhbGlkIGFuZCB3aXRoaW4gdGhlIGJvdW5kcyBvZiB0aGUgYXJyYXkgb3IgYXJndW1lbnRzIG9iamVjdCwgZXZlbiBpZiB0aGUgYXJyYXkgb3JcbiAqIGFyZ3VtZW50cyBvYmplY3QgaXMgc3BhcnNlIChpLmUuLCBub3QgYWxsIGluZGV4ZXMgYXJlIGRlZmluZWQpLlxuICpcbiAqIEBwYXJhbSB7b2JqZWN0fSBvYmplY3QgLSBUaGUgb2JqZWN0IHRvIHF1ZXJ5LlxuICogQHBhcmFtIHtQcm9wZXJ0eUtleSB8IFByb3BlcnR5S2V5W119IHBhdGggLSBUaGUgcGF0aCB0byBjaGVjay4gVGhpcyBjYW4gYmUgYSBzaW5nbGUgcHJvcGVydHkga2V5LFxuICogICAgICAgIGFuIGFycmF5IG9mIHByb3BlcnR5IGtleXMsIG9yIGEgc3RyaW5nIHJlcHJlc2VudGluZyBhIGRlZXAgcGF0aC5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgcGF0aCBleGlzdHMgaW4gdGhlIG9iamVjdCwgYGZhbHNlYCBvdGhlcndpc2UuXG4gKlxuICogQGV4YW1wbGVcbiAqXG4gKiBjb25zdCBvYmogPSB7IGE6IHsgYjogeyBjOiAzIH0gfSB9O1xuICpcbiAqIGhhcyhvYmosICdhJyk7IC8vIHRydWVcbiAqIGhhcyhvYmosIFsnYScsICdiJ10pOyAvLyB0cnVlXG4gKiBoYXMob2JqLCBbJ2EnLCAnYicsICdjJ10pOyAvLyB0cnVlXG4gKiBoYXMob2JqLCAnYS5iLmMnKTsgLy8gdHJ1ZVxuICogaGFzKG9iaiwgJ2EuYi5kJyk7IC8vIGZhbHNlXG4gKiBoYXMob2JqLCBbJ2EnLCAnYicsICdjJywgJ2QnXSk7IC8vIGZhbHNlXG4gKiBoYXMoW10sIDApOyAvLyBmYWxzZVxuICogaGFzKFsxLCAyLCAzXSwgMik7IC8vIHRydWVcbiAqIGhhcyhbMSwgMiwgM10sIDUpOyAvLyBmYWxzZVxuICovXG5leHBvcnQgZnVuY3Rpb24gaGFzKG9iamVjdDogdW5rbm93biwgcGF0aDogUHJvcGVydHlLZXkgfCByZWFkb25seSBQcm9wZXJ0eUtleVtdKTogYm9vbGVhbjtcblxuLyoqXG4gKiBDaGVja3MgaWYgYSBnaXZlbiBwYXRoIGV4aXN0cyB3aXRoaW4gYW4gb2JqZWN0LlxuICpcbiAqIFlvdSBjYW4gcHJvdmlkZSB0aGUgcGF0aCBhcyBhIHNpbmdsZSBwcm9wZXJ0eSBrZXksIGFuIGFycmF5IG9mIHByb3BlcnR5IGtleXMsXG4gKiBvciBhIHN0cmluZyByZXByZXNlbnRpbmcgYSBkZWVwIHBhdGguXG4gKlxuICogSWYgdGhlIHBhdGggaXMgYW4gaW5kZXggYW5kIHRoZSBvYmplY3QgaXMgYW4gYXJyYXkgb3IgYW4gYXJndW1lbnRzIG9iamVjdCwgdGhlIGZ1bmN0aW9uIHdpbGwgdmVyaWZ5XG4gKiBpZiB0aGUgaW5kZXggaXMgdmFsaWQgYW5kIHdpdGhpbiB0aGUgYm91bmRzIG9mIHRoZSBhcnJheSBvciBhcmd1bWVudHMgb2JqZWN0LCBldmVuIGlmIHRoZSBhcnJheSBvclxuICogYXJndW1lbnRzIG9iamVjdCBpcyBzcGFyc2UgKGkuZS4sIG5vdCBhbGwgaW5kZXhlcyBhcmUgZGVmaW5lZCkuXG4gKlxuICogQHBhcmFtIHtvYmplY3R9IG9iamVjdCAtIFRoZSBvYmplY3QgdG8gcXVlcnkuXG4gKiBAcGFyYW0ge1Byb3BlcnR5S2V5IHwgUHJvcGVydHlLZXlbXX0gcGF0aCAtIFRoZSBwYXRoIHRvIGNoZWNrLiBUaGlzIGNhbiBiZSBhIHNpbmdsZSBwcm9wZXJ0eSBrZXksXG4gKiAgICAgICAgYW4gYXJyYXkgb2YgcHJvcGVydHkga2V5cywgb3IgYSBzdHJpbmcgcmVwcmVzZW50aW5nIGEgZGVlcCBwYXRoLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHRoZSBwYXRoIGV4aXN0cyBpbiB0aGUgb2JqZWN0LCBgZmFsc2VgIG90aGVyd2lzZS5cbiAqXG4gKiBAZXhhbXBsZVxuICpcbiAqIGNvbnN0IG9iaiA9IHsgYTogeyBiOiB7IGM6IDMgfSB9IH07XG4gKlxuICogaGFzKG9iaiwgJ2EnKTsgLy8gdHJ1ZVxuICogaGFzKG9iaiwgWydhJywgJ2InXSk7IC8vIHRydWVcbiAqIGhhcyhvYmosIFsnYScsICdiJywgJ2MnXSk7IC8vIHRydWVcbiAqIGhhcyhvYmosICdhLmIuYycpOyAvLyB0cnVlXG4gKiBoYXMob2JqLCAnYS5iLmQnKTsgLy8gZmFsc2VcbiAqIGhhcyhvYmosIFsnYScsICdiJywgJ2MnLCAnZCddKTsgLy8gZmFsc2VcbiAqIGhhcyhbXSwgMCk7IC8vIGZhbHNlXG4gKiBoYXMoWzEsIDIsIDNdLCAyKTsgLy8gdHJ1ZVxuICogaGFzKFsxLCAyLCAzXSwgNSk7IC8vIGZhbHNlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBoYXMob2JqZWN0OiBhbnksIHBhdGg6IFByb3BlcnR5S2V5IHwgcmVhZG9ubHkgUHJvcGVydHlLZXlbXSk6IGJvb2xlYW4ge1xuICBsZXQgcmVzb2x2ZWRQYXRoO1xuXG4gIGlmIChBcnJheS5pc0FycmF5KHBhdGgpKSB7XG4gICAgcmVzb2x2ZWRQYXRoID0gcGF0aDtcbiAgfSBlbHNlIGlmICh0eXBlb2YgcGF0aCA9PT0gJ3N0cmluZycgJiYgaXNEZWVwS2V5KHBhdGgpICYmIG9iamVjdD8uW3BhdGhdID09IG51bGwpIHtcbiAgICByZXNvbHZlZFBhdGggPSB0b1BhdGgocGF0aCk7XG4gIH0gZWxzZSB7XG4gICAgcmVzb2x2ZWRQYXRoID0gW3BhdGhdO1xuICB9XG5cbiAgaWYgKHJlc29sdmVkUGF0aC5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBsZXQgY3VycmVudCA9IG9iamVjdDtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IHJlc29sdmVkUGF0aC5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGtleSA9IHJlc29sdmVkUGF0aFtpXTtcblxuICAgIC8vIENoZWNrIGlmIHRoZSBjdXJyZW50IGtleSBpcyBhIGRpcmVjdCBwcm9wZXJ0eSBvZiB0aGUgY3VycmVudCBvYmplY3RcbiAgICBpZiAoY3VycmVudCA9PSBudWxsIHx8ICFPYmplY3QuaGFzT3duKGN1cnJlbnQsIGtleSkpIHtcbiAgICAgIGNvbnN0IGlzU3BhcnNlSW5kZXggPSAoQXJyYXkuaXNBcnJheShjdXJyZW50KSB8fCBpc0FyZ3VtZW50cyhjdXJyZW50KSkgJiYgaXNJbmRleChrZXkpICYmIGtleSA8IGN1cnJlbnQubGVuZ3RoO1xuXG4gICAgICBpZiAoIWlzU3BhcnNlSW5kZXgpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cblxuICAgIGN1cnJlbnQgPSBjdXJyZW50W2tleV07XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLFNBQVMsUUFBUSw0QkFBNEI7QUFDdEQsU0FBUyxPQUFPLFFBQVEsMEJBQTBCO0FBQ2xELFNBQVMsV0FBVyxRQUFRLDhCQUE4QjtBQUMxRCxTQUFTLE1BQU0sUUFBUSxvQkFBb0I7QUFpQzNDOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBNEJDLEdBQ0QsT0FBTyxTQUFTLElBQUksTUFBVyxFQUFFLElBQTBDO0VBQ3pFLElBQUk7RUFFSixJQUFJLE1BQU0sT0FBTyxDQUFDLE9BQU87SUFDdkIsZUFBZTtFQUNqQixPQUFPLElBQUksT0FBTyxTQUFTLFlBQVksVUFBVSxTQUFTLFFBQVEsQ0FBQyxLQUFLLElBQUksTUFBTTtJQUNoRixlQUFlLE9BQU87RUFDeEIsT0FBTztJQUNMLGVBQWU7TUFBQztLQUFLO0VBQ3ZCO0VBRUEsSUFBSSxhQUFhLE1BQU0sS0FBSyxHQUFHO0lBQzdCLE9BQU87RUFDVDtFQUVBLElBQUksVUFBVTtFQUVkLElBQUssSUFBSSxJQUFJLEdBQUcsSUFBSSxhQUFhLE1BQU0sRUFBRSxJQUFLO0lBQzVDLE1BQU0sTUFBTSxZQUFZLENBQUMsRUFBRTtJQUUzQixzRUFBc0U7SUFDdEUsSUFBSSxXQUFXLFFBQVEsQ0FBQyxPQUFPLE1BQU0sQ0FBQyxTQUFTLE1BQU07TUFDbkQsTUFBTSxnQkFBZ0IsQ0FBQyxNQUFNLE9BQU8sQ0FBQyxZQUFZLFlBQVksUUFBUSxLQUFLLFFBQVEsUUFBUSxNQUFNLFFBQVEsTUFBTTtNQUU5RyxJQUFJLENBQUMsZUFBZTtRQUNsQixPQUFPO01BQ1Q7SUFDRjtJQUVBLFVBQVUsT0FBTyxDQUFDLElBQUk7RUFDeEI7RUFFQSxPQUFPO0FBQ1QifQ==
// denoCacheMetadata=9239398723772945682,14366981806276338297