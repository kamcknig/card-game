/**
 * Calculates the sum of an array of numbers.
 *
 * This function takes an array of numbers and returns the sum of all the elements in the array.
 *
 * @param {number[]} nums - An array of numbers to be summed.
 * @returns {number} The sum of all the numbers in the array.
 *
 * @example
 * const numbers = [1, 2, 3, 4, 5];
 * const result = sum(numbers);
 * // result will be 15
 */ export function sum(nums) {
  let result = 0;
  for(let i = 0; i < nums.length; i++){
    result += nums[i];
  }
  return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9tYXRoL3N1bS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIENhbGN1bGF0ZXMgdGhlIHN1bSBvZiBhbiBhcnJheSBvZiBudW1iZXJzLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gdGFrZXMgYW4gYXJyYXkgb2YgbnVtYmVycyBhbmQgcmV0dXJucyB0aGUgc3VtIG9mIGFsbCB0aGUgZWxlbWVudHMgaW4gdGhlIGFycmF5LlxuICpcbiAqIEBwYXJhbSB7bnVtYmVyW119IG51bXMgLSBBbiBhcnJheSBvZiBudW1iZXJzIHRvIGJlIHN1bW1lZC5cbiAqIEByZXR1cm5zIHtudW1iZXJ9IFRoZSBzdW0gb2YgYWxsIHRoZSBudW1iZXJzIGluIHRoZSBhcnJheS5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgbnVtYmVycyA9IFsxLCAyLCAzLCA0LCA1XTtcbiAqIGNvbnN0IHJlc3VsdCA9IHN1bShudW1iZXJzKTtcbiAqIC8vIHJlc3VsdCB3aWxsIGJlIDE1XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzdW0obnVtczogcmVhZG9ubHkgbnVtYmVyW10pOiBudW1iZXIge1xuICBsZXQgcmVzdWx0ID0gMDtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IG51bXMubGVuZ3RoOyBpKyspIHtcbiAgICByZXN1bHQgKz0gbnVtc1tpXTtcbiAgfVxuXG4gIHJldHVybiByZXN1bHQ7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7Ozs7OztDQVlDLEdBQ0QsT0FBTyxTQUFTLElBQUksSUFBdUI7RUFDekMsSUFBSSxTQUFTO0VBRWIsSUFBSyxJQUFJLElBQUksR0FBRyxJQUFJLEtBQUssTUFBTSxFQUFFLElBQUs7SUFDcEMsVUFBVSxJQUFJLENBQUMsRUFBRTtFQUNuQjtFQUVBLE9BQU87QUFDVCJ9
// denoCacheMetadata=11247282003231795369,925852068821427920