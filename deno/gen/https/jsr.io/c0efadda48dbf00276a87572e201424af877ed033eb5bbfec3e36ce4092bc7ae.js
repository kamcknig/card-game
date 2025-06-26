/**
 * Takes elements from the end of the array while the predicate function returns `true`.
 *
 * @template T - Type of elements in the input array.
 *
 * @param {T[]} arr - The array to take elements from.
 * @param {(item: T) => boolean} shouldContinueTaking - The function invoked per element.
 * @returns {T[]} A new array containing the elements taken from the end while the predicate returns `true`.
 *
 * @example
 * // Returns [3, 2, 1]
 * takeRightWhile([5, 4, 3, 2, 1], n => n < 4);
 *
 * @example
 * // Returns []
 * takeRightWhile([1, 2, 3], n => n > 3);
 */ export function takeRightWhile(arr, shouldContinueTaking) {
  for(let i = arr.length - 1; i >= 0; i--){
    if (!shouldContinueTaking(arr[i])) {
      return arr.slice(i + 1);
    }
  }
  return arr.slice();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9hcnJheS90YWtlUmlnaHRXaGlsZS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFRha2VzIGVsZW1lbnRzIGZyb20gdGhlIGVuZCBvZiB0aGUgYXJyYXkgd2hpbGUgdGhlIHByZWRpY2F0ZSBmdW5jdGlvbiByZXR1cm5zIGB0cnVlYC5cbiAqXG4gKiBAdGVtcGxhdGUgVCAtIFR5cGUgb2YgZWxlbWVudHMgaW4gdGhlIGlucHV0IGFycmF5LlxuICpcbiAqIEBwYXJhbSB7VFtdfSBhcnIgLSBUaGUgYXJyYXkgdG8gdGFrZSBlbGVtZW50cyBmcm9tLlxuICogQHBhcmFtIHsoaXRlbTogVCkgPT4gYm9vbGVhbn0gc2hvdWxkQ29udGludWVUYWtpbmcgLSBUaGUgZnVuY3Rpb24gaW52b2tlZCBwZXIgZWxlbWVudC5cbiAqIEByZXR1cm5zIHtUW119IEEgbmV3IGFycmF5IGNvbnRhaW5pbmcgdGhlIGVsZW1lbnRzIHRha2VuIGZyb20gdGhlIGVuZCB3aGlsZSB0aGUgcHJlZGljYXRlIHJldHVybnMgYHRydWVgLlxuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBSZXR1cm5zIFszLCAyLCAxXVxuICogdGFrZVJpZ2h0V2hpbGUoWzUsIDQsIDMsIDIsIDFdLCBuID0+IG4gPCA0KTtcbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gUmV0dXJucyBbXVxuICogdGFrZVJpZ2h0V2hpbGUoWzEsIDIsIDNdLCBuID0+IG4gPiAzKTtcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRha2VSaWdodFdoaWxlPFQ+KGFycjogcmVhZG9ubHkgVFtdLCBzaG91bGRDb250aW51ZVRha2luZzogKGl0ZW06IFQpID0+IGJvb2xlYW4pOiBUW10ge1xuICBmb3IgKGxldCBpID0gYXJyLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgaWYgKCFzaG91bGRDb250aW51ZVRha2luZyhhcnJbaV0pKSB7XG4gICAgICByZXR1cm4gYXJyLnNsaWNlKGkgKyAxKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gYXJyLnNsaWNlKCk7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FnQkMsR0FDRCxPQUFPLFNBQVMsZUFBa0IsR0FBaUIsRUFBRSxvQkFBMEM7RUFDN0YsSUFBSyxJQUFJLElBQUksSUFBSSxNQUFNLEdBQUcsR0FBRyxLQUFLLEdBQUcsSUFBSztJQUN4QyxJQUFJLENBQUMscUJBQXFCLEdBQUcsQ0FBQyxFQUFFLEdBQUc7TUFDakMsT0FBTyxJQUFJLEtBQUssQ0FBQyxJQUFJO0lBQ3ZCO0VBQ0Y7RUFFQSxPQUFPLElBQUksS0FBSztBQUNsQiJ9
// denoCacheMetadata=8807310063838145246,6859981218519477001