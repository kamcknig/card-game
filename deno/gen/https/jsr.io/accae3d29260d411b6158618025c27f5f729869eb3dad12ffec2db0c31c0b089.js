import { identity } from '../../function/identity.ts';
import { property } from '../object/property.ts';
import { matches } from '../predicate/matches.ts';
import { matchesProperty } from '../predicate/matchesProperty.ts';
/**
 * Creates a function that returns a value from an element in a collection.
 *
 * You can call `iteratee` with the following types of arguments:
 *
 * - **Function**: Returns the function as-is, which will be called with the element from the collection.
 * - **Property name**: Returns the value of the specified property from the element.
 * - **Property-value pair**: Returns a boolean indicating whether the element's property matches the given value.
 * - **Partial object**: Returns a boolean indicating whether the element matches the properties of the partial object.
 *
 * If you don't provide any arguments or pass `null`, this function will return a function that simply returns its input unchanged.
 *
 * @param {symbol | number | string | object | null | ((...args: any[]) => any)} value - The value to convert to an iteratee.
 * @returns {(...args: any[]) => unknown} - Returns the new iteratee function.
 * @example
 * const func = iteratee();
 * [{ a: 1 }, { a: 2 }, { a: 3 }].map(func) // => [{ a: 1 }, { a: 2 }, { a: 3 }]
 *
 * const func = iteratee((object) => object.a);
 * [{ a: 1 }, { a: 2 }, { a: 3 }].map(func) // => [1, 2, 3]
 *
 * const func = iteratee('a');
 * [{ a: 1 }, { a: 2 }, { a: 3 }].map(func) // => [1, 2, 3]
 *
 * const func = iteratee({ a: 1 });
 * [{ a: 1 }, { a: 2 }, { a: 3 }].find(func) // => { a: 1 }
 *
 * const func = iteratee(['a', 1]);
 * [{ a: 1 }, { a: 2 }, { a: 3 }].find(func) // => { a: 1 }
 */ export function iteratee(value) {
  if (value == null) {
    return identity;
  }
  switch(typeof value){
    case 'function':
      {
        return value;
      }
    case 'object':
      {
        if (Array.isArray(value) && value.length === 2) {
          return matchesProperty(value[0], value[1]);
        }
        return matches(value);
      }
    case 'string':
    case 'symbol':
    case 'number':
      {
        return property(value);
      }
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvdXRpbC9pdGVyYXRlZS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBpZGVudGl0eSB9IGZyb20gJy4uLy4uL2Z1bmN0aW9uL2lkZW50aXR5LnRzJztcbmltcG9ydCB7IHByb3BlcnR5IH0gZnJvbSAnLi4vb2JqZWN0L3Byb3BlcnR5LnRzJztcbmltcG9ydCB7IG1hdGNoZXMgfSBmcm9tICcuLi9wcmVkaWNhdGUvbWF0Y2hlcy50cyc7XG5pbXBvcnQgeyBtYXRjaGVzUHJvcGVydHkgfSBmcm9tICcuLi9wcmVkaWNhdGUvbWF0Y2hlc1Byb3BlcnR5LnRzJztcblxuLyoqXG4gKiBSZXR1cm5zIGEgYGlkZW50aXR5YCBmdW5jdGlvbiB3aGVuIGB2YWx1ZWAgaXMgYG51bGxgIG9yIGB1bmRlZmluZWRgLlxuICpcbiAqIEBwYXJhbSB7bnVsbH0gW3ZhbHVlXSAtIFRoZSB2YWx1ZSB0byBjb252ZXJ0IHRvIGFuIGl0ZXJhdGVlLlxuICogQHJldHVybnMgezxUPih2YWx1ZTogVCkgPT4gVH0gLSBSZXR1cm5zIGEgYGlkZW50aXR5YCBmdW5jdGlvbi5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgZnVuYyA9IGl0ZXJhdGVlKCk7XG4gKiBbeyBhOiAxIH0sIHsgYTogMiB9LCB7IGE6IDMgfV0ubWFwKGZ1bmMpIC8vID0+IFt7IGE6IDEgfSwgeyBhOiAyIH0sIHsgYTogMyB9XVxuICovXG5leHBvcnQgZnVuY3Rpb24gaXRlcmF0ZWUodmFsdWU/OiBudWxsKTogPFQ+KHZhbHVlOiBUKSA9PiBUO1xuXG4vKipcbiAqIFJldHVybnMgYSBnaXZlbiBgZnVuY2AgZnVuY3Rpb24gd2hlbiBgdmFsdWVgIGlzIGEgYGZ1bmN0aW9uYC5cbiAqXG4gKiBAdGVtcGxhdGUgeyguLi5hcmdzOiBhbnlbXSkgPT4gdW5rbm93bn0gRiAtIFRoZSBmdW5jdGlvbiB0eXBlLlxuICogQHBhcmFtIHtGfSBmdW5jIC0gVGhlIGZ1bmN0aW9uIHRvIHJldHVybi5cbiAqIEByZXR1cm5zIHtGfSAtIFJldHVybnMgdGhlIGdpdmVuIGZ1bmN0aW9uLlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCBmdW5jID0gaXRlcmF0ZWUoKG9iamVjdCkgPT4gb2JqZWN0LmEpO1xuICogW3sgYTogMSB9LCB7IGE6IDIgfSwgeyBhOiAzIH1dLm1hcChmdW5jKSAvLyA9PiBbMSwgMiwgM11cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGl0ZXJhdGVlPEYgZXh0ZW5kcyAoLi4uYXJnczogYW55W10pID0+IHVua25vd24+KGZ1bmM6IEYpOiBGO1xuXG4vKipcbiAqIENyZWF0ZXMgYSBmdW5jdGlvbiB0aGF0IGludm9rZXMgYHZhbHVlYCB3aXRoIHRoZSBhcmd1bWVudHMgb2YgdGhlIGNyZWF0ZWQgZnVuY3Rpb24uXG4gKlxuICogVGhlIGNyZWF0ZWQgZnVuY3Rpb24gcmV0dXJucyB0aGUgcHJvcGVydHkgdmFsdWUgZm9yIGEgZ2l2ZW4gZWxlbWVudC5cbiAqXG4gKiBAcGFyYW0ge3N5bWJvbCB8IG51bWJlciB8IHN0cmluZyB8IG9iamVjdH0gdmFsdWUgLSBUaGUgdmFsdWUgdG8gY29udmVydCB0byBhbiBpdGVyYXRlZS5cbiAqIEByZXR1cm5zIHsoLi4uYXJnczogYW55W10pID0+IGFueX0gLSBSZXR1cm5zIHRoZSBuZXcgaXRlcmF0ZWUgZnVuY3Rpb24uXG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IGZ1bmMgPSBpdGVyYXRlZSgnYScpO1xuICogW3sgYTogMSB9LCB7IGE6IDIgfSwgeyBhOiAzIH1dLm1hcChmdW5jKSAvLyA9PiBbMSwgMiwgM11cbiAqXG4gKiBjb25zdCBmdW5jID0gaXRlcmF0ZWUoeyBhOiAxIH0pO1xuICogW3sgYTogMSB9LCB7IGE6IDIgfSwgeyBhOiAzIH1dLmZpbmQoZnVuYykgLy8gPT4geyBhOiAxIH1cbiAqXG4gKiBjb25zdCBmdW5jID0gaXRlcmF0ZWUoWydhJywgMV0pO1xuICogW3sgYTogMSB9LCB7IGE6IDIgfSwgeyBhOiAzIH1dLmZpbmQoZnVuYykgLy8gPT4geyBhOiAxIH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGl0ZXJhdGVlKHZhbHVlPzogc3ltYm9sIHwgbnVtYmVyIHwgc3RyaW5nIHwgb2JqZWN0KTogKC4uLmFyZ3M6IGFueVtdKSA9PiBhbnk7XG5cbi8qKlxuICogQ3JlYXRlcyBhIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyBhIHZhbHVlIGZyb20gYW4gZWxlbWVudCBpbiBhIGNvbGxlY3Rpb24uXG4gKlxuICogWW91IGNhbiBjYWxsIGBpdGVyYXRlZWAgd2l0aCB0aGUgZm9sbG93aW5nIHR5cGVzIG9mIGFyZ3VtZW50czpcbiAqXG4gKiAtICoqRnVuY3Rpb24qKjogUmV0dXJucyB0aGUgZnVuY3Rpb24gYXMtaXMsIHdoaWNoIHdpbGwgYmUgY2FsbGVkIHdpdGggdGhlIGVsZW1lbnQgZnJvbSB0aGUgY29sbGVjdGlvbi5cbiAqIC0gKipQcm9wZXJ0eSBuYW1lKio6IFJldHVybnMgdGhlIHZhbHVlIG9mIHRoZSBzcGVjaWZpZWQgcHJvcGVydHkgZnJvbSB0aGUgZWxlbWVudC5cbiAqIC0gKipQcm9wZXJ0eS12YWx1ZSBwYWlyKio6IFJldHVybnMgYSBib29sZWFuIGluZGljYXRpbmcgd2hldGhlciB0aGUgZWxlbWVudCdzIHByb3BlcnR5IG1hdGNoZXMgdGhlIGdpdmVuIHZhbHVlLlxuICogLSAqKlBhcnRpYWwgb2JqZWN0Kio6IFJldHVybnMgYSBib29sZWFuIGluZGljYXRpbmcgd2hldGhlciB0aGUgZWxlbWVudCBtYXRjaGVzIHRoZSBwcm9wZXJ0aWVzIG9mIHRoZSBwYXJ0aWFsIG9iamVjdC5cbiAqXG4gKiBJZiB5b3UgZG9uJ3QgcHJvdmlkZSBhbnkgYXJndW1lbnRzIG9yIHBhc3MgYG51bGxgLCB0aGlzIGZ1bmN0aW9uIHdpbGwgcmV0dXJuIGEgZnVuY3Rpb24gdGhhdCBzaW1wbHkgcmV0dXJucyBpdHMgaW5wdXQgdW5jaGFuZ2VkLlxuICpcbiAqIEBwYXJhbSB7c3ltYm9sIHwgbnVtYmVyIHwgc3RyaW5nIHwgb2JqZWN0IHwgbnVsbCB8ICgoLi4uYXJnczogYW55W10pID0+IGFueSl9IHZhbHVlIC0gVGhlIHZhbHVlIHRvIGNvbnZlcnQgdG8gYW4gaXRlcmF0ZWUuXG4gKiBAcmV0dXJucyB7KC4uLmFyZ3M6IGFueVtdKSA9PiB1bmtub3dufSAtIFJldHVybnMgdGhlIG5ldyBpdGVyYXRlZSBmdW5jdGlvbi5cbiAqIEBleGFtcGxlXG4gKiBjb25zdCBmdW5jID0gaXRlcmF0ZWUoKTtcbiAqIFt7IGE6IDEgfSwgeyBhOiAyIH0sIHsgYTogMyB9XS5tYXAoZnVuYykgLy8gPT4gW3sgYTogMSB9LCB7IGE6IDIgfSwgeyBhOiAzIH1dXG4gKlxuICogY29uc3QgZnVuYyA9IGl0ZXJhdGVlKChvYmplY3QpID0+IG9iamVjdC5hKTtcbiAqIFt7IGE6IDEgfSwgeyBhOiAyIH0sIHsgYTogMyB9XS5tYXAoZnVuYykgLy8gPT4gWzEsIDIsIDNdXG4gKlxuICogY29uc3QgZnVuYyA9IGl0ZXJhdGVlKCdhJyk7XG4gKiBbeyBhOiAxIH0sIHsgYTogMiB9LCB7IGE6IDMgfV0ubWFwKGZ1bmMpIC8vID0+IFsxLCAyLCAzXVxuICpcbiAqIGNvbnN0IGZ1bmMgPSBpdGVyYXRlZSh7IGE6IDEgfSk7XG4gKiBbeyBhOiAxIH0sIHsgYTogMiB9LCB7IGE6IDMgfV0uZmluZChmdW5jKSAvLyA9PiB7IGE6IDEgfVxuICpcbiAqIGNvbnN0IGZ1bmMgPSBpdGVyYXRlZShbJ2EnLCAxXSk7XG4gKiBbeyBhOiAxIH0sIHsgYTogMiB9LCB7IGE6IDMgfV0uZmluZChmdW5jKSAvLyA9PiB7IGE6IDEgfVxuICovXG5leHBvcnQgZnVuY3Rpb24gaXRlcmF0ZWUoXG4gIHZhbHVlPzogc3ltYm9sIHwgbnVtYmVyIHwgc3RyaW5nIHwgb2JqZWN0IHwgbnVsbCB8ICgoLi4uYXJnczogYW55W10pID0+IHVua25vd24pXG4pOiAoLi4uYXJnczogYW55W10pID0+IGFueSB7XG4gIGlmICh2YWx1ZSA9PSBudWxsKSB7XG4gICAgcmV0dXJuIGlkZW50aXR5O1xuICB9XG5cbiAgc3dpdGNoICh0eXBlb2YgdmFsdWUpIHtcbiAgICBjYXNlICdmdW5jdGlvbic6IHtcbiAgICAgIHJldHVybiB2YWx1ZSBhcyBhbnk7XG4gICAgfVxuICAgIGNhc2UgJ29iamVjdCc6IHtcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSAmJiB2YWx1ZS5sZW5ndGggPT09IDIpIHtcbiAgICAgICAgcmV0dXJuIG1hdGNoZXNQcm9wZXJ0eSh2YWx1ZVswXSwgdmFsdWVbMV0pO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gbWF0Y2hlcyh2YWx1ZSk7XG4gICAgfVxuICAgIGNhc2UgJ3N0cmluZyc6XG4gICAgY2FzZSAnc3ltYm9sJzpcbiAgICBjYXNlICdudW1iZXInOiB7XG4gICAgICByZXR1cm4gcHJvcGVydHkodmFsdWUpO1xuICAgIH1cbiAgfVxufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsUUFBUSxRQUFRLDZCQUE2QjtBQUN0RCxTQUFTLFFBQVEsUUFBUSx3QkFBd0I7QUFDakQsU0FBUyxPQUFPLFFBQVEsMEJBQTBCO0FBQ2xELFNBQVMsZUFBZSxRQUFRLGtDQUFrQztBQStDbEU7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBNkJDLEdBQ0QsT0FBTyxTQUFTLFNBQ2QsS0FBZ0Y7RUFFaEYsSUFBSSxTQUFTLE1BQU07SUFDakIsT0FBTztFQUNUO0VBRUEsT0FBUSxPQUFPO0lBQ2IsS0FBSztNQUFZO1FBQ2YsT0FBTztNQUNUO0lBQ0EsS0FBSztNQUFVO1FBQ2IsSUFBSSxNQUFNLE9BQU8sQ0FBQyxVQUFVLE1BQU0sTUFBTSxLQUFLLEdBQUc7VUFDOUMsT0FBTyxnQkFBZ0IsS0FBSyxDQUFDLEVBQUUsRUFBRSxLQUFLLENBQUMsRUFBRTtRQUMzQztRQUVBLE9BQU8sUUFBUTtNQUNqQjtJQUNBLEtBQUs7SUFDTCxLQUFLO0lBQ0wsS0FBSztNQUFVO1FBQ2IsT0FBTyxTQUFTO01BQ2xCO0VBQ0Y7QUFDRiJ9
// denoCacheMetadata=7595731739258212890,17673501709388781973