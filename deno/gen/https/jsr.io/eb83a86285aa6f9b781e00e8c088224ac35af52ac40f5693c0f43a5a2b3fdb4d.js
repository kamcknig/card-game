/**
 * Calculates the median of an array of numbers.
 *
 * The median is the middle value of a sorted array.
 * If the array has an odd number of elements, the median is the middle value.
 * If the array has an even number of elements, it returns the average of the two middle values.
 *
 * If the array is empty, this function returns `NaN`.
 *
 * @param {number[]} nums - An array of numbers to calculate the median.
 * @returns {number} The median of all the numbers in the array.
 *
 * @example
 * const arrayWithOddNumberOfElements = [1, 2, 3, 4, 5];
 * const result = median(arrayWithOddNumberOfElements);
 * // result will be 3
 *
 * @example
 * const arrayWithEvenNumberOfElements = [1, 2, 3, 4];
 * const result = median(arrayWithEvenNumberOfElements);
 * // result will be 2.5
 */ export function median(nums) {
  if (nums.length === 0) {
    return NaN;
  }
  const sorted = nums.slice().sort((a, b)=>a - b);
  const middleIndex = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middleIndex - 1] + sorted[middleIndex]) / 2;
  } else {
    return sorted[middleIndex];
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9tYXRoL21lZGlhbi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIENhbGN1bGF0ZXMgdGhlIG1lZGlhbiBvZiBhbiBhcnJheSBvZiBudW1iZXJzLlxuICpcbiAqIFRoZSBtZWRpYW4gaXMgdGhlIG1pZGRsZSB2YWx1ZSBvZiBhIHNvcnRlZCBhcnJheS5cbiAqIElmIHRoZSBhcnJheSBoYXMgYW4gb2RkIG51bWJlciBvZiBlbGVtZW50cywgdGhlIG1lZGlhbiBpcyB0aGUgbWlkZGxlIHZhbHVlLlxuICogSWYgdGhlIGFycmF5IGhhcyBhbiBldmVuIG51bWJlciBvZiBlbGVtZW50cywgaXQgcmV0dXJucyB0aGUgYXZlcmFnZSBvZiB0aGUgdHdvIG1pZGRsZSB2YWx1ZXMuXG4gKlxuICogSWYgdGhlIGFycmF5IGlzIGVtcHR5LCB0aGlzIGZ1bmN0aW9uIHJldHVybnMgYE5hTmAuXG4gKlxuICogQHBhcmFtIHtudW1iZXJbXX0gbnVtcyAtIEFuIGFycmF5IG9mIG51bWJlcnMgdG8gY2FsY3VsYXRlIHRoZSBtZWRpYW4uXG4gKiBAcmV0dXJucyB7bnVtYmVyfSBUaGUgbWVkaWFuIG9mIGFsbCB0aGUgbnVtYmVycyBpbiB0aGUgYXJyYXkuXG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IGFycmF5V2l0aE9kZE51bWJlck9mRWxlbWVudHMgPSBbMSwgMiwgMywgNCwgNV07XG4gKiBjb25zdCByZXN1bHQgPSBtZWRpYW4oYXJyYXlXaXRoT2RkTnVtYmVyT2ZFbGVtZW50cyk7XG4gKiAvLyByZXN1bHQgd2lsbCBiZSAzXG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IGFycmF5V2l0aEV2ZW5OdW1iZXJPZkVsZW1lbnRzID0gWzEsIDIsIDMsIDRdO1xuICogY29uc3QgcmVzdWx0ID0gbWVkaWFuKGFycmF5V2l0aEV2ZW5OdW1iZXJPZkVsZW1lbnRzKTtcbiAqIC8vIHJlc3VsdCB3aWxsIGJlIDIuNVxuICovXG5leHBvcnQgZnVuY3Rpb24gbWVkaWFuKG51bXM6IHJlYWRvbmx5IG51bWJlcltdKTogbnVtYmVyIHtcbiAgaWYgKG51bXMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIE5hTjtcbiAgfVxuXG4gIGNvbnN0IHNvcnRlZCA9IG51bXMuc2xpY2UoKS5zb3J0KChhLCBiKSA9PiBhIC0gYik7XG4gIGNvbnN0IG1pZGRsZUluZGV4ID0gTWF0aC5mbG9vcihzb3J0ZWQubGVuZ3RoIC8gMik7XG5cbiAgaWYgKHNvcnRlZC5sZW5ndGggJSAyID09PSAwKSB7XG4gICAgcmV0dXJuIChzb3J0ZWRbbWlkZGxlSW5kZXggLSAxXSArIHNvcnRlZFttaWRkbGVJbmRleF0pIC8gMjtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gc29ydGVkW21pZGRsZUluZGV4XTtcbiAgfVxufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FxQkMsR0FDRCxPQUFPLFNBQVMsT0FBTyxJQUF1QjtFQUM1QyxJQUFJLEtBQUssTUFBTSxLQUFLLEdBQUc7SUFDckIsT0FBTztFQUNUO0VBRUEsTUFBTSxTQUFTLEtBQUssS0FBSyxHQUFHLElBQUksQ0FBQyxDQUFDLEdBQUcsSUFBTSxJQUFJO0VBQy9DLE1BQU0sY0FBYyxLQUFLLEtBQUssQ0FBQyxPQUFPLE1BQU0sR0FBRztFQUUvQyxJQUFJLE9BQU8sTUFBTSxHQUFHLE1BQU0sR0FBRztJQUMzQixPQUFPLENBQUMsTUFBTSxDQUFDLGNBQWMsRUFBRSxHQUFHLE1BQU0sQ0FBQyxZQUFZLElBQUk7RUFDM0QsT0FBTztJQUNMLE9BQU8sTUFBTSxDQUFDLFlBQVk7RUFDNUI7QUFDRiJ9
// denoCacheMetadata=15477118860975559099,5213942642447844139