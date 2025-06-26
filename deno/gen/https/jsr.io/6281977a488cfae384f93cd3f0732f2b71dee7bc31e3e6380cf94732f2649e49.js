import { isBuffer } from '../../predicate/isBuffer.ts';
import { isPrototype } from '../_internal/isPrototype.ts';
import { isArrayLike } from '../predicate/isArrayLike.ts';
import { isTypedArray } from '../predicate/isTypedArray.ts';
import { times } from '../util/times.ts';
/**
 * This function retrieves the names of string-keyed properties from an object, including those inherited from its prototype.
 *
 * - If the value is not an object, it is converted to an object.
 * - Array-like objects are treated like arrays.
 * - Sparse arrays with some missing indices are treated like dense arrays.
 * - If the value is `null` or `undefined`, an empty array is returned.
 * - When handling prototype objects, the `constructor` property is excluded from the results.
 *
 * @param {unknown} [object] - The object to inspect for keys.
 * @returns {string[]} An array of string keys from the object.
 *
 * @example
 * const obj = { a: 1, b: 2 };
 * console.log(keysIn(obj)); // ['a', 'b']
 *
 * const arr = [1, 2, 3];
 * console.log(keysIn(arr)); // ['0', '1', '2']
 *
 * function Foo() {}
 * Foo.prototype.a = 1;
 * console.log(keysIn(new Foo())); // ['a']
 */ export function keysIn(object) {
  if (object == null) {
    return [];
  }
  switch(typeof object){
    case 'object':
    case 'function':
      {
        if (isArrayLike(object)) {
          return arrayLikeKeysIn(object);
        }
        if (isPrototype(object)) {
          return prototypeKeysIn(object);
        }
        return keysInImpl(object);
      }
    default:
      {
        return keysInImpl(Object(object));
      }
  }
}
function keysInImpl(object) {
  const result = [];
  for(const key in object){
    result.push(key);
  }
  return result;
}
function prototypeKeysIn(object) {
  const keys = keysInImpl(object);
  return keys.filter((key)=>key !== 'constructor');
}
function arrayLikeKeysIn(object) {
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
    ...keysInImpl(object).filter((key)=>!filteredKeys.has(key))
  ];
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvb2JqZWN0L2tleXNJbi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBpc0J1ZmZlciB9IGZyb20gJy4uLy4uL3ByZWRpY2F0ZS9pc0J1ZmZlci50cyc7XG5pbXBvcnQgeyBpc1Byb3RvdHlwZSB9IGZyb20gJy4uL19pbnRlcm5hbC9pc1Byb3RvdHlwZS50cyc7XG5pbXBvcnQgeyBpc0FycmF5TGlrZSB9IGZyb20gJy4uL3ByZWRpY2F0ZS9pc0FycmF5TGlrZS50cyc7XG5pbXBvcnQgeyBpc1R5cGVkQXJyYXkgfSBmcm9tICcuLi9wcmVkaWNhdGUvaXNUeXBlZEFycmF5LnRzJztcbmltcG9ydCB7IHRpbWVzIH0gZnJvbSAnLi4vdXRpbC90aW1lcy50cyc7XG5cbi8qKlxuICogVGhpcyBmdW5jdGlvbiByZXRyaWV2ZXMgdGhlIG5hbWVzIG9mIHN0cmluZy1rZXllZCBwcm9wZXJ0aWVzIGZyb20gYW4gb2JqZWN0LCBpbmNsdWRpbmcgdGhvc2UgaW5oZXJpdGVkIGZyb20gaXRzIHByb3RvdHlwZS5cbiAqXG4gKiAtIElmIHRoZSB2YWx1ZSBpcyBub3QgYW4gb2JqZWN0LCBpdCBpcyBjb252ZXJ0ZWQgdG8gYW4gb2JqZWN0LlxuICogLSBBcnJheS1saWtlIG9iamVjdHMgYXJlIHRyZWF0ZWQgbGlrZSBhcnJheXMuXG4gKiAtIFNwYXJzZSBhcnJheXMgd2l0aCBzb21lIG1pc3NpbmcgaW5kaWNlcyBhcmUgdHJlYXRlZCBsaWtlIGRlbnNlIGFycmF5cy5cbiAqIC0gSWYgdGhlIHZhbHVlIGlzIGBudWxsYCBvciBgdW5kZWZpbmVkYCwgYW4gZW1wdHkgYXJyYXkgaXMgcmV0dXJuZWQuXG4gKiAtIFdoZW4gaGFuZGxpbmcgcHJvdG90eXBlIG9iamVjdHMsIHRoZSBgY29uc3RydWN0b3JgIHByb3BlcnR5IGlzIGV4Y2x1ZGVkIGZyb20gdGhlIHJlc3VsdHMuXG4gKlxuICogQHBhcmFtIHt1bmtub3dufSBbb2JqZWN0XSAtIFRoZSBvYmplY3QgdG8gaW5zcGVjdCBmb3Iga2V5cy5cbiAqIEByZXR1cm5zIHtzdHJpbmdbXX0gQW4gYXJyYXkgb2Ygc3RyaW5nIGtleXMgZnJvbSB0aGUgb2JqZWN0LlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCBvYmogPSB7IGE6IDEsIGI6IDIgfTtcbiAqIGNvbnNvbGUubG9nKGtleXNJbihvYmopKTsgLy8gWydhJywgJ2InXVxuICpcbiAqIGNvbnN0IGFyciA9IFsxLCAyLCAzXTtcbiAqIGNvbnNvbGUubG9nKGtleXNJbihhcnIpKTsgLy8gWycwJywgJzEnLCAnMiddXG4gKlxuICogZnVuY3Rpb24gRm9vKCkge31cbiAqIEZvby5wcm90b3R5cGUuYSA9IDE7XG4gKiBjb25zb2xlLmxvZyhrZXlzSW4obmV3IEZvbygpKSk7IC8vIFsnYSddXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBrZXlzSW4ob2JqZWN0PzogdW5rbm93bik6IHN0cmluZ1tdIHtcbiAgaWYgKG9iamVjdCA9PSBudWxsKSB7XG4gICAgcmV0dXJuIFtdO1xuICB9XG5cbiAgc3dpdGNoICh0eXBlb2Ygb2JqZWN0KSB7XG4gICAgY2FzZSAnb2JqZWN0JzpcbiAgICBjYXNlICdmdW5jdGlvbic6IHtcbiAgICAgIGlmIChpc0FycmF5TGlrZShvYmplY3QpKSB7XG4gICAgICAgIHJldHVybiBhcnJheUxpa2VLZXlzSW4ob2JqZWN0KTtcbiAgICAgIH1cblxuICAgICAgaWYgKGlzUHJvdG90eXBlKG9iamVjdCkpIHtcbiAgICAgICAgcmV0dXJuIHByb3RvdHlwZUtleXNJbihvYmplY3QpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4ga2V5c0luSW1wbChvYmplY3QpO1xuICAgIH1cblxuICAgIGRlZmF1bHQ6IHtcbiAgICAgIHJldHVybiBrZXlzSW5JbXBsKE9iamVjdChvYmplY3QpKTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24ga2V5c0luSW1wbChvYmplY3Q6IG9iamVjdCk6IHN0cmluZ1tdIHtcbiAgY29uc3QgcmVzdWx0OiBzdHJpbmdbXSA9IFtdO1xuXG4gIGZvciAoY29uc3Qga2V5IGluIG9iamVjdCkge1xuICAgIHJlc3VsdC5wdXNoKGtleSk7XG4gIH1cblxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBwcm90b3R5cGVLZXlzSW4ob2JqZWN0OiBvYmplY3QpOiBzdHJpbmdbXSB7XG4gIGNvbnN0IGtleXMgPSBrZXlzSW5JbXBsKG9iamVjdCk7XG5cbiAgcmV0dXJuIGtleXMuZmlsdGVyKGtleSA9PiBrZXkgIT09ICdjb25zdHJ1Y3RvcicpO1xufVxuXG5mdW5jdGlvbiBhcnJheUxpa2VLZXlzSW4ob2JqZWN0OiBBcnJheUxpa2U8YW55Pik6IHN0cmluZ1tdIHtcbiAgY29uc3QgaW5kaWNlcyA9IHRpbWVzKG9iamVjdC5sZW5ndGgsIGluZGV4ID0+IGAke2luZGV4fWApO1xuXG4gIGNvbnN0IGZpbHRlcmVkS2V5cyA9IG5ldyBTZXQoaW5kaWNlcyk7XG5cbiAgaWYgKGlzQnVmZmVyKG9iamVjdCkpIHtcbiAgICAvLyBOb2RlLmpzIDAuMTAgaGFzIGVudW1lcmFibGUgbm9uLWluZGV4IHByb3BlcnRpZXMgb24gYnVmZmVycy5cbiAgICBmaWx0ZXJlZEtleXMuYWRkKCdvZmZzZXQnKTtcbiAgICBmaWx0ZXJlZEtleXMuYWRkKCdwYXJlbnQnKTtcbiAgfVxuXG4gIGlmIChpc1R5cGVkQXJyYXkob2JqZWN0KSkge1xuICAgIC8vIFBoYW50b21KUyAyIGhhcyBlbnVtZXJhYmxlIG5vbi1pbmRleCBwcm9wZXJ0aWVzIG9uIHR5cGVkIGFycmF5cy5cbiAgICBmaWx0ZXJlZEtleXMuYWRkKCdidWZmZXInKTtcbiAgICBmaWx0ZXJlZEtleXMuYWRkKCdieXRlTGVuZ3RoJyk7XG4gICAgZmlsdGVyZWRLZXlzLmFkZCgnYnl0ZU9mZnNldCcpO1xuICB9XG5cbiAgcmV0dXJuIFsuLi5pbmRpY2VzLCAuLi5rZXlzSW5JbXBsKG9iamVjdCkuZmlsdGVyKGtleSA9PiAhZmlsdGVyZWRLZXlzLmhhcyhrZXkpKV07XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxRQUFRLFFBQVEsOEJBQThCO0FBQ3ZELFNBQVMsV0FBVyxRQUFRLDhCQUE4QjtBQUMxRCxTQUFTLFdBQVcsUUFBUSw4QkFBOEI7QUFDMUQsU0FBUyxZQUFZLFFBQVEsK0JBQStCO0FBQzVELFNBQVMsS0FBSyxRQUFRLG1CQUFtQjtBQUV6Qzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQXNCQyxHQUNELE9BQU8sU0FBUyxPQUFPLE1BQWdCO0VBQ3JDLElBQUksVUFBVSxNQUFNO0lBQ2xCLE9BQU8sRUFBRTtFQUNYO0VBRUEsT0FBUSxPQUFPO0lBQ2IsS0FBSztJQUNMLEtBQUs7TUFBWTtRQUNmLElBQUksWUFBWSxTQUFTO1VBQ3ZCLE9BQU8sZ0JBQWdCO1FBQ3pCO1FBRUEsSUFBSSxZQUFZLFNBQVM7VUFDdkIsT0FBTyxnQkFBZ0I7UUFDekI7UUFFQSxPQUFPLFdBQVc7TUFDcEI7SUFFQTtNQUFTO1FBQ1AsT0FBTyxXQUFXLE9BQU87TUFDM0I7RUFDRjtBQUNGO0FBRUEsU0FBUyxXQUFXLE1BQWM7RUFDaEMsTUFBTSxTQUFtQixFQUFFO0VBRTNCLElBQUssTUFBTSxPQUFPLE9BQVE7SUFDeEIsT0FBTyxJQUFJLENBQUM7RUFDZDtFQUVBLE9BQU87QUFDVDtBQUVBLFNBQVMsZ0JBQWdCLE1BQWM7RUFDckMsTUFBTSxPQUFPLFdBQVc7RUFFeEIsT0FBTyxLQUFLLE1BQU0sQ0FBQyxDQUFBLE1BQU8sUUFBUTtBQUNwQztBQUVBLFNBQVMsZ0JBQWdCLE1BQXNCO0VBQzdDLE1BQU0sVUFBVSxNQUFNLE9BQU8sTUFBTSxFQUFFLENBQUEsUUFBUyxHQUFHLE9BQU87RUFFeEQsTUFBTSxlQUFlLElBQUksSUFBSTtFQUU3QixJQUFJLFNBQVMsU0FBUztJQUNwQiwrREFBK0Q7SUFDL0QsYUFBYSxHQUFHLENBQUM7SUFDakIsYUFBYSxHQUFHLENBQUM7RUFDbkI7RUFFQSxJQUFJLGFBQWEsU0FBUztJQUN4QixtRUFBbUU7SUFDbkUsYUFBYSxHQUFHLENBQUM7SUFDakIsYUFBYSxHQUFHLENBQUM7SUFDakIsYUFBYSxHQUFHLENBQUM7RUFDbkI7RUFFQSxPQUFPO09BQUk7T0FBWSxXQUFXLFFBQVEsTUFBTSxDQUFDLENBQUEsTUFBTyxDQUFDLGFBQWEsR0FBRyxDQUFDO0dBQU07QUFDbEYifQ==
// denoCacheMetadata=5678008459356624134,5424454136965628596