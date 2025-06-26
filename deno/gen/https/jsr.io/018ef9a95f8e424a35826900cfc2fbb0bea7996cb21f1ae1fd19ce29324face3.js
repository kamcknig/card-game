import { after } from '../../function/after.ts';
import { noop } from '../../function/noop.ts';
import { isEqualWith as isEqualWithToolkit } from '../../predicate/isEqualWith.ts';
/**
 * Compares two values for equality using a custom comparison function.
 *
 * The custom function allows for fine-tuned control over the comparison process. If it returns a boolean, that result determines the equality. If it returns undefined, the function falls back to the default equality comparison.
 *
 * This function also uses the custom equality function to compare values inside objects,
 * arrays, maps, sets, and other complex structures, ensuring a deep comparison.
 *
 * This approach provides flexibility in handling complex comparisons while maintaining efficient default behavior for simpler cases.
 *
 * The custom comparison function can take up to six parameters:
 * - `x`: The value from the first object `a`.
 * - `y`: The value from the second object `b`.
 * - `property`: The property key used to get `x` and `y`.
 * - `xParent`: The parent of the first value `x`.
 * - `yParent`: The parent of the second value `y`.
 * - `stack`: An internal stack (Map) to handle circular references.
 *
 * @param {unknown} a - The first value to compare.
 * @param {unknown} b - The second value to compare.
 * @param {(x: any, y: any, property?: PropertyKey, xParent?: any, yParent?: any, stack?: Map<any, any>) => boolean | void} [areValuesEqual=noop] - A function to customize the comparison.
 *   If it returns a boolean, that result will be used. If it returns undefined,
 *   the default equality comparison will be used.
 * @returns {boolean} `true` if the values are equal according to the customizer, otherwise `false`.
 *
 * @example
 * const customizer = (a, b) => {
 *   if (typeof a === 'string' && typeof b === 'string') {
 *     return a.toLowerCase() === b.toLowerCase();
 *   }
 * };
 * isEqualWith('Hello', 'hello', customizer); // true
 * isEqualWith({ a: 'Hello' }, { a: 'hello' }, customizer); // true
 * isEqualWith([1, 2, 3], [1, 2, 3], customizer); // true
 */ export function isEqualWith(a, b, areValuesEqual = noop) {
  if (typeof areValuesEqual !== 'function') {
    areValuesEqual = noop;
  }
  return isEqualWithToolkit(a, b, (...args)=>{
    const result = areValuesEqual(...args);
    if (result !== undefined) {
      return Boolean(result);
    }
    if (a instanceof Map && b instanceof Map) {
      return isEqualWith(Array.from(a), Array.from(b), // areValuesEqual should not be called for converted values
      after(2, areValuesEqual));
    }
    if (a instanceof Set && b instanceof Set) {
      return isEqualWith(Array.from(a), Array.from(b), // areValuesEqual should not be called for converted values
      after(2, areValuesEqual));
    }
  });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvcHJlZGljYXRlL2lzRXF1YWxXaXRoLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGFmdGVyIH0gZnJvbSAnLi4vLi4vZnVuY3Rpb24vYWZ0ZXIudHMnO1xuaW1wb3J0IHsgbm9vcCB9IGZyb20gJy4uLy4uL2Z1bmN0aW9uL25vb3AudHMnO1xuaW1wb3J0IHsgaXNFcXVhbFdpdGggYXMgaXNFcXVhbFdpdGhUb29sa2l0IH0gZnJvbSAnLi4vLi4vcHJlZGljYXRlL2lzRXF1YWxXaXRoLnRzJztcblxuLyoqXG4gKiBDb21wYXJlcyB0d28gdmFsdWVzIGZvciBlcXVhbGl0eSB1c2luZyBhIGN1c3RvbSBjb21wYXJpc29uIGZ1bmN0aW9uLlxuICpcbiAqIFRoZSBjdXN0b20gZnVuY3Rpb24gYWxsb3dzIGZvciBmaW5lLXR1bmVkIGNvbnRyb2wgb3ZlciB0aGUgY29tcGFyaXNvbiBwcm9jZXNzLiBJZiBpdCByZXR1cm5zIGEgYm9vbGVhbiwgdGhhdCByZXN1bHQgZGV0ZXJtaW5lcyB0aGUgZXF1YWxpdHkuIElmIGl0IHJldHVybnMgdW5kZWZpbmVkLCB0aGUgZnVuY3Rpb24gZmFsbHMgYmFjayB0byB0aGUgZGVmYXVsdCBlcXVhbGl0eSBjb21wYXJpc29uLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gYWxzbyB1c2VzIHRoZSBjdXN0b20gZXF1YWxpdHkgZnVuY3Rpb24gdG8gY29tcGFyZSB2YWx1ZXMgaW5zaWRlIG9iamVjdHMsXG4gKiBhcnJheXMsIG1hcHMsIHNldHMsIGFuZCBvdGhlciBjb21wbGV4IHN0cnVjdHVyZXMsIGVuc3VyaW5nIGEgZGVlcCBjb21wYXJpc29uLlxuICpcbiAqIFRoaXMgYXBwcm9hY2ggcHJvdmlkZXMgZmxleGliaWxpdHkgaW4gaGFuZGxpbmcgY29tcGxleCBjb21wYXJpc29ucyB3aGlsZSBtYWludGFpbmluZyBlZmZpY2llbnQgZGVmYXVsdCBiZWhhdmlvciBmb3Igc2ltcGxlciBjYXNlcy5cbiAqXG4gKiBUaGUgY3VzdG9tIGNvbXBhcmlzb24gZnVuY3Rpb24gY2FuIHRha2UgdXAgdG8gc2l4IHBhcmFtZXRlcnM6XG4gKiAtIGB4YDogVGhlIHZhbHVlIGZyb20gdGhlIGZpcnN0IG9iamVjdCBgYWAuXG4gKiAtIGB5YDogVGhlIHZhbHVlIGZyb20gdGhlIHNlY29uZCBvYmplY3QgYGJgLlxuICogLSBgcHJvcGVydHlgOiBUaGUgcHJvcGVydHkga2V5IHVzZWQgdG8gZ2V0IGB4YCBhbmQgYHlgLlxuICogLSBgeFBhcmVudGA6IFRoZSBwYXJlbnQgb2YgdGhlIGZpcnN0IHZhbHVlIGB4YC5cbiAqIC0gYHlQYXJlbnRgOiBUaGUgcGFyZW50IG9mIHRoZSBzZWNvbmQgdmFsdWUgYHlgLlxuICogLSBgc3RhY2tgOiBBbiBpbnRlcm5hbCBzdGFjayAoTWFwKSB0byBoYW5kbGUgY2lyY3VsYXIgcmVmZXJlbmNlcy5cbiAqXG4gKiBAcGFyYW0ge3Vua25vd259IGEgLSBUaGUgZmlyc3QgdmFsdWUgdG8gY29tcGFyZS5cbiAqIEBwYXJhbSB7dW5rbm93bn0gYiAtIFRoZSBzZWNvbmQgdmFsdWUgdG8gY29tcGFyZS5cbiAqIEBwYXJhbSB7KHg6IGFueSwgeTogYW55LCBwcm9wZXJ0eT86IFByb3BlcnR5S2V5LCB4UGFyZW50PzogYW55LCB5UGFyZW50PzogYW55LCBzdGFjaz86IE1hcDxhbnksIGFueT4pID0+IGJvb2xlYW4gfCB2b2lkfSBbYXJlVmFsdWVzRXF1YWw9bm9vcF0gLSBBIGZ1bmN0aW9uIHRvIGN1c3RvbWl6ZSB0aGUgY29tcGFyaXNvbi5cbiAqICAgSWYgaXQgcmV0dXJucyBhIGJvb2xlYW4sIHRoYXQgcmVzdWx0IHdpbGwgYmUgdXNlZC4gSWYgaXQgcmV0dXJucyB1bmRlZmluZWQsXG4gKiAgIHRoZSBkZWZhdWx0IGVxdWFsaXR5IGNvbXBhcmlzb24gd2lsbCBiZSB1c2VkLlxuICogQHJldHVybnMge2Jvb2xlYW59IGB0cnVlYCBpZiB0aGUgdmFsdWVzIGFyZSBlcXVhbCBhY2NvcmRpbmcgdG8gdGhlIGN1c3RvbWl6ZXIsIG90aGVyd2lzZSBgZmFsc2VgLlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCBjdXN0b21pemVyID0gKGEsIGIpID0+IHtcbiAqICAgaWYgKHR5cGVvZiBhID09PSAnc3RyaW5nJyAmJiB0eXBlb2YgYiA9PT0gJ3N0cmluZycpIHtcbiAqICAgICByZXR1cm4gYS50b0xvd2VyQ2FzZSgpID09PSBiLnRvTG93ZXJDYXNlKCk7XG4gKiAgIH1cbiAqIH07XG4gKiBpc0VxdWFsV2l0aCgnSGVsbG8nLCAnaGVsbG8nLCBjdXN0b21pemVyKTsgLy8gdHJ1ZVxuICogaXNFcXVhbFdpdGgoeyBhOiAnSGVsbG8nIH0sIHsgYTogJ2hlbGxvJyB9LCBjdXN0b21pemVyKTsgLy8gdHJ1ZVxuICogaXNFcXVhbFdpdGgoWzEsIDIsIDNdLCBbMSwgMiwgM10sIGN1c3RvbWl6ZXIpOyAvLyB0cnVlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc0VxdWFsV2l0aChcbiAgYTogYW55LFxuICBiOiBhbnksXG4gIGFyZVZhbHVlc0VxdWFsOiAoXG4gICAgYTogYW55LFxuICAgIGI6IGFueSxcbiAgICBwcm9wZXJ0eT86IFByb3BlcnR5S2V5LFxuICAgIGFQYXJlbnQ/OiBhbnksXG4gICAgYlBhcmVudD86IGFueSxcbiAgICBzdGFjaz86IE1hcDxhbnksIGFueT5cbiAgKSA9PiBib29sZWFuIHwgdm9pZCA9IG5vb3Bcbik6IGJvb2xlYW4ge1xuICBpZiAodHlwZW9mIGFyZVZhbHVlc0VxdWFsICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgYXJlVmFsdWVzRXF1YWwgPSBub29wO1xuICB9XG5cbiAgcmV0dXJuIGlzRXF1YWxXaXRoVG9vbGtpdChhLCBiLCAoLi4uYXJncyk6IGJvb2xlYW4gfCB2b2lkID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhcmVWYWx1ZXNFcXVhbCguLi5hcmdzKTtcblxuICAgIGlmIChyZXN1bHQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIEJvb2xlYW4ocmVzdWx0KTtcbiAgICB9XG5cbiAgICBpZiAoYSBpbnN0YW5jZW9mIE1hcCAmJiBiIGluc3RhbmNlb2YgTWFwKSB7XG4gICAgICByZXR1cm4gaXNFcXVhbFdpdGgoXG4gICAgICAgIEFycmF5LmZyb20oYSksXG4gICAgICAgIEFycmF5LmZyb20oYiksXG4gICAgICAgIC8vIGFyZVZhbHVlc0VxdWFsIHNob3VsZCBub3QgYmUgY2FsbGVkIGZvciBjb252ZXJ0ZWQgdmFsdWVzXG4gICAgICAgIGFmdGVyKDIsIGFyZVZhbHVlc0VxdWFsKVxuICAgICAgKTtcbiAgICB9XG5cbiAgICBpZiAoYSBpbnN0YW5jZW9mIFNldCAmJiBiIGluc3RhbmNlb2YgU2V0KSB7XG4gICAgICByZXR1cm4gaXNFcXVhbFdpdGgoXG4gICAgICAgIEFycmF5LmZyb20oYSksXG4gICAgICAgIEFycmF5LmZyb20oYiksXG4gICAgICAgIC8vIGFyZVZhbHVlc0VxdWFsIHNob3VsZCBub3QgYmUgY2FsbGVkIGZvciBjb252ZXJ0ZWQgdmFsdWVzXG4gICAgICAgIGFmdGVyKDIsIGFyZVZhbHVlc0VxdWFsKVxuICAgICAgKTtcbiAgICB9XG4gIH0pO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsS0FBSyxRQUFRLDBCQUEwQjtBQUNoRCxTQUFTLElBQUksUUFBUSx5QkFBeUI7QUFDOUMsU0FBUyxlQUFlLGtCQUFrQixRQUFRLGlDQUFpQztBQUVuRjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQWtDQyxHQUNELE9BQU8sU0FBUyxZQUNkLENBQU0sRUFDTixDQUFNLEVBQ04saUJBT3NCLElBQUk7RUFFMUIsSUFBSSxPQUFPLG1CQUFtQixZQUFZO0lBQ3hDLGlCQUFpQjtFQUNuQjtFQUVBLE9BQU8sbUJBQW1CLEdBQUcsR0FBRyxDQUFDLEdBQUc7SUFDbEMsTUFBTSxTQUFTLGtCQUFrQjtJQUVqQyxJQUFJLFdBQVcsV0FBVztNQUN4QixPQUFPLFFBQVE7SUFDakI7SUFFQSxJQUFJLGFBQWEsT0FBTyxhQUFhLEtBQUs7TUFDeEMsT0FBTyxZQUNMLE1BQU0sSUFBSSxDQUFDLElBQ1gsTUFBTSxJQUFJLENBQUMsSUFDWCwyREFBMkQ7TUFDM0QsTUFBTSxHQUFHO0lBRWI7SUFFQSxJQUFJLGFBQWEsT0FBTyxhQUFhLEtBQUs7TUFDeEMsT0FBTyxZQUNMLE1BQU0sSUFBSSxDQUFDLElBQ1gsTUFBTSxJQUFJLENBQUMsSUFDWCwyREFBMkQ7TUFDM0QsTUFBTSxHQUFHO0lBRWI7RUFDRjtBQUNGIn0=
// denoCacheMetadata=16711974683927118779,15538353365067077257