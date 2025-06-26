import { randomInt } from '../math/randomInt.ts';
/**
 * Returns a sample element array of a specified `size`.
 *
 * This function takes an array and a number, and returns an array containing the sampled elements using Floyd's algorithm.
 *
 * {@link https://www.nowherenearithaca.com/2013/05/robert-floyds-tiny-and-beautiful.html Floyd's algorithm}
 *
 * @template T - The type of elements in the array.
 * @param {T[]} array - The array to sample from.
 * @param {number} size - The size of sample.
 * @returns {T[]} A new array with sample size applied.
 * @throws {Error} Throws an error if `size` is greater than the length of `array`.
 *
 * @example
 * const result = sampleSize([1, 2, 3], 2)
 * // result will be an array containing two of the elements from the array.
 * // [1, 2] or [1, 3] or [2, 3]
 */ export function sampleSize(array, size) {
  if (size > array.length) {
    throw new Error('Size must be less than or equal to the length of array.');
  }
  const result = new Array(size);
  const selected = new Set();
  for(let step = array.length - size, resultIndex = 0; step < array.length; step++, resultIndex++){
    let index = randomInt(0, step + 1);
    if (selected.has(index)) {
      index = step;
    }
    selected.add(index);
    result[resultIndex] = array[index];
  }
  return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9hcnJheS9zYW1wbGVTaXplLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHJhbmRvbUludCB9IGZyb20gJy4uL21hdGgvcmFuZG9tSW50LnRzJztcblxuLyoqXG4gKiBSZXR1cm5zIGEgc2FtcGxlIGVsZW1lbnQgYXJyYXkgb2YgYSBzcGVjaWZpZWQgYHNpemVgLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gdGFrZXMgYW4gYXJyYXkgYW5kIGEgbnVtYmVyLCBhbmQgcmV0dXJucyBhbiBhcnJheSBjb250YWluaW5nIHRoZSBzYW1wbGVkIGVsZW1lbnRzIHVzaW5nIEZsb3lkJ3MgYWxnb3JpdGhtLlxuICpcbiAqIHtAbGluayBodHRwczovL3d3dy5ub3doZXJlbmVhcml0aGFjYS5jb20vMjAxMy8wNS9yb2JlcnQtZmxveWRzLXRpbnktYW5kLWJlYXV0aWZ1bC5odG1sIEZsb3lkJ3MgYWxnb3JpdGhtfVxuICpcbiAqIEB0ZW1wbGF0ZSBUIC0gVGhlIHR5cGUgb2YgZWxlbWVudHMgaW4gdGhlIGFycmF5LlxuICogQHBhcmFtIHtUW119IGFycmF5IC0gVGhlIGFycmF5IHRvIHNhbXBsZSBmcm9tLlxuICogQHBhcmFtIHtudW1iZXJ9IHNpemUgLSBUaGUgc2l6ZSBvZiBzYW1wbGUuXG4gKiBAcmV0dXJucyB7VFtdfSBBIG5ldyBhcnJheSB3aXRoIHNhbXBsZSBzaXplIGFwcGxpZWQuXG4gKiBAdGhyb3dzIHtFcnJvcn0gVGhyb3dzIGFuIGVycm9yIGlmIGBzaXplYCBpcyBncmVhdGVyIHRoYW4gdGhlIGxlbmd0aCBvZiBgYXJyYXlgLlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCByZXN1bHQgPSBzYW1wbGVTaXplKFsxLCAyLCAzXSwgMilcbiAqIC8vIHJlc3VsdCB3aWxsIGJlIGFuIGFycmF5IGNvbnRhaW5pbmcgdHdvIG9mIHRoZSBlbGVtZW50cyBmcm9tIHRoZSBhcnJheS5cbiAqIC8vIFsxLCAyXSBvciBbMSwgM10gb3IgWzIsIDNdXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzYW1wbGVTaXplPFQ+KGFycmF5OiByZWFkb25seSBUW10sIHNpemU6IG51bWJlcik6IFRbXSB7XG4gIGlmIChzaXplID4gYXJyYXkubGVuZ3RoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdTaXplIG11c3QgYmUgbGVzcyB0aGFuIG9yIGVxdWFsIHRvIHRoZSBsZW5ndGggb2YgYXJyYXkuJyk7XG4gIH1cblxuICBjb25zdCByZXN1bHQgPSBuZXcgQXJyYXkoc2l6ZSk7XG4gIGNvbnN0IHNlbGVjdGVkID0gbmV3IFNldCgpO1xuXG4gIGZvciAobGV0IHN0ZXAgPSBhcnJheS5sZW5ndGggLSBzaXplLCByZXN1bHRJbmRleCA9IDA7IHN0ZXAgPCBhcnJheS5sZW5ndGg7IHN0ZXArKywgcmVzdWx0SW5kZXgrKykge1xuICAgIGxldCBpbmRleCA9IHJhbmRvbUludCgwLCBzdGVwICsgMSk7XG5cbiAgICBpZiAoc2VsZWN0ZWQuaGFzKGluZGV4KSkge1xuICAgICAgaW5kZXggPSBzdGVwO1xuICAgIH1cblxuICAgIHNlbGVjdGVkLmFkZChpbmRleCk7XG5cbiAgICByZXN1bHRbcmVzdWx0SW5kZXhdID0gYXJyYXlbaW5kZXhdO1xuICB9XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLFNBQVMsUUFBUSx1QkFBdUI7QUFFakQ7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBaUJDLEdBQ0QsT0FBTyxTQUFTLFdBQWMsS0FBbUIsRUFBRSxJQUFZO0VBQzdELElBQUksT0FBTyxNQUFNLE1BQU0sRUFBRTtJQUN2QixNQUFNLElBQUksTUFBTTtFQUNsQjtFQUVBLE1BQU0sU0FBUyxJQUFJLE1BQU07RUFDekIsTUFBTSxXQUFXLElBQUk7RUFFckIsSUFBSyxJQUFJLE9BQU8sTUFBTSxNQUFNLEdBQUcsTUFBTSxjQUFjLEdBQUcsT0FBTyxNQUFNLE1BQU0sRUFBRSxRQUFRLGNBQWU7SUFDaEcsSUFBSSxRQUFRLFVBQVUsR0FBRyxPQUFPO0lBRWhDLElBQUksU0FBUyxHQUFHLENBQUMsUUFBUTtNQUN2QixRQUFRO0lBQ1Y7SUFFQSxTQUFTLEdBQUcsQ0FBQztJQUViLE1BQU0sQ0FBQyxZQUFZLEdBQUcsS0FBSyxDQUFDLE1BQU07RUFDcEM7RUFFQSxPQUFPO0FBQ1QifQ==
// denoCacheMetadata=9900650847806950033,4836645620784930863