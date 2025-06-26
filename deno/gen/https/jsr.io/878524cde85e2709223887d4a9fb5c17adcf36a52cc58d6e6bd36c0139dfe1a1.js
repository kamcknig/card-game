import { difference as differenceToolkit } from '../../array/difference.ts';
import { toArray } from '../_internal/toArray.ts';
import { isArrayLikeObject } from '../predicate/isArrayLikeObject.ts';
/**
 * Computes the difference between an array and multiple arrays.
 *
 * @template T
 * @param {ArrayLike<T> | undefined | null} arr - The primary array from which to derive the difference. This is the main array
 * from which elements will be compared and filtered.
 * @param {Array<ArrayLike<T>>} values - Multiple arrays containing elements to be excluded from the primary array.
 * These arrays will be flattened into a single array, and each element in this array will be checked against the primary array.
 * If a match is found, that element will be excluded from the result.
 * @returns {T[]} A new array containing the elements that are present in the primary array but not
 * in the flattened array.
 *
 * @example
 * const array1 = [1, 2, 3, 4, 5];
 * const array2 = [2, 4];
 * const array3 = [5, 6];
 * const result = difference(array1, array2, array3);
 * // result will be [1, 3] since 2, 4, and 5 are in the other arrays and are excluded from the result.
 *
 * @example
 * const arrayLike1 = { 0: 1, 1: 2, 2: 3, length: 3 };
 * const arrayLike2 = { 0: 2, 1: 4, length: 2 };
 * const result = difference(arrayLike1, arrayLike2);
 * // result will be [1, 3] since 2 is in both array-like objects and is excluded from the result.
 */ export function difference(arr, ...values) {
  if (!isArrayLikeObject(arr)) {
    return [];
  }
  const arr1 = toArray(arr);
  const arr2 = [];
  for(let i = 0; i < values.length; i++){
    const value = values[i];
    if (isArrayLikeObject(value)) {
      arr2.push(...Array.from(value));
    }
  }
  return differenceToolkit(arr1, arr2);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvYXJyYXkvZGlmZmVyZW5jZS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBkaWZmZXJlbmNlIGFzIGRpZmZlcmVuY2VUb29sa2l0IH0gZnJvbSAnLi4vLi4vYXJyYXkvZGlmZmVyZW5jZS50cyc7XG5pbXBvcnQgeyB0b0FycmF5IH0gZnJvbSAnLi4vX2ludGVybmFsL3RvQXJyYXkudHMnO1xuaW1wb3J0IHsgaXNBcnJheUxpa2VPYmplY3QgfSBmcm9tICcuLi9wcmVkaWNhdGUvaXNBcnJheUxpa2VPYmplY3QudHMnO1xuXG4vKipcbiAqIENvbXB1dGVzIHRoZSBkaWZmZXJlbmNlIGJldHdlZW4gYW4gYXJyYXkgYW5kIG11bHRpcGxlIGFycmF5cy5cbiAqXG4gKiBAdGVtcGxhdGUgVFxuICogQHBhcmFtIHtBcnJheUxpa2U8VD4gfCB1bmRlZmluZWQgfCBudWxsfSBhcnIgLSBUaGUgcHJpbWFyeSBhcnJheSBmcm9tIHdoaWNoIHRvIGRlcml2ZSB0aGUgZGlmZmVyZW5jZS4gVGhpcyBpcyB0aGUgbWFpbiBhcnJheVxuICogZnJvbSB3aGljaCBlbGVtZW50cyB3aWxsIGJlIGNvbXBhcmVkIGFuZCBmaWx0ZXJlZC5cbiAqIEBwYXJhbSB7QXJyYXk8QXJyYXlMaWtlPFQ+Pn0gdmFsdWVzIC0gTXVsdGlwbGUgYXJyYXlzIGNvbnRhaW5pbmcgZWxlbWVudHMgdG8gYmUgZXhjbHVkZWQgZnJvbSB0aGUgcHJpbWFyeSBhcnJheS5cbiAqIFRoZXNlIGFycmF5cyB3aWxsIGJlIGZsYXR0ZW5lZCBpbnRvIGEgc2luZ2xlIGFycmF5LCBhbmQgZWFjaCBlbGVtZW50IGluIHRoaXMgYXJyYXkgd2lsbCBiZSBjaGVja2VkIGFnYWluc3QgdGhlIHByaW1hcnkgYXJyYXkuXG4gKiBJZiBhIG1hdGNoIGlzIGZvdW5kLCB0aGF0IGVsZW1lbnQgd2lsbCBiZSBleGNsdWRlZCBmcm9tIHRoZSByZXN1bHQuXG4gKiBAcmV0dXJucyB7VFtdfSBBIG5ldyBhcnJheSBjb250YWluaW5nIHRoZSBlbGVtZW50cyB0aGF0IGFyZSBwcmVzZW50IGluIHRoZSBwcmltYXJ5IGFycmF5IGJ1dCBub3RcbiAqIGluIHRoZSBmbGF0dGVuZWQgYXJyYXkuXG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IGFycmF5MSA9IFsxLCAyLCAzLCA0LCA1XTtcbiAqIGNvbnN0IGFycmF5MiA9IFsyLCA0XTtcbiAqIGNvbnN0IGFycmF5MyA9IFs1LCA2XTtcbiAqIGNvbnN0IHJlc3VsdCA9IGRpZmZlcmVuY2UoYXJyYXkxLCBhcnJheTIsIGFycmF5Myk7XG4gKiAvLyByZXN1bHQgd2lsbCBiZSBbMSwgM10gc2luY2UgMiwgNCwgYW5kIDUgYXJlIGluIHRoZSBvdGhlciBhcnJheXMgYW5kIGFyZSBleGNsdWRlZCBmcm9tIHRoZSByZXN1bHQuXG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IGFycmF5TGlrZTEgPSB7IDA6IDEsIDE6IDIsIDI6IDMsIGxlbmd0aDogMyB9O1xuICogY29uc3QgYXJyYXlMaWtlMiA9IHsgMDogMiwgMTogNCwgbGVuZ3RoOiAyIH07XG4gKiBjb25zdCByZXN1bHQgPSBkaWZmZXJlbmNlKGFycmF5TGlrZTEsIGFycmF5TGlrZTIpO1xuICogLy8gcmVzdWx0IHdpbGwgYmUgWzEsIDNdIHNpbmNlIDIgaXMgaW4gYm90aCBhcnJheS1saWtlIG9iamVjdHMgYW5kIGlzIGV4Y2x1ZGVkIGZyb20gdGhlIHJlc3VsdC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRpZmZlcmVuY2U8VD4oYXJyOiBBcnJheUxpa2U8VD4gfCB1bmRlZmluZWQgfCBudWxsLCAuLi52YWx1ZXM6IEFycmF5PEFycmF5TGlrZTxUPj4pOiBUW10ge1xuICBpZiAoIWlzQXJyYXlMaWtlT2JqZWN0KGFycikpIHtcbiAgICByZXR1cm4gW107XG4gIH1cblxuICBjb25zdCBhcnIxID0gdG9BcnJheShhcnIpO1xuICBjb25zdCBhcnIyID0gW107XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCB2YWx1ZXMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCB2YWx1ZSA9IHZhbHVlc1tpXTtcbiAgICBpZiAoaXNBcnJheUxpa2VPYmplY3QodmFsdWUpKSB7XG4gICAgICBhcnIyLnB1c2goLi4uQXJyYXkuZnJvbSh2YWx1ZSkpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBkaWZmZXJlbmNlVG9vbGtpdChhcnIxLCBhcnIyKTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLGNBQWMsaUJBQWlCLFFBQVEsNEJBQTRCO0FBQzVFLFNBQVMsT0FBTyxRQUFRLDBCQUEwQjtBQUNsRCxTQUFTLGlCQUFpQixRQUFRLG9DQUFvQztBQUV0RTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBd0JDLEdBQ0QsT0FBTyxTQUFTLFdBQWMsR0FBb0MsRUFBRSxHQUFHLE1BQTJCO0VBQ2hHLElBQUksQ0FBQyxrQkFBa0IsTUFBTTtJQUMzQixPQUFPLEVBQUU7RUFDWDtFQUVBLE1BQU0sT0FBTyxRQUFRO0VBQ3JCLE1BQU0sT0FBTyxFQUFFO0VBRWYsSUFBSyxJQUFJLElBQUksR0FBRyxJQUFJLE9BQU8sTUFBTSxFQUFFLElBQUs7SUFDdEMsTUFBTSxRQUFRLE1BQU0sQ0FBQyxFQUFFO0lBQ3ZCLElBQUksa0JBQWtCLFFBQVE7TUFDNUIsS0FBSyxJQUFJLElBQUksTUFBTSxJQUFJLENBQUM7SUFDMUI7RUFDRjtFQUVBLE9BQU8sa0JBQWtCLE1BQU07QUFDakMifQ==
// denoCacheMetadata=13491355326449467975,13343396158767219046