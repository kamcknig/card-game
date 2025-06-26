import { conformsTo } from './conformsTo.ts';
import { cloneDeep } from '../../object/cloneDeep.ts';
/**
 * Creates a function that invokes the predicate properties of `source` with the corresponding property values of a given object, returning `true` if all predicates return truthy, else `false`.
 *
 * Note: The created function is equivalent to `conformsTo` with source partially applied.
 *
 * @param {Record<PropertyKey, (value: any) => boolean>} source The object of property predicates to conform to.
 * @returns {(object: Record<PropertyKey, any>) => boolean} Returns the new spec function.
 *
 * @example
 * const isPositive = (n) => n > 0;
 * const isEven = (n) => n % 2 === 0;
 * const predicates = { a: isPositive, b: isEven };
 * const conform = conforms(predicates);
 *
 * console.log(conform({ a: 2, b: 4 })); // true
 * console.log(conform({ a: -1, b: 4 })); // false
 * console.log(conform({ a: 2, b: 3 })); // false
 * console.log(conform({ a: 0, b: 2 })); // false
 */ export function conforms(source) {
  source = cloneDeep(source);
  return function(object) {
    return conformsTo(object, source);
  };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvcHJlZGljYXRlL2NvbmZvcm1zLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGNvbmZvcm1zVG8gfSBmcm9tICcuL2NvbmZvcm1zVG8udHMnO1xuaW1wb3J0IHsgY2xvbmVEZWVwIH0gZnJvbSAnLi4vLi4vb2JqZWN0L2Nsb25lRGVlcC50cyc7XG5cbi8qKlxuICogQ3JlYXRlcyBhIGZ1bmN0aW9uIHRoYXQgaW52b2tlcyB0aGUgcHJlZGljYXRlIHByb3BlcnRpZXMgb2YgYHNvdXJjZWAgd2l0aCB0aGUgY29ycmVzcG9uZGluZyBwcm9wZXJ0eSB2YWx1ZXMgb2YgYSBnaXZlbiBvYmplY3QsIHJldHVybmluZyBgdHJ1ZWAgaWYgYWxsIHByZWRpY2F0ZXMgcmV0dXJuIHRydXRoeSwgZWxzZSBgZmFsc2VgLlxuICpcbiAqIE5vdGU6IFRoZSBjcmVhdGVkIGZ1bmN0aW9uIGlzIGVxdWl2YWxlbnQgdG8gYGNvbmZvcm1zVG9gIHdpdGggc291cmNlIHBhcnRpYWxseSBhcHBsaWVkLlxuICpcbiAqIEBwYXJhbSB7UmVjb3JkPFByb3BlcnR5S2V5LCAodmFsdWU6IGFueSkgPT4gYm9vbGVhbj59IHNvdXJjZSBUaGUgb2JqZWN0IG9mIHByb3BlcnR5IHByZWRpY2F0ZXMgdG8gY29uZm9ybSB0by5cbiAqIEByZXR1cm5zIHsob2JqZWN0OiBSZWNvcmQ8UHJvcGVydHlLZXksIGFueT4pID0+IGJvb2xlYW59IFJldHVybnMgdGhlIG5ldyBzcGVjIGZ1bmN0aW9uLlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCBpc1Bvc2l0aXZlID0gKG4pID0+IG4gPiAwO1xuICogY29uc3QgaXNFdmVuID0gKG4pID0+IG4gJSAyID09PSAwO1xuICogY29uc3QgcHJlZGljYXRlcyA9IHsgYTogaXNQb3NpdGl2ZSwgYjogaXNFdmVuIH07XG4gKiBjb25zdCBjb25mb3JtID0gY29uZm9ybXMocHJlZGljYXRlcyk7XG4gKlxuICogY29uc29sZS5sb2coY29uZm9ybSh7IGE6IDIsIGI6IDQgfSkpOyAvLyB0cnVlXG4gKiBjb25zb2xlLmxvZyhjb25mb3JtKHsgYTogLTEsIGI6IDQgfSkpOyAvLyBmYWxzZVxuICogY29uc29sZS5sb2coY29uZm9ybSh7IGE6IDIsIGI6IDMgfSkpOyAvLyBmYWxzZVxuICogY29uc29sZS5sb2coY29uZm9ybSh7IGE6IDAsIGI6IDIgfSkpOyAvLyBmYWxzZVxuICovXG5leHBvcnQgZnVuY3Rpb24gY29uZm9ybXMoXG4gIHNvdXJjZTogUmVjb3JkPFByb3BlcnR5S2V5LCAodmFsdWU6IGFueSkgPT4gYm9vbGVhbj5cbik6IChvYmplY3Q6IFJlY29yZDxQcm9wZXJ0eUtleSwgYW55PikgPT4gYm9vbGVhbiB7XG4gIHNvdXJjZSA9IGNsb25lRGVlcChzb3VyY2UpO1xuXG4gIHJldHVybiBmdW5jdGlvbiAob2JqZWN0OiBSZWNvcmQ8UHJvcGVydHlLZXksIGFueT4pIHtcbiAgICByZXR1cm4gY29uZm9ybXNUbyhvYmplY3QsIHNvdXJjZSk7XG4gIH07XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxVQUFVLFFBQVEsa0JBQWtCO0FBQzdDLFNBQVMsU0FBUyxRQUFRLDRCQUE0QjtBQUV0RDs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBa0JDLEdBQ0QsT0FBTyxTQUFTLFNBQ2QsTUFBb0Q7RUFFcEQsU0FBUyxVQUFVO0VBRW5CLE9BQU8sU0FBVSxNQUFnQztJQUMvQyxPQUFPLFdBQVcsUUFBUTtFQUM1QjtBQUNGIn0=
// denoCacheMetadata=6496203867793231949,4552608450082161242