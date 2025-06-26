/**
 * Retrieves elements from an array at the specified indices.
 *
 * This function supports negative indices, which count from the end of the array.
 *
 * @template T
 * @param {readonly T[]} arr - The array to retrieve elements from.
 * @param {number[]} indices - An array of indices specifying the positions of elements to retrieve.
 * @returns {Array<T | undefined>} A new array containing the elements at the specified indices.
 *
 * @example
 * const numbers = [10, 20, 30, 40, 50];
 * const result = at(numbers, [1, 3, 4]);
 * console.log(result); // [20, 40, 50]
 */ export function at(arr, indices) {
  const result = new Array(indices.length);
  const length = arr.length;
  for(let i = 0; i < indices.length; i++){
    let index = indices[i];
    index = Number.isInteger(index) ? index : Math.trunc(index) || 0;
    if (index < 0) {
      index += length;
    }
    result[i] = arr[index];
  }
  return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9hcnJheS9hdC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFJldHJpZXZlcyBlbGVtZW50cyBmcm9tIGFuIGFycmF5IGF0IHRoZSBzcGVjaWZpZWQgaW5kaWNlcy5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIHN1cHBvcnRzIG5lZ2F0aXZlIGluZGljZXMsIHdoaWNoIGNvdW50IGZyb20gdGhlIGVuZCBvZiB0aGUgYXJyYXkuXG4gKlxuICogQHRlbXBsYXRlIFRcbiAqIEBwYXJhbSB7cmVhZG9ubHkgVFtdfSBhcnIgLSBUaGUgYXJyYXkgdG8gcmV0cmlldmUgZWxlbWVudHMgZnJvbS5cbiAqIEBwYXJhbSB7bnVtYmVyW119IGluZGljZXMgLSBBbiBhcnJheSBvZiBpbmRpY2VzIHNwZWNpZnlpbmcgdGhlIHBvc2l0aW9ucyBvZiBlbGVtZW50cyB0byByZXRyaWV2ZS5cbiAqIEByZXR1cm5zIHtBcnJheTxUIHwgdW5kZWZpbmVkPn0gQSBuZXcgYXJyYXkgY29udGFpbmluZyB0aGUgZWxlbWVudHMgYXQgdGhlIHNwZWNpZmllZCBpbmRpY2VzLlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCBudW1iZXJzID0gWzEwLCAyMCwgMzAsIDQwLCA1MF07XG4gKiBjb25zdCByZXN1bHQgPSBhdChudW1iZXJzLCBbMSwgMywgNF0pO1xuICogY29uc29sZS5sb2cocmVzdWx0KTsgLy8gWzIwLCA0MCwgNTBdXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhdDxUPihhcnI6IHJlYWRvbmx5IFRbXSwgaW5kaWNlczogbnVtYmVyW10pOiBUW10ge1xuICBjb25zdCByZXN1bHQgPSBuZXcgQXJyYXk8VD4oaW5kaWNlcy5sZW5ndGgpO1xuICBjb25zdCBsZW5ndGggPSBhcnIubGVuZ3RoO1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgaW5kaWNlcy5sZW5ndGg7IGkrKykge1xuICAgIGxldCBpbmRleCA9IGluZGljZXNbaV07XG5cbiAgICBpbmRleCA9IE51bWJlci5pc0ludGVnZXIoaW5kZXgpID8gaW5kZXggOiBNYXRoLnRydW5jKGluZGV4KSB8fCAwO1xuXG4gICAgaWYgKGluZGV4IDwgMCkge1xuICAgICAgaW5kZXggKz0gbGVuZ3RoO1xuICAgIH1cblxuICAgIHJlc3VsdFtpXSA9IGFycltpbmRleF07XG4gIH1cblxuICByZXR1cm4gcmVzdWx0O1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7OztDQWNDLEdBQ0QsT0FBTyxTQUFTLEdBQU0sR0FBaUIsRUFBRSxPQUFpQjtFQUN4RCxNQUFNLFNBQVMsSUFBSSxNQUFTLFFBQVEsTUFBTTtFQUMxQyxNQUFNLFNBQVMsSUFBSSxNQUFNO0VBRXpCLElBQUssSUFBSSxJQUFJLEdBQUcsSUFBSSxRQUFRLE1BQU0sRUFBRSxJQUFLO0lBQ3ZDLElBQUksUUFBUSxPQUFPLENBQUMsRUFBRTtJQUV0QixRQUFRLE9BQU8sU0FBUyxDQUFDLFNBQVMsUUFBUSxLQUFLLEtBQUssQ0FBQyxVQUFVO0lBRS9ELElBQUksUUFBUSxHQUFHO01BQ2IsU0FBUztJQUNYO0lBRUEsTUFBTSxDQUFDLEVBQUUsR0FBRyxHQUFHLENBQUMsTUFBTTtFQUN4QjtFQUVBLE9BQU87QUFDVCJ9
// denoCacheMetadata=11481821688632084364,4643302412170339801