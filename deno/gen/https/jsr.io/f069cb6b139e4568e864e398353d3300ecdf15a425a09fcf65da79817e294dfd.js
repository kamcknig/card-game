/**
 * Removes elements from the end of an array until the predicate returns false.
 *
 * This function iterates over an array from the end and drops elements until the provided
 * predicate function returns false. It then returns a new array with the remaining elements.
 *
 * @template T - The type of elements in the array.
 * @param {T[]} arr - The array from which to drop elements.
 * @param {(item: T, index: number, arr: T[]) => boolean} canContinueDropping - A predicate function that determines
 * whether to continue dropping elements. The function is called with each element from the end,
 * and dropping continues as long as it returns true.
 * @returns {T[]} A new array with the elements remaining after the predicate returns false.
 *
 * @example
 * const array = [1, 2, 3, 4, 5];
 * const result = dropRightWhile(array, x => x > 3);
 * // result will be [1, 2, 3] since elements greater than 3 are dropped from the end.
 */ export function dropRightWhile(arr, canContinueDropping) {
  for(let i = arr.length - 1; i >= 0; i--){
    if (!canContinueDropping(arr[i], i, arr)) {
      return arr.slice(0, i + 1);
    }
  }
  return [];
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9hcnJheS9kcm9wUmlnaHRXaGlsZS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFJlbW92ZXMgZWxlbWVudHMgZnJvbSB0aGUgZW5kIG9mIGFuIGFycmF5IHVudGlsIHRoZSBwcmVkaWNhdGUgcmV0dXJucyBmYWxzZS5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIGl0ZXJhdGVzIG92ZXIgYW4gYXJyYXkgZnJvbSB0aGUgZW5kIGFuZCBkcm9wcyBlbGVtZW50cyB1bnRpbCB0aGUgcHJvdmlkZWRcbiAqIHByZWRpY2F0ZSBmdW5jdGlvbiByZXR1cm5zIGZhbHNlLiBJdCB0aGVuIHJldHVybnMgYSBuZXcgYXJyYXkgd2l0aCB0aGUgcmVtYWluaW5nIGVsZW1lbnRzLlxuICpcbiAqIEB0ZW1wbGF0ZSBUIC0gVGhlIHR5cGUgb2YgZWxlbWVudHMgaW4gdGhlIGFycmF5LlxuICogQHBhcmFtIHtUW119IGFyciAtIFRoZSBhcnJheSBmcm9tIHdoaWNoIHRvIGRyb3AgZWxlbWVudHMuXG4gKiBAcGFyYW0geyhpdGVtOiBULCBpbmRleDogbnVtYmVyLCBhcnI6IFRbXSkgPT4gYm9vbGVhbn0gY2FuQ29udGludWVEcm9wcGluZyAtIEEgcHJlZGljYXRlIGZ1bmN0aW9uIHRoYXQgZGV0ZXJtaW5lc1xuICogd2hldGhlciB0byBjb250aW51ZSBkcm9wcGluZyBlbGVtZW50cy4gVGhlIGZ1bmN0aW9uIGlzIGNhbGxlZCB3aXRoIGVhY2ggZWxlbWVudCBmcm9tIHRoZSBlbmQsXG4gKiBhbmQgZHJvcHBpbmcgY29udGludWVzIGFzIGxvbmcgYXMgaXQgcmV0dXJucyB0cnVlLlxuICogQHJldHVybnMge1RbXX0gQSBuZXcgYXJyYXkgd2l0aCB0aGUgZWxlbWVudHMgcmVtYWluaW5nIGFmdGVyIHRoZSBwcmVkaWNhdGUgcmV0dXJucyBmYWxzZS5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgYXJyYXkgPSBbMSwgMiwgMywgNCwgNV07XG4gKiBjb25zdCByZXN1bHQgPSBkcm9wUmlnaHRXaGlsZShhcnJheSwgeCA9PiB4ID4gMyk7XG4gKiAvLyByZXN1bHQgd2lsbCBiZSBbMSwgMiwgM10gc2luY2UgZWxlbWVudHMgZ3JlYXRlciB0aGFuIDMgYXJlIGRyb3BwZWQgZnJvbSB0aGUgZW5kLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZHJvcFJpZ2h0V2hpbGU8VD4oXG4gIGFycjogcmVhZG9ubHkgVFtdLFxuICBjYW5Db250aW51ZURyb3BwaW5nOiAoaXRlbTogVCwgaW5kZXg6IG51bWJlciwgYXJyOiByZWFkb25seSBUW10pID0+IGJvb2xlYW5cbik6IFRbXSB7XG4gIGZvciAobGV0IGkgPSBhcnIubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICBpZiAoIWNhbkNvbnRpbnVlRHJvcHBpbmcoYXJyW2ldLCBpLCBhcnIpKSB7XG4gICAgICByZXR1cm4gYXJyLnNsaWNlKDAsIGkgKyAxKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gW107XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBaUJDLEdBQ0QsT0FBTyxTQUFTLGVBQ2QsR0FBaUIsRUFDakIsbUJBQTJFO0VBRTNFLElBQUssSUFBSSxJQUFJLElBQUksTUFBTSxHQUFHLEdBQUcsS0FBSyxHQUFHLElBQUs7SUFDeEMsSUFBSSxDQUFDLG9CQUFvQixHQUFHLENBQUMsRUFBRSxFQUFFLEdBQUcsTUFBTTtNQUN4QyxPQUFPLElBQUksS0FBSyxDQUFDLEdBQUcsSUFBSTtJQUMxQjtFQUNGO0VBRUEsT0FBTyxFQUFFO0FBQ1gifQ==
// denoCacheMetadata=10457373069440890410,521760860199237174