import { isObject } from './isObject.ts';
import { isPrimitive } from '../../predicate/isPrimitive.ts';
import { eq } from '../util/eq.ts';
/**
 * Checks if the target matches the source by comparing their structures and values.
 * This function supports deep comparison for objects, arrays, maps, and sets.
 *
 * @param {unknown} target - The target value to match against.
 * @param {unknown} source - The source value to match with.
 * @returns {boolean} - Returns `true` if the target matches the source, otherwise `false`.
 *
 * @example
 * // Basic usage
 * isMatch({ a: 1, b: 2 }, { a: 1 }); // true
 *
 * @example
 * // Matching arrays
 * isMatch([1, 2, 3], [1, 2, 3]); // true
 *
 * @example
 * // Matching maps
 * const targetMap = new Map([['key1', 'value1'], ['key2', 'value2']]);
 * const sourceMap = new Map([['key1', 'value1']]);
 * isMatch(targetMap, sourceMap); // true
 *
 * @example
 * // Matching sets
 * const targetSet = new Set([1, 2, 3]);
 * const sourceSet = new Set([1, 2]);
 * isMatch(targetSet, sourceSet); // true
 */ export function isMatch(target, source) {
  if (source === target) {
    return true;
  }
  switch(typeof source){
    case 'object':
      {
        if (source == null) {
          return true;
        }
        const keys = Object.keys(source);
        if (target == null) {
          return keys.length === 0;
        }
        if (Array.isArray(source)) {
          return isArrayMatch(target, source);
        }
        if (source instanceof Map) {
          return isMapMatch(target, source);
        }
        if (source instanceof Set) {
          return isSetMatch(target, source);
        }
        for(let i = 0; i < keys.length; i++){
          const key = keys[i];
          if (!isPrimitive(target) && !(key in target)) {
            return false;
          }
          if (source[key] === undefined && target[key] !== undefined) {
            return false;
          }
          if (source[key] === null && target[key] !== null) {
            return false;
          }
          if (!isMatch(target[key], source[key])) {
            return false;
          }
        }
        return true;
      }
    case 'function':
      {
        if (Object.keys(source).length > 0) {
          return isMatch(target, {
            ...source
          });
        }
        return false;
      }
    default:
      {
        if (!isObject(target)) {
          return eq(target, source);
        }
        return !source;
      }
  }
}
export function isMapMatch(target, source) {
  if (source.size === 0) {
    return true;
  }
  if (!(target instanceof Map)) {
    return false;
  }
  for (const [key, value] of source.entries()){
    if (!isMatch(target.get(key), value)) {
      return false;
    }
  }
  return true;
}
export function isArrayMatch(target, source) {
  if (source.length === 0) {
    return true;
  }
  if (!Array.isArray(target)) {
    return false;
  }
  const countedIndex = new Set();
  for(let i = 0; i < source.length; i++){
    const sourceItem = source[i];
    const index = target.findIndex((targetItem, index)=>{
      return isMatch(targetItem, sourceItem) && !countedIndex.has(index);
    });
    if (index === -1) {
      return false;
    }
    countedIndex.add(index);
  }
  return true;
}
export function isSetMatch(target, source) {
  if (source.size === 0) {
    return true;
  }
  if (!(target instanceof Set)) {
    return false;
  }
  return isArrayMatch([
    ...target
  ], [
    ...source
  ]);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvcHJlZGljYXRlL2lzTWF0Y2gudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgaXNPYmplY3QgfSBmcm9tICcuL2lzT2JqZWN0LnRzJztcbmltcG9ydCB7IGlzUHJpbWl0aXZlIH0gZnJvbSAnLi4vLi4vcHJlZGljYXRlL2lzUHJpbWl0aXZlLnRzJztcbmltcG9ydCB7IGVxIH0gZnJvbSAnLi4vdXRpbC9lcS50cyc7XG5cbi8qKlxuICogQ2hlY2tzIGlmIHRoZSB0YXJnZXQgbWF0Y2hlcyB0aGUgc291cmNlIGJ5IGNvbXBhcmluZyB0aGVpciBzdHJ1Y3R1cmVzIGFuZCB2YWx1ZXMuXG4gKiBUaGlzIGZ1bmN0aW9uIHN1cHBvcnRzIGRlZXAgY29tcGFyaXNvbiBmb3Igb2JqZWN0cywgYXJyYXlzLCBtYXBzLCBhbmQgc2V0cy5cbiAqXG4gKiBAcGFyYW0ge3Vua25vd259IHRhcmdldCAtIFRoZSB0YXJnZXQgdmFsdWUgdG8gbWF0Y2ggYWdhaW5zdC5cbiAqIEBwYXJhbSB7dW5rbm93bn0gc291cmNlIC0gVGhlIHNvdXJjZSB2YWx1ZSB0byBtYXRjaCB3aXRoLlxuICogQHJldHVybnMge2Jvb2xlYW59IC0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIHRhcmdldCBtYXRjaGVzIHRoZSBzb3VyY2UsIG90aGVyd2lzZSBgZmFsc2VgLlxuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBCYXNpYyB1c2FnZVxuICogaXNNYXRjaCh7IGE6IDEsIGI6IDIgfSwgeyBhOiAxIH0pOyAvLyB0cnVlXG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIE1hdGNoaW5nIGFycmF5c1xuICogaXNNYXRjaChbMSwgMiwgM10sIFsxLCAyLCAzXSk7IC8vIHRydWVcbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gTWF0Y2hpbmcgbWFwc1xuICogY29uc3QgdGFyZ2V0TWFwID0gbmV3IE1hcChbWydrZXkxJywgJ3ZhbHVlMSddLCBbJ2tleTInLCAndmFsdWUyJ11dKTtcbiAqIGNvbnN0IHNvdXJjZU1hcCA9IG5ldyBNYXAoW1sna2V5MScsICd2YWx1ZTEnXV0pO1xuICogaXNNYXRjaCh0YXJnZXRNYXAsIHNvdXJjZU1hcCk7IC8vIHRydWVcbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gTWF0Y2hpbmcgc2V0c1xuICogY29uc3QgdGFyZ2V0U2V0ID0gbmV3IFNldChbMSwgMiwgM10pO1xuICogY29uc3Qgc291cmNlU2V0ID0gbmV3IFNldChbMSwgMl0pO1xuICogaXNNYXRjaCh0YXJnZXRTZXQsIHNvdXJjZVNldCk7IC8vIHRydWVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzTWF0Y2godGFyZ2V0OiB1bmtub3duLCBzb3VyY2U6IHVua25vd24pOiBib29sZWFuO1xuLyoqXG4gKiBDaGVja3MgaWYgdGhlIHRhcmdldCBtYXRjaGVzIHRoZSBzb3VyY2UgYnkgY29tcGFyaW5nIHRoZWlyIHN0cnVjdHVyZXMgYW5kIHZhbHVlcy5cbiAqIFRoaXMgZnVuY3Rpb24gc3VwcG9ydHMgZGVlcCBjb21wYXJpc29uIGZvciBvYmplY3RzLCBhcnJheXMsIG1hcHMsIGFuZCBzZXRzLlxuICpcbiAqIEBwYXJhbSB7dW5rbm93bn0gdGFyZ2V0IC0gVGhlIHRhcmdldCB2YWx1ZSB0byBtYXRjaCBhZ2FpbnN0LlxuICogQHBhcmFtIHt1bmtub3dufSBzb3VyY2UgLSBUaGUgc291cmNlIHZhbHVlIHRvIG1hdGNoIHdpdGguXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gLSBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgdGFyZ2V0IG1hdGNoZXMgdGhlIHNvdXJjZSwgb3RoZXJ3aXNlIGBmYWxzZWAuXG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIEJhc2ljIHVzYWdlXG4gKiBpc01hdGNoKHsgYTogMSwgYjogMiB9LCB7IGE6IDEgfSk7IC8vIHRydWVcbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gTWF0Y2hpbmcgYXJyYXlzXG4gKiBpc01hdGNoKFsxLCAyLCAzXSwgWzEsIDIsIDNdKTsgLy8gdHJ1ZVxuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBNYXRjaGluZyBtYXBzXG4gKiBjb25zdCB0YXJnZXRNYXAgPSBuZXcgTWFwKFtbJ2tleTEnLCAndmFsdWUxJ10sIFsna2V5MicsICd2YWx1ZTInXV0pO1xuICogY29uc3Qgc291cmNlTWFwID0gbmV3IE1hcChbWydrZXkxJywgJ3ZhbHVlMSddXSk7XG4gKiBpc01hdGNoKHRhcmdldE1hcCwgc291cmNlTWFwKTsgLy8gdHJ1ZVxuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBNYXRjaGluZyBzZXRzXG4gKiBjb25zdCB0YXJnZXRTZXQgPSBuZXcgU2V0KFsxLCAyLCAzXSk7XG4gKiBjb25zdCBzb3VyY2VTZXQgPSBuZXcgU2V0KFsxLCAyXSk7XG4gKiBpc01hdGNoKHRhcmdldFNldCwgc291cmNlU2V0KTsgLy8gdHJ1ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNNYXRjaCh0YXJnZXQ6IGFueSwgc291cmNlOiBhbnkpOiBib29sZWFuIHtcbiAgaWYgKHNvdXJjZSA9PT0gdGFyZ2V0KSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBzd2l0Y2ggKHR5cGVvZiBzb3VyY2UpIHtcbiAgICBjYXNlICdvYmplY3QnOiB7XG4gICAgICBpZiAoc291cmNlID09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGtleXMgPSBPYmplY3Qua2V5cyhzb3VyY2UgYXMgYW55KTtcblxuICAgICAgaWYgKHRhcmdldCA9PSBudWxsKSB7XG4gICAgICAgIHJldHVybiBrZXlzLmxlbmd0aCA9PT0gMDtcbiAgICAgIH1cblxuICAgICAgaWYgKEFycmF5LmlzQXJyYXkoc291cmNlKSkge1xuICAgICAgICByZXR1cm4gaXNBcnJheU1hdGNoKHRhcmdldCwgc291cmNlKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHNvdXJjZSBpbnN0YW5jZW9mIE1hcCkge1xuICAgICAgICByZXR1cm4gaXNNYXBNYXRjaCh0YXJnZXQsIHNvdXJjZSk7XG4gICAgICB9XG5cbiAgICAgIGlmIChzb3VyY2UgaW5zdGFuY2VvZiBTZXQpIHtcbiAgICAgICAgcmV0dXJuIGlzU2V0TWF0Y2godGFyZ2V0LCBzb3VyY2UpO1xuICAgICAgfVxuXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGtleXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29uc3Qga2V5ID0ga2V5c1tpXTtcblxuICAgICAgICBpZiAoIWlzUHJpbWl0aXZlKHRhcmdldCkgJiYgIShrZXkgaW4gdGFyZ2V0KSkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzb3VyY2Vba2V5XSA9PT0gdW5kZWZpbmVkICYmIHRhcmdldFtrZXldICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc291cmNlW2tleV0gPT09IG51bGwgJiYgdGFyZ2V0W2tleV0gIT09IG51bGwpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWlzTWF0Y2godGFyZ2V0W2tleV0sIHNvdXJjZVtrZXldKSkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgY2FzZSAnZnVuY3Rpb24nOiB7XG4gICAgICBpZiAoT2JqZWN0LmtleXMoc291cmNlKS5sZW5ndGggPiAwKSB7XG4gICAgICAgIHJldHVybiBpc01hdGNoKHRhcmdldCwgeyAuLi5zb3VyY2UgfSk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgZGVmYXVsdDoge1xuICAgICAgaWYgKCFpc09iamVjdCh0YXJnZXQpKSB7XG4gICAgICAgIHJldHVybiBlcSh0YXJnZXQsIHNvdXJjZSk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiAhc291cmNlO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNNYXBNYXRjaCh0YXJnZXQ6IHVua25vd24sIHNvdXJjZTogTWFwPGFueSwgYW55Pikge1xuICBpZiAoc291cmNlLnNpemUgPT09IDApIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIGlmICghKHRhcmdldCBpbnN0YW5jZW9mIE1hcCkpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBzb3VyY2UuZW50cmllcygpKSB7XG4gICAgaWYgKCFpc01hdGNoKHRhcmdldC5nZXQoa2V5KSwgdmFsdWUpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0FycmF5TWF0Y2godGFyZ2V0OiB1bmtub3duLCBzb3VyY2U6IHJlYWRvbmx5IHVua25vd25bXSkge1xuICBpZiAoc291cmNlLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgaWYgKCFBcnJheS5pc0FycmF5KHRhcmdldCkpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBjb25zdCBjb3VudGVkSW5kZXggPSBuZXcgU2V0PG51bWJlcj4oKTtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IHNvdXJjZS5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IHNvdXJjZUl0ZW0gPSBzb3VyY2VbaV07XG4gICAgY29uc3QgaW5kZXggPSB0YXJnZXQuZmluZEluZGV4KCh0YXJnZXRJdGVtLCBpbmRleCkgPT4ge1xuICAgICAgcmV0dXJuIGlzTWF0Y2godGFyZ2V0SXRlbSwgc291cmNlSXRlbSkgJiYgIWNvdW50ZWRJbmRleC5oYXMoaW5kZXgpO1xuICAgIH0pO1xuXG4gICAgaWYgKGluZGV4ID09PSAtMSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGNvdW50ZWRJbmRleC5hZGQoaW5kZXgpO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc1NldE1hdGNoKHRhcmdldDogdW5rbm93biwgc291cmNlOiBTZXQ8YW55Pikge1xuICBpZiAoc291cmNlLnNpemUgPT09IDApIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIGlmICghKHRhcmdldCBpbnN0YW5jZW9mIFNldCkpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICByZXR1cm4gaXNBcnJheU1hdGNoKFsuLi50YXJnZXRdLCBbLi4uc291cmNlXSk7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxRQUFRLFFBQVEsZ0JBQWdCO0FBQ3pDLFNBQVMsV0FBVyxRQUFRLGlDQUFpQztBQUM3RCxTQUFTLEVBQUUsUUFBUSxnQkFBZ0I7QUErQm5DOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0EyQkMsR0FDRCxPQUFPLFNBQVMsUUFBUSxNQUFXLEVBQUUsTUFBVztFQUM5QyxJQUFJLFdBQVcsUUFBUTtJQUNyQixPQUFPO0VBQ1Q7RUFFQSxPQUFRLE9BQU87SUFDYixLQUFLO01BQVU7UUFDYixJQUFJLFVBQVUsTUFBTTtVQUNsQixPQUFPO1FBQ1Q7UUFFQSxNQUFNLE9BQU8sT0FBTyxJQUFJLENBQUM7UUFFekIsSUFBSSxVQUFVLE1BQU07VUFDbEIsT0FBTyxLQUFLLE1BQU0sS0FBSztRQUN6QjtRQUVBLElBQUksTUFBTSxPQUFPLENBQUMsU0FBUztVQUN6QixPQUFPLGFBQWEsUUFBUTtRQUM5QjtRQUVBLElBQUksa0JBQWtCLEtBQUs7VUFDekIsT0FBTyxXQUFXLFFBQVE7UUFDNUI7UUFFQSxJQUFJLGtCQUFrQixLQUFLO1VBQ3pCLE9BQU8sV0FBVyxRQUFRO1FBQzVCO1FBRUEsSUFBSyxJQUFJLElBQUksR0FBRyxJQUFJLEtBQUssTUFBTSxFQUFFLElBQUs7VUFDcEMsTUFBTSxNQUFNLElBQUksQ0FBQyxFQUFFO1VBRW5CLElBQUksQ0FBQyxZQUFZLFdBQVcsQ0FBQyxDQUFDLE9BQU8sTUFBTSxHQUFHO1lBQzVDLE9BQU87VUFDVDtVQUVBLElBQUksTUFBTSxDQUFDLElBQUksS0FBSyxhQUFhLE1BQU0sQ0FBQyxJQUFJLEtBQUssV0FBVztZQUMxRCxPQUFPO1VBQ1Q7VUFFQSxJQUFJLE1BQU0sQ0FBQyxJQUFJLEtBQUssUUFBUSxNQUFNLENBQUMsSUFBSSxLQUFLLE1BQU07WUFDaEQsT0FBTztVQUNUO1VBRUEsSUFBSSxDQUFDLFFBQVEsTUFBTSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxHQUFHO1lBQ3RDLE9BQU87VUFDVDtRQUNGO1FBRUEsT0FBTztNQUNUO0lBQ0EsS0FBSztNQUFZO1FBQ2YsSUFBSSxPQUFPLElBQUksQ0FBQyxRQUFRLE1BQU0sR0FBRyxHQUFHO1VBQ2xDLE9BQU8sUUFBUSxRQUFRO1lBQUUsR0FBRyxNQUFNO1VBQUM7UUFDckM7UUFFQSxPQUFPO01BQ1Q7SUFDQTtNQUFTO1FBQ1AsSUFBSSxDQUFDLFNBQVMsU0FBUztVQUNyQixPQUFPLEdBQUcsUUFBUTtRQUNwQjtRQUVBLE9BQU8sQ0FBQztNQUNWO0VBQ0Y7QUFDRjtBQUVBLE9BQU8sU0FBUyxXQUFXLE1BQWUsRUFBRSxNQUFxQjtFQUMvRCxJQUFJLE9BQU8sSUFBSSxLQUFLLEdBQUc7SUFDckIsT0FBTztFQUNUO0VBRUEsSUFBSSxDQUFDLENBQUMsa0JBQWtCLEdBQUcsR0FBRztJQUM1QixPQUFPO0VBQ1Q7RUFFQSxLQUFLLE1BQU0sQ0FBQyxLQUFLLE1BQU0sSUFBSSxPQUFPLE9BQU8sR0FBSTtJQUMzQyxJQUFJLENBQUMsUUFBUSxPQUFPLEdBQUcsQ0FBQyxNQUFNLFFBQVE7TUFDcEMsT0FBTztJQUNUO0VBQ0Y7RUFFQSxPQUFPO0FBQ1Q7QUFFQSxPQUFPLFNBQVMsYUFBYSxNQUFlLEVBQUUsTUFBMEI7RUFDdEUsSUFBSSxPQUFPLE1BQU0sS0FBSyxHQUFHO0lBQ3ZCLE9BQU87RUFDVDtFQUVBLElBQUksQ0FBQyxNQUFNLE9BQU8sQ0FBQyxTQUFTO0lBQzFCLE9BQU87RUFDVDtFQUVBLE1BQU0sZUFBZSxJQUFJO0VBRXpCLElBQUssSUFBSSxJQUFJLEdBQUcsSUFBSSxPQUFPLE1BQU0sRUFBRSxJQUFLO0lBQ3RDLE1BQU0sYUFBYSxNQUFNLENBQUMsRUFBRTtJQUM1QixNQUFNLFFBQVEsT0FBTyxTQUFTLENBQUMsQ0FBQyxZQUFZO01BQzFDLE9BQU8sUUFBUSxZQUFZLGVBQWUsQ0FBQyxhQUFhLEdBQUcsQ0FBQztJQUM5RDtJQUVBLElBQUksVUFBVSxDQUFDLEdBQUc7TUFDaEIsT0FBTztJQUNUO0lBRUEsYUFBYSxHQUFHLENBQUM7RUFDbkI7RUFFQSxPQUFPO0FBQ1Q7QUFFQSxPQUFPLFNBQVMsV0FBVyxNQUFlLEVBQUUsTUFBZ0I7RUFDMUQsSUFBSSxPQUFPLElBQUksS0FBSyxHQUFHO0lBQ3JCLE9BQU87RUFDVDtFQUVBLElBQUksQ0FBQyxDQUFDLGtCQUFrQixHQUFHLEdBQUc7SUFDNUIsT0FBTztFQUNUO0VBRUEsT0FBTyxhQUFhO09BQUk7R0FBTyxFQUFFO09BQUk7R0FBTztBQUM5QyJ9
// denoCacheMetadata=13761170431647758586,2309739549955750608