import { isMatch } from './isMatch.ts';
import { toKey } from '../_internal/toKey.ts';
import { cloneDeep } from '../object/cloneDeep.ts';
import { get } from '../object/get.ts';
import { has } from '../object/has.ts';
/**
 * Creates a function that checks if a given target object matches a specific property value.
 *
 * The returned function takes a target object and determines if the property at the
 * specified path within the target object is equal to the given value.
 *
 * @param {PropertyKey | PropertyKey[]} property - The property path to check within the target object.
 *     This can be a single property key or an array of property keys.
 * @param {unknown} source - The value to compare against the property value in the target object.
 *
 * @returns {(target: unknown) => boolean} - A function that takes a target object and returns
 *     `true` if the property value at the given path in the target object matches the provided value,
 *     otherwise returns `false`.
 *
 * @example
 * // Using a single property key
 * const checkName = matchesProperty('name', 'Alice');
 * console.log(checkName({ name: 'Alice' })); // true
 * console.log(checkName({ name: 'Bob' })); // false
 *
 * // Using an array of property keys
 * const checkNested = matchesProperty(['address', 'city'], 'New York');
 * console.log(checkNested({ address: { city: 'New York' } })); // true
 * console.log(checkNested({ address: { city: 'Los Angeles' } })); // false
 */ export function matchesProperty(property, source) {
  switch(typeof property){
    case 'object':
      {
        if (Object.is(property?.valueOf(), -0)) {
          property = '-0';
        }
        break;
      }
    case 'number':
      {
        property = toKey(property);
        break;
      }
  }
  source = cloneDeep(source);
  return function(target) {
    const result = get(target, property);
    if (result === undefined) {
      return has(target, property);
    }
    if (source === undefined) {
      return result === undefined;
    }
    return isMatch(result, source);
  };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvcHJlZGljYXRlL21hdGNoZXNQcm9wZXJ0eS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBpc01hdGNoIH0gZnJvbSAnLi9pc01hdGNoLnRzJztcbmltcG9ydCB7IHRvS2V5IH0gZnJvbSAnLi4vX2ludGVybmFsL3RvS2V5LnRzJztcbmltcG9ydCB7IGNsb25lRGVlcCB9IGZyb20gJy4uL29iamVjdC9jbG9uZURlZXAudHMnO1xuaW1wb3J0IHsgZ2V0IH0gZnJvbSAnLi4vb2JqZWN0L2dldC50cyc7XG5pbXBvcnQgeyBoYXMgfSBmcm9tICcuLi9vYmplY3QvaGFzLnRzJztcblxuLyoqXG4gKiBDcmVhdGVzIGEgZnVuY3Rpb24gdGhhdCBjaGVja3MgaWYgYSBnaXZlbiB0YXJnZXQgb2JqZWN0IG1hdGNoZXMgYSBzcGVjaWZpYyBwcm9wZXJ0eSB2YWx1ZS5cbiAqXG4gKiBUaGUgcmV0dXJuZWQgZnVuY3Rpb24gdGFrZXMgYSB0YXJnZXQgb2JqZWN0IGFuZCBkZXRlcm1pbmVzIGlmIHRoZSBwcm9wZXJ0eSBhdCB0aGVcbiAqIHNwZWNpZmllZCBwYXRoIHdpdGhpbiB0aGUgdGFyZ2V0IG9iamVjdCBpcyBlcXVhbCB0byB0aGUgZ2l2ZW4gdmFsdWUuXG4gKlxuICogQHBhcmFtIHtQcm9wZXJ0eUtleSB8IFByb3BlcnR5S2V5W119IHByb3BlcnR5IC0gVGhlIHByb3BlcnR5IHBhdGggdG8gY2hlY2sgd2l0aGluIHRoZSB0YXJnZXQgb2JqZWN0LlxuICogICAgIFRoaXMgY2FuIGJlIGEgc2luZ2xlIHByb3BlcnR5IGtleSBvciBhbiBhcnJheSBvZiBwcm9wZXJ0eSBrZXlzLlxuICogQHBhcmFtIHt1bmtub3dufSBzb3VyY2UgLSBUaGUgdmFsdWUgdG8gY29tcGFyZSBhZ2FpbnN0IHRoZSBwcm9wZXJ0eSB2YWx1ZSBpbiB0aGUgdGFyZ2V0IG9iamVjdC5cbiAqXG4gKiBAcmV0dXJucyB7KHRhcmdldDogdW5rbm93bikgPT4gYm9vbGVhbn0gLSBBIGZ1bmN0aW9uIHRoYXQgdGFrZXMgYSB0YXJnZXQgb2JqZWN0IGFuZCByZXR1cm5zXG4gKiAgICAgYHRydWVgIGlmIHRoZSBwcm9wZXJ0eSB2YWx1ZSBhdCB0aGUgZ2l2ZW4gcGF0aCBpbiB0aGUgdGFyZ2V0IG9iamVjdCBtYXRjaGVzIHRoZSBwcm92aWRlZCB2YWx1ZSxcbiAqICAgICBvdGhlcndpc2UgcmV0dXJucyBgZmFsc2VgLlxuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBVc2luZyBhIHNpbmdsZSBwcm9wZXJ0eSBrZXlcbiAqIGNvbnN0IGNoZWNrTmFtZSA9IG1hdGNoZXNQcm9wZXJ0eSgnbmFtZScsICdBbGljZScpO1xuICogY29uc29sZS5sb2coY2hlY2tOYW1lKHsgbmFtZTogJ0FsaWNlJyB9KSk7IC8vIHRydWVcbiAqIGNvbnNvbGUubG9nKGNoZWNrTmFtZSh7IG5hbWU6ICdCb2InIH0pKTsgLy8gZmFsc2VcbiAqXG4gKiAvLyBVc2luZyBhbiBhcnJheSBvZiBwcm9wZXJ0eSBrZXlzXG4gKiBjb25zdCBjaGVja05lc3RlZCA9IG1hdGNoZXNQcm9wZXJ0eShbJ2FkZHJlc3MnLCAnY2l0eSddLCAnTmV3IFlvcmsnKTtcbiAqIGNvbnNvbGUubG9nKGNoZWNrTmVzdGVkKHsgYWRkcmVzczogeyBjaXR5OiAnTmV3IFlvcmsnIH0gfSkpOyAvLyB0cnVlXG4gKiBjb25zb2xlLmxvZyhjaGVja05lc3RlZCh7IGFkZHJlc3M6IHsgY2l0eTogJ0xvcyBBbmdlbGVzJyB9IH0pKTsgLy8gZmFsc2VcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1hdGNoZXNQcm9wZXJ0eShcbiAgcHJvcGVydHk6IFByb3BlcnR5S2V5IHwgcmVhZG9ubHkgUHJvcGVydHlLZXlbXSxcbiAgc291cmNlOiB1bmtub3duXG4pOiAodGFyZ2V0PzogdW5rbm93bikgPT4gYm9vbGVhbiB7XG4gIHN3aXRjaCAodHlwZW9mIHByb3BlcnR5KSB7XG4gICAgY2FzZSAnb2JqZWN0Jzoge1xuICAgICAgaWYgKE9iamVjdC5pcyhwcm9wZXJ0eT8udmFsdWVPZigpLCAtMCkpIHtcbiAgICAgICAgcHJvcGVydHkgPSAnLTAnO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGNhc2UgJ251bWJlcic6IHtcbiAgICAgIHByb3BlcnR5ID0gdG9LZXkocHJvcGVydHkpO1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgc291cmNlID0gY2xvbmVEZWVwKHNvdXJjZSk7XG5cbiAgcmV0dXJuIGZ1bmN0aW9uICh0YXJnZXQ/OiB1bmtub3duKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gZ2V0KHRhcmdldCwgcHJvcGVydHkgYXMgUHJvcGVydHlLZXkgfCBQcm9wZXJ0eUtleVtdKTtcblxuICAgIGlmIChyZXN1bHQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIGhhcyh0YXJnZXQsIHByb3BlcnR5IGFzIFByb3BlcnR5S2V5IHwgUHJvcGVydHlLZXlbXSk7XG4gICAgfVxuXG4gICAgaWYgKHNvdXJjZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gcmVzdWx0ID09PSB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgcmV0dXJuIGlzTWF0Y2gocmVzdWx0LCBzb3VyY2UpO1xuICB9O1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsT0FBTyxRQUFRLGVBQWU7QUFDdkMsU0FBUyxLQUFLLFFBQVEsd0JBQXdCO0FBQzlDLFNBQVMsU0FBUyxRQUFRLHlCQUF5QjtBQUNuRCxTQUFTLEdBQUcsUUFBUSxtQkFBbUI7QUFDdkMsU0FBUyxHQUFHLFFBQVEsbUJBQW1CO0FBRXZDOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0F3QkMsR0FDRCxPQUFPLFNBQVMsZ0JBQ2QsUUFBOEMsRUFDOUMsTUFBZTtFQUVmLE9BQVEsT0FBTztJQUNiLEtBQUs7TUFBVTtRQUNiLElBQUksT0FBTyxFQUFFLENBQUMsVUFBVSxXQUFXLENBQUMsSUFBSTtVQUN0QyxXQUFXO1FBQ2I7UUFDQTtNQUNGO0lBQ0EsS0FBSztNQUFVO1FBQ2IsV0FBVyxNQUFNO1FBQ2pCO01BQ0Y7RUFDRjtFQUVBLFNBQVMsVUFBVTtFQUVuQixPQUFPLFNBQVUsTUFBZ0I7SUFDL0IsTUFBTSxTQUFTLElBQUksUUFBUTtJQUUzQixJQUFJLFdBQVcsV0FBVztNQUN4QixPQUFPLElBQUksUUFBUTtJQUNyQjtJQUVBLElBQUksV0FBVyxXQUFXO01BQ3hCLE9BQU8sV0FBVztJQUNwQjtJQUVBLE9BQU8sUUFBUSxRQUFRO0VBQ3pCO0FBQ0YifQ==
// denoCacheMetadata=11803518540992805134,10770779411782909679