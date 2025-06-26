import { sum } from './sum.ts';
/**
 * Calculates the average of an array of numbers.
 *
 * If the array is empty, this function returns `NaN`.
 *
 * @param {number[]} nums - An array of numbers to calculate the average.
 * @returns {number} The average of all the numbers in the array.
 *
 * @example
 * const numbers = [1, 2, 3, 4, 5];
 * const result = mean(numbers);
 * // result will be 3
 */ export function mean(nums) {
  return sum(nums) / nums.length;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9tYXRoL21lYW4udHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgc3VtIH0gZnJvbSAnLi9zdW0udHMnO1xuXG4vKipcbiAqIENhbGN1bGF0ZXMgdGhlIGF2ZXJhZ2Ugb2YgYW4gYXJyYXkgb2YgbnVtYmVycy5cbiAqXG4gKiBJZiB0aGUgYXJyYXkgaXMgZW1wdHksIHRoaXMgZnVuY3Rpb24gcmV0dXJucyBgTmFOYC5cbiAqXG4gKiBAcGFyYW0ge251bWJlcltdfSBudW1zIC0gQW4gYXJyYXkgb2YgbnVtYmVycyB0byBjYWxjdWxhdGUgdGhlIGF2ZXJhZ2UuXG4gKiBAcmV0dXJucyB7bnVtYmVyfSBUaGUgYXZlcmFnZSBvZiBhbGwgdGhlIG51bWJlcnMgaW4gdGhlIGFycmF5LlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCBudW1iZXJzID0gWzEsIDIsIDMsIDQsIDVdO1xuICogY29uc3QgcmVzdWx0ID0gbWVhbihudW1iZXJzKTtcbiAqIC8vIHJlc3VsdCB3aWxsIGJlIDNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1lYW4obnVtczogcmVhZG9ubHkgbnVtYmVyW10pOiBudW1iZXIge1xuICByZXR1cm4gc3VtKG51bXMpIC8gbnVtcy5sZW5ndGg7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxHQUFHLFFBQVEsV0FBVztBQUUvQjs7Ozs7Ozs7Ozs7O0NBWUMsR0FDRCxPQUFPLFNBQVMsS0FBSyxJQUF1QjtFQUMxQyxPQUFPLElBQUksUUFBUSxLQUFLLE1BQU07QUFDaEMifQ==
// denoCacheMetadata=554353887282128873,16138208281446183436