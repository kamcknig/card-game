import { isBuffer } from '../../predicate/isBuffer.ts';
import { isPrototype } from '../_internal/isPrototype.ts';
import { isArrayLike } from '../predicate/isArrayLike.ts';
import { isTypedArray } from '../predicate/isTypedArray.ts';
import { times } from '../util/times.ts';
/**
 * Creates an array of the own enumerable property names of `object`.
 *
 * Non-object values are coerced to objects.
 *
 * @param {object} object The object to query.
 * @returns {string[]} Returns the array of property names.
 * @example
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 * Foo.prototype.c = 3;
 * keys(new Foo); // ['a', 'b'] (iteration order is not guaranteed)
 *
 * keys('hi'); // ['0', '1']
 * keys([1, 2, 3]); // ['0', '1', '2']
 * keys({ a: 1, b: 2 }); // ['a', 'b']
 */ export function keys(object) {
  if (isArrayLike(object)) {
    return arrayLikeKeys(object);
  }
  const result = Object.keys(Object(object));
  if (!isPrototype(object)) {
    return result;
  }
  return result.filter((key)=>key !== 'constructor');
}
function arrayLikeKeys(object) {
  const indices = times(object.length, (index)=>`${index}`);
  const filteredKeys = new Set(indices);
  if (isBuffer(object)) {
    // Node.js 0.10 has enumerable non-index properties on buffers.
    filteredKeys.add('offset');
    filteredKeys.add('parent');
  }
  if (isTypedArray(object)) {
    // PhantomJS 2 has enumerable non-index properties on typed arrays.
    filteredKeys.add('buffer');
    filteredKeys.add('byteLength');
    filteredKeys.add('byteOffset');
  }
  return [
    ...indices,
    ...Object.keys(object).filter((key)=>!filteredKeys.has(key))
  ];
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvb2JqZWN0L2tleXMudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgaXNCdWZmZXIgfSBmcm9tICcuLi8uLi9wcmVkaWNhdGUvaXNCdWZmZXIudHMnO1xuaW1wb3J0IHsgaXNQcm90b3R5cGUgfSBmcm9tICcuLi9faW50ZXJuYWwvaXNQcm90b3R5cGUudHMnO1xuaW1wb3J0IHsgaXNBcnJheUxpa2UgfSBmcm9tICcuLi9wcmVkaWNhdGUvaXNBcnJheUxpa2UudHMnO1xuaW1wb3J0IHsgaXNUeXBlZEFycmF5IH0gZnJvbSAnLi4vcHJlZGljYXRlL2lzVHlwZWRBcnJheS50cyc7XG5pbXBvcnQgeyB0aW1lcyB9IGZyb20gJy4uL3V0aWwvdGltZXMudHMnO1xuXG4vKipcbiAqIENyZWF0ZXMgYW4gYXJyYXkgb2YgdGhlIG93biBlbnVtZXJhYmxlIHByb3BlcnR5IG5hbWVzIG9mIGBvYmplY3RgLlxuICpcbiAqIE5vbi1vYmplY3QgdmFsdWVzIGFyZSBjb2VyY2VkIHRvIG9iamVjdHMuXG4gKlxuICogQHBhcmFtIHtvYmplY3R9IG9iamVjdCBUaGUgb2JqZWN0IHRvIHF1ZXJ5LlxuICogQHJldHVybnMge3N0cmluZ1tdfSBSZXR1cm5zIHRoZSBhcnJheSBvZiBwcm9wZXJ0eSBuYW1lcy5cbiAqIEBleGFtcGxlXG4gKiBmdW5jdGlvbiBGb28oKSB7XG4gKiAgIHRoaXMuYSA9IDE7XG4gKiAgIHRoaXMuYiA9IDI7XG4gKiB9XG4gKiBGb28ucHJvdG90eXBlLmMgPSAzO1xuICoga2V5cyhuZXcgRm9vKTsgLy8gWydhJywgJ2InXSAoaXRlcmF0aW9uIG9yZGVyIGlzIG5vdCBndWFyYW50ZWVkKVxuICpcbiAqIGtleXMoJ2hpJyk7IC8vIFsnMCcsICcxJ11cbiAqIGtleXMoWzEsIDIsIDNdKTsgLy8gWycwJywgJzEnLCAnMiddXG4gKiBrZXlzKHsgYTogMSwgYjogMiB9KTsgLy8gWydhJywgJ2InXVxuICovXG5leHBvcnQgZnVuY3Rpb24ga2V5cyhvYmplY3Q/OiBhbnkpOiBzdHJpbmdbXSB7XG4gIGlmIChpc0FycmF5TGlrZShvYmplY3QpKSB7XG4gICAgcmV0dXJuIGFycmF5TGlrZUtleXMob2JqZWN0KTtcbiAgfVxuXG4gIGNvbnN0IHJlc3VsdCA9IE9iamVjdC5rZXlzKE9iamVjdChvYmplY3QpKTtcblxuICBpZiAoIWlzUHJvdG90eXBlKG9iamVjdCkpIHtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgcmV0dXJuIHJlc3VsdC5maWx0ZXIoa2V5ID0+IGtleSAhPT0gJ2NvbnN0cnVjdG9yJyk7XG59XG5cbmZ1bmN0aW9uIGFycmF5TGlrZUtleXMob2JqZWN0OiBBcnJheUxpa2U8YW55Pik6IHN0cmluZ1tdIHtcbiAgY29uc3QgaW5kaWNlcyA9IHRpbWVzKG9iamVjdC5sZW5ndGgsIGluZGV4ID0+IGAke2luZGV4fWApO1xuXG4gIGNvbnN0IGZpbHRlcmVkS2V5cyA9IG5ldyBTZXQoaW5kaWNlcyk7XG5cbiAgaWYgKGlzQnVmZmVyKG9iamVjdCkpIHtcbiAgICAvLyBOb2RlLmpzIDAuMTAgaGFzIGVudW1lcmFibGUgbm9uLWluZGV4IHByb3BlcnRpZXMgb24gYnVmZmVycy5cbiAgICBmaWx0ZXJlZEtleXMuYWRkKCdvZmZzZXQnKTtcbiAgICBmaWx0ZXJlZEtleXMuYWRkKCdwYXJlbnQnKTtcbiAgfVxuXG4gIGlmIChpc1R5cGVkQXJyYXkob2JqZWN0KSkge1xuICAgIC8vIFBoYW50b21KUyAyIGhhcyBlbnVtZXJhYmxlIG5vbi1pbmRleCBwcm9wZXJ0aWVzIG9uIHR5cGVkIGFycmF5cy5cbiAgICBmaWx0ZXJlZEtleXMuYWRkKCdidWZmZXInKTtcbiAgICBmaWx0ZXJlZEtleXMuYWRkKCdieXRlTGVuZ3RoJyk7XG4gICAgZmlsdGVyZWRLZXlzLmFkZCgnYnl0ZU9mZnNldCcpO1xuICB9XG5cbiAgcmV0dXJuIFsuLi5pbmRpY2VzLCAuLi5PYmplY3Qua2V5cyhvYmplY3QpLmZpbHRlcihrZXkgPT4gIWZpbHRlcmVkS2V5cy5oYXMoa2V5KSldO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsUUFBUSxRQUFRLDhCQUE4QjtBQUN2RCxTQUFTLFdBQVcsUUFBUSw4QkFBOEI7QUFDMUQsU0FBUyxXQUFXLFFBQVEsOEJBQThCO0FBQzFELFNBQVMsWUFBWSxRQUFRLCtCQUErQjtBQUM1RCxTQUFTLEtBQUssUUFBUSxtQkFBbUI7QUFFekM7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQWtCQyxHQUNELE9BQU8sU0FBUyxLQUFLLE1BQVk7RUFDL0IsSUFBSSxZQUFZLFNBQVM7SUFDdkIsT0FBTyxjQUFjO0VBQ3ZCO0VBRUEsTUFBTSxTQUFTLE9BQU8sSUFBSSxDQUFDLE9BQU87RUFFbEMsSUFBSSxDQUFDLFlBQVksU0FBUztJQUN4QixPQUFPO0VBQ1Q7RUFFQSxPQUFPLE9BQU8sTUFBTSxDQUFDLENBQUEsTUFBTyxRQUFRO0FBQ3RDO0FBRUEsU0FBUyxjQUFjLE1BQXNCO0VBQzNDLE1BQU0sVUFBVSxNQUFNLE9BQU8sTUFBTSxFQUFFLENBQUEsUUFBUyxHQUFHLE9BQU87RUFFeEQsTUFBTSxlQUFlLElBQUksSUFBSTtFQUU3QixJQUFJLFNBQVMsU0FBUztJQUNwQiwrREFBK0Q7SUFDL0QsYUFBYSxHQUFHLENBQUM7SUFDakIsYUFBYSxHQUFHLENBQUM7RUFDbkI7RUFFQSxJQUFJLGFBQWEsU0FBUztJQUN4QixtRUFBbUU7SUFDbkUsYUFBYSxHQUFHLENBQUM7SUFDakIsYUFBYSxHQUFHLENBQUM7SUFDakIsYUFBYSxHQUFHLENBQUM7RUFDbkI7RUFFQSxPQUFPO09BQUk7T0FBWSxPQUFPLElBQUksQ0FBQyxRQUFRLE1BQU0sQ0FBQyxDQUFBLE1BQU8sQ0FBQyxhQUFhLEdBQUcsQ0FBQztHQUFNO0FBQ25GIn0=
// denoCacheMetadata=18140613853685851568,4011210776818910544