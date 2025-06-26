/**
 * Computes the difference between two arrays after mapping their elements through a provided function.
 *
 * This function takes two arrays and a mapper function. It returns a new array containing the elements
 * that are present in the first array but not in the second array, based on the identity calculated
 * by the mapper function.
 *
 * Essentially, it filters out any elements from the first array that, when
 * mapped, match an element in the mapped version of the second array.
 *
 * @template T, U
 * @param {T[]} firstArr - The primary array from which to derive the difference.
 * @param {U[]} secondArr - The array containing elements to be excluded from the first array.
 * @param {(value: T | U) => unknown} mapper - The function to map the elements of both arrays. This function
 * is applied to each element in both arrays, and the comparison is made based on the mapped values.
 * @returns {T[]} A new array containing the elements from the first array that do not have a corresponding
 * mapped identity in the second array.
 *
 * @example
 * const array1 = [{ id: 1 }, { id: 2 }, { id: 3 }];
 * const array2 = [{ id: 2 }, { id: 4 }];
 * const mapper = item => item.id;
 * const result = differenceBy(array1, array2, mapper);
 * // result will be [{ id: 1 }, { id: 3 }] since the elements with id 2 are in both arrays and are excluded from the result.
 *
 * @example
 * const array1 = [{ id: 1 }, { id: 2 }, { id: 3 }];
 * const array2 = [2, 4];
 * const mapper = item => (typeof item === 'object' ? item.id : item);
 * const result = differenceBy(array1, array2, mapper);
 * // result will be [{ id: 1 }, { id: 3 }] since 2 is present in both arrays after mapping, and is excluded from the result.
 */ export function differenceBy(firstArr, secondArr, mapper) {
  const mappedSecondSet = new Set(secondArr.map((item)=>mapper(item)));
  return firstArr.filter((item)=>{
    return !mappedSecondSet.has(mapper(item));
  });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9hcnJheS9kaWZmZXJlbmNlQnkudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBDb21wdXRlcyB0aGUgZGlmZmVyZW5jZSBiZXR3ZWVuIHR3byBhcnJheXMgYWZ0ZXIgbWFwcGluZyB0aGVpciBlbGVtZW50cyB0aHJvdWdoIGEgcHJvdmlkZWQgZnVuY3Rpb24uXG4gKlxuICogVGhpcyBmdW5jdGlvbiB0YWtlcyB0d28gYXJyYXlzIGFuZCBhIG1hcHBlciBmdW5jdGlvbi4gSXQgcmV0dXJucyBhIG5ldyBhcnJheSBjb250YWluaW5nIHRoZSBlbGVtZW50c1xuICogdGhhdCBhcmUgcHJlc2VudCBpbiB0aGUgZmlyc3QgYXJyYXkgYnV0IG5vdCBpbiB0aGUgc2Vjb25kIGFycmF5LCBiYXNlZCBvbiB0aGUgaWRlbnRpdHkgY2FsY3VsYXRlZFxuICogYnkgdGhlIG1hcHBlciBmdW5jdGlvbi5cbiAqXG4gKiBFc3NlbnRpYWxseSwgaXQgZmlsdGVycyBvdXQgYW55IGVsZW1lbnRzIGZyb20gdGhlIGZpcnN0IGFycmF5IHRoYXQsIHdoZW5cbiAqIG1hcHBlZCwgbWF0Y2ggYW4gZWxlbWVudCBpbiB0aGUgbWFwcGVkIHZlcnNpb24gb2YgdGhlIHNlY29uZCBhcnJheS5cbiAqXG4gKiBAdGVtcGxhdGUgVCwgVVxuICogQHBhcmFtIHtUW119IGZpcnN0QXJyIC0gVGhlIHByaW1hcnkgYXJyYXkgZnJvbSB3aGljaCB0byBkZXJpdmUgdGhlIGRpZmZlcmVuY2UuXG4gKiBAcGFyYW0ge1VbXX0gc2Vjb25kQXJyIC0gVGhlIGFycmF5IGNvbnRhaW5pbmcgZWxlbWVudHMgdG8gYmUgZXhjbHVkZWQgZnJvbSB0aGUgZmlyc3QgYXJyYXkuXG4gKiBAcGFyYW0geyh2YWx1ZTogVCB8IFUpID0+IHVua25vd259IG1hcHBlciAtIFRoZSBmdW5jdGlvbiB0byBtYXAgdGhlIGVsZW1lbnRzIG9mIGJvdGggYXJyYXlzLiBUaGlzIGZ1bmN0aW9uXG4gKiBpcyBhcHBsaWVkIHRvIGVhY2ggZWxlbWVudCBpbiBib3RoIGFycmF5cywgYW5kIHRoZSBjb21wYXJpc29uIGlzIG1hZGUgYmFzZWQgb24gdGhlIG1hcHBlZCB2YWx1ZXMuXG4gKiBAcmV0dXJucyB7VFtdfSBBIG5ldyBhcnJheSBjb250YWluaW5nIHRoZSBlbGVtZW50cyBmcm9tIHRoZSBmaXJzdCBhcnJheSB0aGF0IGRvIG5vdCBoYXZlIGEgY29ycmVzcG9uZGluZ1xuICogbWFwcGVkIGlkZW50aXR5IGluIHRoZSBzZWNvbmQgYXJyYXkuXG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IGFycmF5MSA9IFt7IGlkOiAxIH0sIHsgaWQ6IDIgfSwgeyBpZDogMyB9XTtcbiAqIGNvbnN0IGFycmF5MiA9IFt7IGlkOiAyIH0sIHsgaWQ6IDQgfV07XG4gKiBjb25zdCBtYXBwZXIgPSBpdGVtID0+IGl0ZW0uaWQ7XG4gKiBjb25zdCByZXN1bHQgPSBkaWZmZXJlbmNlQnkoYXJyYXkxLCBhcnJheTIsIG1hcHBlcik7XG4gKiAvLyByZXN1bHQgd2lsbCBiZSBbeyBpZDogMSB9LCB7IGlkOiAzIH1dIHNpbmNlIHRoZSBlbGVtZW50cyB3aXRoIGlkIDIgYXJlIGluIGJvdGggYXJyYXlzIGFuZCBhcmUgZXhjbHVkZWQgZnJvbSB0aGUgcmVzdWx0LlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCBhcnJheTEgPSBbeyBpZDogMSB9LCB7IGlkOiAyIH0sIHsgaWQ6IDMgfV07XG4gKiBjb25zdCBhcnJheTIgPSBbMiwgNF07XG4gKiBjb25zdCBtYXBwZXIgPSBpdGVtID0+ICh0eXBlb2YgaXRlbSA9PT0gJ29iamVjdCcgPyBpdGVtLmlkIDogaXRlbSk7XG4gKiBjb25zdCByZXN1bHQgPSBkaWZmZXJlbmNlQnkoYXJyYXkxLCBhcnJheTIsIG1hcHBlcik7XG4gKiAvLyByZXN1bHQgd2lsbCBiZSBbeyBpZDogMSB9LCB7IGlkOiAzIH1dIHNpbmNlIDIgaXMgcHJlc2VudCBpbiBib3RoIGFycmF5cyBhZnRlciBtYXBwaW5nLCBhbmQgaXMgZXhjbHVkZWQgZnJvbSB0aGUgcmVzdWx0LlxuICovXG5leHBvcnQgZnVuY3Rpb24gZGlmZmVyZW5jZUJ5PFQsIFU+KFxuICBmaXJzdEFycjogcmVhZG9ubHkgVFtdLFxuICBzZWNvbmRBcnI6IHJlYWRvbmx5IFVbXSxcbiAgbWFwcGVyOiAodmFsdWU6IFQgfCBVKSA9PiB1bmtub3duXG4pOiBUW10ge1xuICBjb25zdCBtYXBwZWRTZWNvbmRTZXQgPSBuZXcgU2V0KHNlY29uZEFyci5tYXAoaXRlbSA9PiBtYXBwZXIoaXRlbSkpKTtcblxuICByZXR1cm4gZmlyc3RBcnIuZmlsdGVyKGl0ZW0gPT4ge1xuICAgIHJldHVybiAhbWFwcGVkU2Vjb25kU2V0LmhhcyhtYXBwZXIoaXRlbSkpO1xuICB9KTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQStCQyxHQUNELE9BQU8sU0FBUyxhQUNkLFFBQXNCLEVBQ3RCLFNBQXVCLEVBQ3ZCLE1BQWlDO0VBRWpDLE1BQU0sa0JBQWtCLElBQUksSUFBSSxVQUFVLEdBQUcsQ0FBQyxDQUFBLE9BQVEsT0FBTztFQUU3RCxPQUFPLFNBQVMsTUFBTSxDQUFDLENBQUE7SUFDckIsT0FBTyxDQUFDLGdCQUFnQixHQUFHLENBQUMsT0FBTztFQUNyQztBQUNGIn0=
// denoCacheMetadata=18438536409933635398,2804093116149744185