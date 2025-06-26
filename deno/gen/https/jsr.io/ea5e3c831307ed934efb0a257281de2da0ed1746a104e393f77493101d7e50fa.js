import { cloneDeepWith as cloneDeepWithToolkit } from '../../object/cloneDeepWith.ts';
import { copyProperties } from '../../object/cloneDeepWith.ts';
import { argumentsTag, booleanTag, numberTag, stringTag } from '../_internal/tags.ts';
/**
 * Creates a deep clone of the given object using a customizer function.
 *
 * @template T - The type of the object.
 * @param {T} obj - The object to clone.
 * @param {Function} [cloneValue] - A function to customize the cloning process.
 * @returns {T} - A deep clone of the given object.
 *
 * @example
 * // Clone a primitive value
 * const num = 29;
 * const clonedNum = cloneDeepWith(num);
 * console.log(clonedNum); // 29
 * console.log(clonedNum === num); // true
 *
 * @example
 * // Clone an object with a customizer
 * const obj = { a: 1, b: 2 };
 * const clonedObj = cloneDeepWith(obj, (value) => {
 *   if (typeof value === 'number') {
 *     return value * 2; // Double the number
 *   }
 * });
 * console.log(clonedObj); // { a: 2, b: 4 }
 * console.log(clonedObj === obj); // false
 *
 * @example
 * // Clone an array with a customizer
 * const arr = [1, 2, 3];
 * const clonedArr = cloneDeepWith(arr, (value) => {
 *   return value + 1; // Increment each value
 * });
 * console.log(clonedArr); // [2, 3, 4]
 * console.log(clonedArr === arr); // false
 */ export function cloneDeepWith(obj, cloneValue) {
  return cloneDeepWithToolkit(obj, (value, key, object, stack)=>{
    const cloned = cloneValue?.(value, key, object, stack);
    if (cloned != null) {
      return cloned;
    }
    if (typeof obj !== 'object') {
      return undefined;
    }
    switch(Object.prototype.toString.call(obj)){
      case numberTag:
      case stringTag:
      case booleanTag:
        {
          // eslint-disable-next-line
          // @ts-ignore
          const result = new obj.constructor(obj?.valueOf());
          copyProperties(result, obj);
          return result;
        }
      case argumentsTag:
        {
          const result = {};
          copyProperties(result, obj);
          // eslint-disable-next-line
          // @ts-ignore
          result.length = obj.length;
          // eslint-disable-next-line
          // @ts-ignore
          result[Symbol.iterator] = obj[Symbol.iterator];
          return result;
        }
      default:
        {
          return undefined;
        }
    }
  });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvb2JqZWN0L2Nsb25lRGVlcFdpdGgudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgY2xvbmVEZWVwV2l0aCBhcyBjbG9uZURlZXBXaXRoVG9vbGtpdCB9IGZyb20gJy4uLy4uL29iamVjdC9jbG9uZURlZXBXaXRoLnRzJztcbmltcG9ydCB7IGNvcHlQcm9wZXJ0aWVzIH0gZnJvbSAnLi4vLi4vb2JqZWN0L2Nsb25lRGVlcFdpdGgudHMnO1xuaW1wb3J0IHsgYXJndW1lbnRzVGFnLCBib29sZWFuVGFnLCBudW1iZXJUYWcsIHN0cmluZ1RhZyB9IGZyb20gJy4uL19pbnRlcm5hbC90YWdzLnRzJztcblxuLyoqXG4gKiBDcmVhdGVzIGEgZGVlcCBjbG9uZSBvZiB0aGUgZ2l2ZW4gb2JqZWN0IHVzaW5nIGEgY3VzdG9taXplciBmdW5jdGlvbi5cbiAqXG4gKiBAdGVtcGxhdGUgVCAtIFRoZSB0eXBlIG9mIHRoZSBvYmplY3QuXG4gKiBAcGFyYW0ge1R9IG9iaiAtIFRoZSBvYmplY3QgdG8gY2xvbmUuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2xvbmVWYWx1ZV0gLSBBIGZ1bmN0aW9uIHRvIGN1c3RvbWl6ZSB0aGUgY2xvbmluZyBwcm9jZXNzLlxuICogQHJldHVybnMge1R9IC0gQSBkZWVwIGNsb25lIG9mIHRoZSBnaXZlbiBvYmplY3QuXG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIENsb25lIGEgcHJpbWl0aXZlIHZhbHVlXG4gKiBjb25zdCBudW0gPSAyOTtcbiAqIGNvbnN0IGNsb25lZE51bSA9IGNsb25lRGVlcFdpdGgobnVtKTtcbiAqIGNvbnNvbGUubG9nKGNsb25lZE51bSk7IC8vIDI5XG4gKiBjb25zb2xlLmxvZyhjbG9uZWROdW0gPT09IG51bSk7IC8vIHRydWVcbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gQ2xvbmUgYW4gb2JqZWN0IHdpdGggYSBjdXN0b21pemVyXG4gKiBjb25zdCBvYmogPSB7IGE6IDEsIGI6IDIgfTtcbiAqIGNvbnN0IGNsb25lZE9iaiA9IGNsb25lRGVlcFdpdGgob2JqLCAodmFsdWUpID0+IHtcbiAqICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicpIHtcbiAqICAgICByZXR1cm4gdmFsdWUgKiAyOyAvLyBEb3VibGUgdGhlIG51bWJlclxuICogICB9XG4gKiB9KTtcbiAqIGNvbnNvbGUubG9nKGNsb25lZE9iaik7IC8vIHsgYTogMiwgYjogNCB9XG4gKiBjb25zb2xlLmxvZyhjbG9uZWRPYmogPT09IG9iaik7IC8vIGZhbHNlXG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIENsb25lIGFuIGFycmF5IHdpdGggYSBjdXN0b21pemVyXG4gKiBjb25zdCBhcnIgPSBbMSwgMiwgM107XG4gKiBjb25zdCBjbG9uZWRBcnIgPSBjbG9uZURlZXBXaXRoKGFyciwgKHZhbHVlKSA9PiB7XG4gKiAgIHJldHVybiB2YWx1ZSArIDE7IC8vIEluY3JlbWVudCBlYWNoIHZhbHVlXG4gKiB9KTtcbiAqIGNvbnNvbGUubG9nKGNsb25lZEFycik7IC8vIFsyLCAzLCA0XVxuICogY29uc29sZS5sb2coY2xvbmVkQXJyID09PSBhcnIpOyAvLyBmYWxzZVxuICovXG5leHBvcnQgZnVuY3Rpb24gY2xvbmVEZWVwV2l0aDxUPihcbiAgb2JqOiBULFxuICBjbG9uZVZhbHVlPzogKHZhbHVlOiBhbnksIGtleTogUHJvcGVydHlLZXkgfCB1bmRlZmluZWQsIG9iamVjdDogVCB8IHVuZGVmaW5lZCwgc3RhY2s6IE1hcDxhbnksIGFueT4pID0+IGFueVxuKTogVCB7XG4gIHJldHVybiBjbG9uZURlZXBXaXRoVG9vbGtpdChvYmosICh2YWx1ZSwga2V5LCBvYmplY3QsIHN0YWNrKSA9PiB7XG4gICAgY29uc3QgY2xvbmVkID0gY2xvbmVWYWx1ZT8uKHZhbHVlLCBrZXksIG9iamVjdCwgc3RhY2spO1xuXG4gICAgaWYgKGNsb25lZCAhPSBudWxsKSB7XG4gICAgICByZXR1cm4gY2xvbmVkO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2Ygb2JqICE9PSAnb2JqZWN0Jykge1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICBzd2l0Y2ggKE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmopKSB7XG4gICAgICBjYXNlIG51bWJlclRhZzpcbiAgICAgIGNhc2Ugc3RyaW5nVGFnOlxuICAgICAgY2FzZSBib29sZWFuVGFnOiB7XG4gICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZVxuICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IG5ldyBvYmouY29uc3RydWN0b3Iob2JqPy52YWx1ZU9mKCkpIGFzIFQ7XG4gICAgICAgIGNvcHlQcm9wZXJ0aWVzKHJlc3VsdCwgb2JqKTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH1cblxuICAgICAgY2FzZSBhcmd1bWVudHNUYWc6IHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0ge30gYXMgYW55O1xuXG4gICAgICAgIGNvcHlQcm9wZXJ0aWVzKHJlc3VsdCwgb2JqKTtcblxuICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmVcbiAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICByZXN1bHQubGVuZ3RoID0gb2JqLmxlbmd0aDtcbiAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lXG4gICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgcmVzdWx0W1N5bWJvbC5pdGVyYXRvcl0gPSBvYmpbU3ltYm9sLml0ZXJhdG9yXTtcblxuICAgICAgICByZXR1cm4gcmVzdWx0IGFzIFQ7XG4gICAgICB9XG5cbiAgICAgIGRlZmF1bHQ6IHtcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsaUJBQWlCLG9CQUFvQixRQUFRLGdDQUFnQztBQUN0RixTQUFTLGNBQWMsUUFBUSxnQ0FBZ0M7QUFDL0QsU0FBUyxZQUFZLEVBQUUsVUFBVSxFQUFFLFNBQVMsRUFBRSxTQUFTLFFBQVEsdUJBQXVCO0FBRXRGOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBa0NDLEdBQ0QsT0FBTyxTQUFTLGNBQ2QsR0FBTSxFQUNOLFVBQTJHO0VBRTNHLE9BQU8scUJBQXFCLEtBQUssQ0FBQyxPQUFPLEtBQUssUUFBUTtJQUNwRCxNQUFNLFNBQVMsYUFBYSxPQUFPLEtBQUssUUFBUTtJQUVoRCxJQUFJLFVBQVUsTUFBTTtNQUNsQixPQUFPO0lBQ1Q7SUFFQSxJQUFJLE9BQU8sUUFBUSxVQUFVO01BQzNCLE9BQU87SUFDVDtJQUVBLE9BQVEsT0FBTyxTQUFTLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQztNQUNyQyxLQUFLO01BQ0wsS0FBSztNQUNMLEtBQUs7UUFBWTtVQUNmLDJCQUEyQjtVQUMzQixhQUFhO1VBQ2IsTUFBTSxTQUFTLElBQUksSUFBSSxXQUFXLENBQUMsS0FBSztVQUN4QyxlQUFlLFFBQVE7VUFDdkIsT0FBTztRQUNUO01BRUEsS0FBSztRQUFjO1VBQ2pCLE1BQU0sU0FBUyxDQUFDO1VBRWhCLGVBQWUsUUFBUTtVQUV2QiwyQkFBMkI7VUFDM0IsYUFBYTtVQUNiLE9BQU8sTUFBTSxHQUFHLElBQUksTUFBTTtVQUMxQiwyQkFBMkI7VUFDM0IsYUFBYTtVQUNiLE1BQU0sQ0FBQyxPQUFPLFFBQVEsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxPQUFPLFFBQVEsQ0FBQztVQUU5QyxPQUFPO1FBQ1Q7TUFFQTtRQUFTO1VBQ1AsT0FBTztRQUNUO0lBQ0Y7RUFDRjtBQUNGIn0=
// denoCacheMetadata=17032679576625867830,16760916918023656423