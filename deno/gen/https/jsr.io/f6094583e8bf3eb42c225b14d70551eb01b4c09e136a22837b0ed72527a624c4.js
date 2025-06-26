/**
 * Removes all specified values from an array.
 *
 * This function changes `arr` in place.
 * If you want to remove values without modifying the original array, use `difference`.
 *
 * @template T, U
 * @param {T[]} arr - The array to modify.
 * @param {unknown[]} valuesToRemove - The values to remove from the array.
 * @returns {T[]} The modified array with the specified values removed.
 *
 * @example
 * const numbers = [1, 2, 3, 4, 5, 2, 4];
 * pull(numbers, [2, 4]);
 * console.log(numbers); // [1, 3, 5]
 */ export function pull(arr, valuesToRemove) {
  const valuesSet = new Set(valuesToRemove);
  let resultIndex = 0;
  for(let i = 0; i < arr.length; i++){
    if (valuesSet.has(arr[i])) {
      continue;
    }
    // For handling sparse arrays
    if (!Object.hasOwn(arr, i)) {
      delete arr[resultIndex++];
      continue;
    }
    arr[resultIndex++] = arr[i];
  }
  arr.length = resultIndex;
  return arr;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9hcnJheS9wdWxsLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogUmVtb3ZlcyBhbGwgc3BlY2lmaWVkIHZhbHVlcyBmcm9tIGFuIGFycmF5LlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gY2hhbmdlcyBgYXJyYCBpbiBwbGFjZS5cbiAqIElmIHlvdSB3YW50IHRvIHJlbW92ZSB2YWx1ZXMgd2l0aG91dCBtb2RpZnlpbmcgdGhlIG9yaWdpbmFsIGFycmF5LCB1c2UgYGRpZmZlcmVuY2VgLlxuICpcbiAqIEB0ZW1wbGF0ZSBULCBVXG4gKiBAcGFyYW0ge1RbXX0gYXJyIC0gVGhlIGFycmF5IHRvIG1vZGlmeS5cbiAqIEBwYXJhbSB7dW5rbm93bltdfSB2YWx1ZXNUb1JlbW92ZSAtIFRoZSB2YWx1ZXMgdG8gcmVtb3ZlIGZyb20gdGhlIGFycmF5LlxuICogQHJldHVybnMge1RbXX0gVGhlIG1vZGlmaWVkIGFycmF5IHdpdGggdGhlIHNwZWNpZmllZCB2YWx1ZXMgcmVtb3ZlZC5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgbnVtYmVycyA9IFsxLCAyLCAzLCA0LCA1LCAyLCA0XTtcbiAqIHB1bGwobnVtYmVycywgWzIsIDRdKTtcbiAqIGNvbnNvbGUubG9nKG51bWJlcnMpOyAvLyBbMSwgMywgNV1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHB1bGw8VD4oYXJyOiBUW10sIHZhbHVlc1RvUmVtb3ZlOiByZWFkb25seSB1bmtub3duW10pOiBUW10ge1xuICBjb25zdCB2YWx1ZXNTZXQgPSBuZXcgU2V0KHZhbHVlc1RvUmVtb3ZlKTtcbiAgbGV0IHJlc3VsdEluZGV4ID0gMDtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IGFyci5sZW5ndGg7IGkrKykge1xuICAgIGlmICh2YWx1ZXNTZXQuaGFzKGFycltpXSkpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIC8vIEZvciBoYW5kbGluZyBzcGFyc2UgYXJyYXlzXG4gICAgaWYgKCFPYmplY3QuaGFzT3duKGFyciwgaSkpIHtcbiAgICAgIGRlbGV0ZSBhcnJbcmVzdWx0SW5kZXgrK107XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBhcnJbcmVzdWx0SW5kZXgrK10gPSBhcnJbaV07XG4gIH1cblxuICBhcnIubGVuZ3RoID0gcmVzdWx0SW5kZXg7XG5cbiAgcmV0dXJuIGFycjtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7Ozs7O0NBZUMsR0FDRCxPQUFPLFNBQVMsS0FBUSxHQUFRLEVBQUUsY0FBa0M7RUFDbEUsTUFBTSxZQUFZLElBQUksSUFBSTtFQUMxQixJQUFJLGNBQWM7RUFFbEIsSUFBSyxJQUFJLElBQUksR0FBRyxJQUFJLElBQUksTUFBTSxFQUFFLElBQUs7SUFDbkMsSUFBSSxVQUFVLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRSxHQUFHO01BQ3pCO0lBQ0Y7SUFFQSw2QkFBNkI7SUFDN0IsSUFBSSxDQUFDLE9BQU8sTUFBTSxDQUFDLEtBQUssSUFBSTtNQUMxQixPQUFPLEdBQUcsQ0FBQyxjQUFjO01BQ3pCO0lBQ0Y7SUFFQSxHQUFHLENBQUMsY0FBYyxHQUFHLEdBQUcsQ0FBQyxFQUFFO0VBQzdCO0VBRUEsSUFBSSxNQUFNLEdBQUc7RUFFYixPQUFPO0FBQ1QifQ==
// denoCacheMetadata=16656481791697766441,8014325033908737546