/**
 * Returns the intersection of two arrays based on a custom equality function.
 *
 * This function takes two arrays and a custom equality function. It returns a new array containing
 * the elements from the first array that have matching elements in the second array, as determined
 * by the custom equality function. It effectively filters out any elements from the first array that
 * do not have corresponding matches in the second array according to the equality function.
 *
 * @template T - The type of elements in the first array.
 * @template U - The type of elements in the second array.
 * @param {T[]} firstArr - The first array to compare.
 * @param {U[]} secondArr - The second array to compare.
 * @param {(x: T, y: U) => boolean} areItemsEqual - A custom function to determine if two elements are equal.
 * This function takes two arguments, one from each array, and returns `true` if the elements are considered equal, and `false` otherwise.
 * @returns {T[]} A new array containing the elements from the first array that have corresponding matches in the second array according to the custom equality function.
 *
 * @example
 * const array1 = [{ id: 1 }, { id: 2 }, { id: 3 }];
 * const array2 = [{ id: 2 }, { id: 4 }];
 * const areItemsEqual = (a, b) => a.id === b.id;
 * const result = intersectionWith(array1, array2, areItemsEqual);
 * // result will be [{ id: 2 }] since this element has a matching id in both arrays.
 *
 * @example
 * const array1 = [
 *   { id: 1, name: 'jane' },
 *   { id: 2, name: 'amy' },
 *   { id: 3, name: 'michael' },
 * ];
 * const array2 = [2, 4];
 * const areItemsEqual = (a, b) => a.id === b;
 * const result = intersectionWith(array1, array2, areItemsEqual);
 * // result will be [{ id: 2, name: 'amy' }] since this element has a matching id that is equal to seconds array's element.
 */ export function intersectionWith(firstArr, secondArr, areItemsEqual) {
  return firstArr.filter((firstItem)=>{
    return secondArr.some((secondItem)=>{
      return areItemsEqual(firstItem, secondItem);
    });
  });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9hcnJheS9pbnRlcnNlY3Rpb25XaXRoLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogUmV0dXJucyB0aGUgaW50ZXJzZWN0aW9uIG9mIHR3byBhcnJheXMgYmFzZWQgb24gYSBjdXN0b20gZXF1YWxpdHkgZnVuY3Rpb24uXG4gKlxuICogVGhpcyBmdW5jdGlvbiB0YWtlcyB0d28gYXJyYXlzIGFuZCBhIGN1c3RvbSBlcXVhbGl0eSBmdW5jdGlvbi4gSXQgcmV0dXJucyBhIG5ldyBhcnJheSBjb250YWluaW5nXG4gKiB0aGUgZWxlbWVudHMgZnJvbSB0aGUgZmlyc3QgYXJyYXkgdGhhdCBoYXZlIG1hdGNoaW5nIGVsZW1lbnRzIGluIHRoZSBzZWNvbmQgYXJyYXksIGFzIGRldGVybWluZWRcbiAqIGJ5IHRoZSBjdXN0b20gZXF1YWxpdHkgZnVuY3Rpb24uIEl0IGVmZmVjdGl2ZWx5IGZpbHRlcnMgb3V0IGFueSBlbGVtZW50cyBmcm9tIHRoZSBmaXJzdCBhcnJheSB0aGF0XG4gKiBkbyBub3QgaGF2ZSBjb3JyZXNwb25kaW5nIG1hdGNoZXMgaW4gdGhlIHNlY29uZCBhcnJheSBhY2NvcmRpbmcgdG8gdGhlIGVxdWFsaXR5IGZ1bmN0aW9uLlxuICpcbiAqIEB0ZW1wbGF0ZSBUIC0gVGhlIHR5cGUgb2YgZWxlbWVudHMgaW4gdGhlIGZpcnN0IGFycmF5LlxuICogQHRlbXBsYXRlIFUgLSBUaGUgdHlwZSBvZiBlbGVtZW50cyBpbiB0aGUgc2Vjb25kIGFycmF5LlxuICogQHBhcmFtIHtUW119IGZpcnN0QXJyIC0gVGhlIGZpcnN0IGFycmF5IHRvIGNvbXBhcmUuXG4gKiBAcGFyYW0ge1VbXX0gc2Vjb25kQXJyIC0gVGhlIHNlY29uZCBhcnJheSB0byBjb21wYXJlLlxuICogQHBhcmFtIHsoeDogVCwgeTogVSkgPT4gYm9vbGVhbn0gYXJlSXRlbXNFcXVhbCAtIEEgY3VzdG9tIGZ1bmN0aW9uIHRvIGRldGVybWluZSBpZiB0d28gZWxlbWVudHMgYXJlIGVxdWFsLlxuICogVGhpcyBmdW5jdGlvbiB0YWtlcyB0d28gYXJndW1lbnRzLCBvbmUgZnJvbSBlYWNoIGFycmF5LCBhbmQgcmV0dXJucyBgdHJ1ZWAgaWYgdGhlIGVsZW1lbnRzIGFyZSBjb25zaWRlcmVkIGVxdWFsLCBhbmQgYGZhbHNlYCBvdGhlcndpc2UuXG4gKiBAcmV0dXJucyB7VFtdfSBBIG5ldyBhcnJheSBjb250YWluaW5nIHRoZSBlbGVtZW50cyBmcm9tIHRoZSBmaXJzdCBhcnJheSB0aGF0IGhhdmUgY29ycmVzcG9uZGluZyBtYXRjaGVzIGluIHRoZSBzZWNvbmQgYXJyYXkgYWNjb3JkaW5nIHRvIHRoZSBjdXN0b20gZXF1YWxpdHkgZnVuY3Rpb24uXG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IGFycmF5MSA9IFt7IGlkOiAxIH0sIHsgaWQ6IDIgfSwgeyBpZDogMyB9XTtcbiAqIGNvbnN0IGFycmF5MiA9IFt7IGlkOiAyIH0sIHsgaWQ6IDQgfV07XG4gKiBjb25zdCBhcmVJdGVtc0VxdWFsID0gKGEsIGIpID0+IGEuaWQgPT09IGIuaWQ7XG4gKiBjb25zdCByZXN1bHQgPSBpbnRlcnNlY3Rpb25XaXRoKGFycmF5MSwgYXJyYXkyLCBhcmVJdGVtc0VxdWFsKTtcbiAqIC8vIHJlc3VsdCB3aWxsIGJlIFt7IGlkOiAyIH1dIHNpbmNlIHRoaXMgZWxlbWVudCBoYXMgYSBtYXRjaGluZyBpZCBpbiBib3RoIGFycmF5cy5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgYXJyYXkxID0gW1xuICogICB7IGlkOiAxLCBuYW1lOiAnamFuZScgfSxcbiAqICAgeyBpZDogMiwgbmFtZTogJ2FteScgfSxcbiAqICAgeyBpZDogMywgbmFtZTogJ21pY2hhZWwnIH0sXG4gKiBdO1xuICogY29uc3QgYXJyYXkyID0gWzIsIDRdO1xuICogY29uc3QgYXJlSXRlbXNFcXVhbCA9IChhLCBiKSA9PiBhLmlkID09PSBiO1xuICogY29uc3QgcmVzdWx0ID0gaW50ZXJzZWN0aW9uV2l0aChhcnJheTEsIGFycmF5MiwgYXJlSXRlbXNFcXVhbCk7XG4gKiAvLyByZXN1bHQgd2lsbCBiZSBbeyBpZDogMiwgbmFtZTogJ2FteScgfV0gc2luY2UgdGhpcyBlbGVtZW50IGhhcyBhIG1hdGNoaW5nIGlkIHRoYXQgaXMgZXF1YWwgdG8gc2Vjb25kcyBhcnJheSdzIGVsZW1lbnQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpbnRlcnNlY3Rpb25XaXRoPFQsIFU+KFxuICBmaXJzdEFycjogcmVhZG9ubHkgVFtdLFxuICBzZWNvbmRBcnI6IHJlYWRvbmx5IFVbXSxcbiAgYXJlSXRlbXNFcXVhbDogKHg6IFQsIHk6IFUpID0+IGJvb2xlYW5cbik6IFRbXSB7XG4gIHJldHVybiBmaXJzdEFyci5maWx0ZXIoZmlyc3RJdGVtID0+IHtcbiAgICByZXR1cm4gc2Vjb25kQXJyLnNvbWUoc2Vjb25kSXRlbSA9PiB7XG4gICAgICByZXR1cm4gYXJlSXRlbXNFcXVhbChmaXJzdEl0ZW0sIHNlY29uZEl0ZW0pO1xuICAgIH0pO1xuICB9KTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBaUNDLEdBQ0QsT0FBTyxTQUFTLGlCQUNkLFFBQXNCLEVBQ3RCLFNBQXVCLEVBQ3ZCLGFBQXNDO0VBRXRDLE9BQU8sU0FBUyxNQUFNLENBQUMsQ0FBQTtJQUNyQixPQUFPLFVBQVUsSUFBSSxDQUFDLENBQUE7TUFDcEIsT0FBTyxjQUFjLFdBQVc7SUFDbEM7RUFDRjtBQUNGIn0=
// denoCacheMetadata=10406171925931286597,7593708339061794432