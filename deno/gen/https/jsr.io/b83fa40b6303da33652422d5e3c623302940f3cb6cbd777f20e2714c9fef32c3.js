import { isArrayLike } from '../predicate/isArrayLike.ts';
import { isMap } from '../predicate/isMap.ts';
/**
 * Converts a value to an array.
 *
 * @param {unknown} value - The value to convert.
 * @returns {any[]} Returns the converted array.
 *
 * @example
 * toArray({ 'a': 1, 'b': 2 }) // => returns [1,2]
 * toArray('abc') // => returns ['a', 'b', 'c']
 * toArray(1) // => returns []
 * toArray(null) // => returns []
 */ export function toArray(value) {
  if (value == null) {
    return [];
  }
  if (isArrayLike(value) || isMap(value)) {
    return Array.from(value);
  }
  if (typeof value === 'object') {
    return Object.values(value);
  }
  return [];
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvdXRpbC90b0FycmF5LnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGlzQXJyYXlMaWtlIH0gZnJvbSAnLi4vcHJlZGljYXRlL2lzQXJyYXlMaWtlLnRzJztcbmltcG9ydCB7IGlzTWFwIH0gZnJvbSAnLi4vcHJlZGljYXRlL2lzTWFwLnRzJztcblxuLyoqXG4gKiBDb252ZXJ0cyBhIHZhbHVlIHRvIGFuIGFycmF5LlxuICpcbiAqIEBwYXJhbSB7dW5rbm93bn0gdmFsdWUgLSBUaGUgdmFsdWUgdG8gY29udmVydC5cbiAqIEByZXR1cm5zIHthbnlbXX0gUmV0dXJucyB0aGUgY29udmVydGVkIGFycmF5LlxuICpcbiAqIEBleGFtcGxlXG4gKiB0b0FycmF5KHsgJ2EnOiAxLCAnYic6IDIgfSkgLy8gPT4gcmV0dXJucyBbMSwyXVxuICogdG9BcnJheSgnYWJjJykgLy8gPT4gcmV0dXJucyBbJ2EnLCAnYicsICdjJ11cbiAqIHRvQXJyYXkoMSkgLy8gPT4gcmV0dXJucyBbXVxuICogdG9BcnJheShudWxsKSAvLyA9PiByZXR1cm5zIFtdXG4gKi9cblxuZXhwb3J0IGZ1bmN0aW9uIHRvQXJyYXkodmFsdWU/OiB1bmtub3duKTogYW55W10ge1xuICBpZiAodmFsdWUgPT0gbnVsbCkge1xuICAgIHJldHVybiBbXTtcbiAgfVxuXG4gIGlmIChpc0FycmF5TGlrZSh2YWx1ZSkgfHwgaXNNYXAodmFsdWUpKSB7XG4gICAgcmV0dXJuIEFycmF5LmZyb20odmFsdWUpO1xuICB9XG5cbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyh2YWx1ZSk7XG4gIH1cblxuICByZXR1cm4gW107XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxXQUFXLFFBQVEsOEJBQThCO0FBQzFELFNBQVMsS0FBSyxRQUFRLHdCQUF3QjtBQUU5Qzs7Ozs7Ozs7Ozs7Q0FXQyxHQUVELE9BQU8sU0FBUyxRQUFRLEtBQWU7RUFDckMsSUFBSSxTQUFTLE1BQU07SUFDakIsT0FBTyxFQUFFO0VBQ1g7RUFFQSxJQUFJLFlBQVksVUFBVSxNQUFNLFFBQVE7SUFDdEMsT0FBTyxNQUFNLElBQUksQ0FBQztFQUNwQjtFQUVBLElBQUksT0FBTyxVQUFVLFVBQVU7SUFDN0IsT0FBTyxPQUFPLE1BQU0sQ0FBQztFQUN2QjtFQUVBLE9BQU8sRUFBRTtBQUNYIn0=
// denoCacheMetadata=9336145741463024438,5447889992661187898