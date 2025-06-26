import { isIndex } from '../_internal/isIndex.ts';
import { toPath } from '../util/toPath.ts';
/**
 * Sets the value at the specified path of the given object. If any part of the path does not exist, it will be created.
 *
 * @template T - The type of the object.
 * @param {T} obj - The object to modify.
 * @param {PropertyKey | PropertyKey[]} path - The path of the property to set.
 * @param {any} value - The value to set.
 * @returns {T} - The modified object.
 *
 * @example
 * // Set a value in a nested object
 * const obj = { a: { b: { c: 3 } } };
 * set(obj, 'a.b.c', 4);
 * console.log(obj.a.b.c); // 4
 *
 * @example
 * // Set a value in an array
 * const arr = [1, 2, 3];
 * set(arr, 1, 4);
 * console.log(arr[1]); // 4
 *
 * @example
 * // Create non-existent path and set value
 * const obj = {};
 * set(obj, 'a.b.c', 4);
 * console.log(obj); // { a: { b: { c: 4 } } }
 */ export function set(obj, path, value) {
  const resolvedPath = Array.isArray(path) ? path : typeof path === 'string' ? toPath(path) : [
    path
  ];
  let current = obj;
  for(let i = 0; i < resolvedPath.length - 1; i++){
    const key = resolvedPath[i];
    const nextKey = resolvedPath[i + 1];
    if (current[key] == null) {
      current[key] = isIndex(nextKey) ? [] : {};
    }
    current = current[key];
  }
  const lastKey = resolvedPath[resolvedPath.length - 1];
  current[lastKey] = value;
  return obj;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvb2JqZWN0L3NldC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBpc0luZGV4IH0gZnJvbSAnLi4vX2ludGVybmFsL2lzSW5kZXgudHMnO1xuaW1wb3J0IHsgdG9QYXRoIH0gZnJvbSAnLi4vdXRpbC90b1BhdGgudHMnO1xuXG4vKipcbiAqIFNldHMgdGhlIHZhbHVlIGF0IHRoZSBzcGVjaWZpZWQgcGF0aCBvZiB0aGUgZ2l2ZW4gb2JqZWN0LiBJZiBhbnkgcGFydCBvZiB0aGUgcGF0aCBkb2VzIG5vdCBleGlzdCwgaXQgd2lsbCBiZSBjcmVhdGVkLlxuICpcbiAqIEB0ZW1wbGF0ZSBUIC0gVGhlIHR5cGUgb2YgdGhlIG9iamVjdC5cbiAqIEBwYXJhbSB7VH0gb2JqIC0gVGhlIG9iamVjdCB0byBtb2RpZnkuXG4gKiBAcGFyYW0ge1Byb3BlcnR5S2V5IHwgUHJvcGVydHlLZXlbXX0gcGF0aCAtIFRoZSBwYXRoIG9mIHRoZSBwcm9wZXJ0eSB0byBzZXQuXG4gKiBAcGFyYW0ge2FueX0gdmFsdWUgLSBUaGUgdmFsdWUgdG8gc2V0LlxuICogQHJldHVybnMge1R9IC0gVGhlIG1vZGlmaWVkIG9iamVjdC5cbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gU2V0IGEgdmFsdWUgaW4gYSBuZXN0ZWQgb2JqZWN0XG4gKiBjb25zdCBvYmogPSB7IGE6IHsgYjogeyBjOiAzIH0gfSB9O1xuICogc2V0KG9iaiwgJ2EuYi5jJywgNCk7XG4gKiBjb25zb2xlLmxvZyhvYmouYS5iLmMpOyAvLyA0XG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIFNldCBhIHZhbHVlIGluIGFuIGFycmF5XG4gKiBjb25zdCBhcnIgPSBbMSwgMiwgM107XG4gKiBzZXQoYXJyLCAxLCA0KTtcbiAqIGNvbnNvbGUubG9nKGFyclsxXSk7IC8vIDRcbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gQ3JlYXRlIG5vbi1leGlzdGVudCBwYXRoIGFuZCBzZXQgdmFsdWVcbiAqIGNvbnN0IG9iaiA9IHt9O1xuICogc2V0KG9iaiwgJ2EuYi5jJywgNCk7XG4gKiBjb25zb2xlLmxvZyhvYmopOyAvLyB7IGE6IHsgYjogeyBjOiA0IH0gfSB9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzZXQ8VD4ob2JqOiBvYmplY3QsIHBhdGg6IFByb3BlcnR5S2V5IHwgcmVhZG9ubHkgUHJvcGVydHlLZXlbXSwgdmFsdWU6IHVua25vd24pOiBUO1xuLyoqXG4gKiBTZXRzIHRoZSB2YWx1ZSBhdCB0aGUgc3BlY2lmaWVkIHBhdGggb2YgdGhlIGdpdmVuIG9iamVjdC4gSWYgYW55IHBhcnQgb2YgdGhlIHBhdGggZG9lcyBub3QgZXhpc3QsIGl0IHdpbGwgYmUgY3JlYXRlZC5cbiAqXG4gKiBAdGVtcGxhdGUgVCAtIFRoZSB0eXBlIG9mIHRoZSBvYmplY3QuXG4gKiBAcGFyYW0ge1R9IG9iaiAtIFRoZSBvYmplY3QgdG8gbW9kaWZ5LlxuICogQHBhcmFtIHtQcm9wZXJ0eUtleSB8IFByb3BlcnR5S2V5W119IHBhdGggLSBUaGUgcGF0aCBvZiB0aGUgcHJvcGVydHkgdG8gc2V0LlxuICogQHBhcmFtIHthbnl9IHZhbHVlIC0gVGhlIHZhbHVlIHRvIHNldC5cbiAqIEByZXR1cm5zIHtUfSAtIFRoZSBtb2RpZmllZCBvYmplY3QuXG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIFNldCBhIHZhbHVlIGluIGEgbmVzdGVkIG9iamVjdFxuICogY29uc3Qgb2JqID0geyBhOiB7IGI6IHsgYzogMyB9IH0gfTtcbiAqIHNldChvYmosICdhLmIuYycsIDQpO1xuICogY29uc29sZS5sb2cob2JqLmEuYi5jKTsgLy8gNFxuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBTZXQgYSB2YWx1ZSBpbiBhbiBhcnJheVxuICogY29uc3QgYXJyID0gWzEsIDIsIDNdO1xuICogc2V0KGFyciwgMSwgNCk7XG4gKiBjb25zb2xlLmxvZyhhcnJbMV0pOyAvLyA0XG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIENyZWF0ZSBub24tZXhpc3RlbnQgcGF0aCBhbmQgc2V0IHZhbHVlXG4gKiBjb25zdCBvYmogPSB7fTtcbiAqIHNldChvYmosICdhLmIuYycsIDQpO1xuICogY29uc29sZS5sb2cob2JqKTsgLy8geyBhOiB7IGI6IHsgYzogNCB9IH0gfVxuICovXG5leHBvcnQgZnVuY3Rpb24gc2V0PFQgZXh0ZW5kcyBvYmplY3Q+KG9iajogVCwgcGF0aDogUHJvcGVydHlLZXkgfCByZWFkb25seSBQcm9wZXJ0eUtleVtdLCB2YWx1ZTogdW5rbm93bik6IFQge1xuICBjb25zdCByZXNvbHZlZFBhdGggPSBBcnJheS5pc0FycmF5KHBhdGgpID8gcGF0aCA6IHR5cGVvZiBwYXRoID09PSAnc3RyaW5nJyA/IHRvUGF0aChwYXRoKSA6IFtwYXRoXTtcblxuICBsZXQgY3VycmVudDogYW55ID0gb2JqO1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgcmVzb2x2ZWRQYXRoLmxlbmd0aCAtIDE7IGkrKykge1xuICAgIGNvbnN0IGtleSA9IHJlc29sdmVkUGF0aFtpXTtcbiAgICBjb25zdCBuZXh0S2V5ID0gcmVzb2x2ZWRQYXRoW2kgKyAxXTtcblxuICAgIGlmIChjdXJyZW50W2tleV0gPT0gbnVsbCkge1xuICAgICAgY3VycmVudFtrZXldID0gaXNJbmRleChuZXh0S2V5KSA/IFtdIDoge307XG4gICAgfVxuXG4gICAgY3VycmVudCA9IGN1cnJlbnRba2V5XTtcbiAgfVxuXG4gIGNvbnN0IGxhc3RLZXkgPSByZXNvbHZlZFBhdGhbcmVzb2x2ZWRQYXRoLmxlbmd0aCAtIDFdO1xuICBjdXJyZW50W2xhc3RLZXldID0gdmFsdWU7XG5cbiAgcmV0dXJuIG9iajtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLE9BQU8sUUFBUSwwQkFBMEI7QUFDbEQsU0FBUyxNQUFNLFFBQVEsb0JBQW9CO0FBOEIzQzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0EwQkMsR0FDRCxPQUFPLFNBQVMsSUFBc0IsR0FBTSxFQUFFLElBQTBDLEVBQUUsS0FBYztFQUN0RyxNQUFNLGVBQWUsTUFBTSxPQUFPLENBQUMsUUFBUSxPQUFPLE9BQU8sU0FBUyxXQUFXLE9BQU8sUUFBUTtJQUFDO0dBQUs7RUFFbEcsSUFBSSxVQUFlO0VBRW5CLElBQUssSUFBSSxJQUFJLEdBQUcsSUFBSSxhQUFhLE1BQU0sR0FBRyxHQUFHLElBQUs7SUFDaEQsTUFBTSxNQUFNLFlBQVksQ0FBQyxFQUFFO0lBQzNCLE1BQU0sVUFBVSxZQUFZLENBQUMsSUFBSSxFQUFFO0lBRW5DLElBQUksT0FBTyxDQUFDLElBQUksSUFBSSxNQUFNO01BQ3hCLE9BQU8sQ0FBQyxJQUFJLEdBQUcsUUFBUSxXQUFXLEVBQUUsR0FBRyxDQUFDO0lBQzFDO0lBRUEsVUFBVSxPQUFPLENBQUMsSUFBSTtFQUN4QjtFQUVBLE1BQU0sVUFBVSxZQUFZLENBQUMsYUFBYSxNQUFNLEdBQUcsRUFBRTtFQUNyRCxPQUFPLENBQUMsUUFBUSxHQUFHO0VBRW5CLE9BQU87QUFDVCJ9
// denoCacheMetadata=7668756140100064878,15948920999179920072