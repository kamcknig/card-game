/**
 * Computes the difference between two arrays based on a custom equality function.
 *
 * This function takes two arrays and a custom comparison function. It returns a new array containing
 * the elements that are present in the first array but not in the second array. The comparison to determine
 * if elements are equal is made using the provided custom function.
 *
 * @template T, U
 * @param {T[]} firstArr - The array from which to get the difference.
 * @param {U[]} secondArr - The array containing elements to exclude from the first array.
 * @param {(x: T, y: U) => boolean} areItemsEqual - A function to determine if two items are equal.
 * @returns {T[]} A new array containing the elements from the first array that do not match any elements in the second array
 * according to the custom equality function.
 *
 * @example
 * const array1 = [{ id: 1 }, { id: 2 }, { id: 3 }];
 * const array2 = [{ id: 2 }, { id: 4 }];
 * const areItemsEqual = (a, b) => a.id === b.id;
 * const result = differenceWith(array1, array2, areItemsEqual);
 * // result will be [{ id: 1 }, { id: 3 }] since the elements with id 2 are considered equal and are excluded from the result.
 *
 * @example
 * const array1 = [{ id: 1 }, { id: 2 }, { id: 3 }];
 * const array2 = [2, 4];
 * const areItemsEqual = (a, b) => a.id === b;
 * const result = differenceWith(array1, array2, areItemsEqual);
 * // result will be [{ id: 1 }, { id: 3 }] since the element with id 2 is considered equal to the second array's element and is excluded from the result.
 */ export function differenceWith(firstArr, secondArr, areItemsEqual) {
  return firstArr.filter((firstItem)=>{
    return secondArr.every((secondItem)=>{
      return !areItemsEqual(firstItem, secondItem);
    });
  });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9hcnJheS9kaWZmZXJlbmNlV2l0aC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIENvbXB1dGVzIHRoZSBkaWZmZXJlbmNlIGJldHdlZW4gdHdvIGFycmF5cyBiYXNlZCBvbiBhIGN1c3RvbSBlcXVhbGl0eSBmdW5jdGlvbi5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIHRha2VzIHR3byBhcnJheXMgYW5kIGEgY3VzdG9tIGNvbXBhcmlzb24gZnVuY3Rpb24uIEl0IHJldHVybnMgYSBuZXcgYXJyYXkgY29udGFpbmluZ1xuICogdGhlIGVsZW1lbnRzIHRoYXQgYXJlIHByZXNlbnQgaW4gdGhlIGZpcnN0IGFycmF5IGJ1dCBub3QgaW4gdGhlIHNlY29uZCBhcnJheS4gVGhlIGNvbXBhcmlzb24gdG8gZGV0ZXJtaW5lXG4gKiBpZiBlbGVtZW50cyBhcmUgZXF1YWwgaXMgbWFkZSB1c2luZyB0aGUgcHJvdmlkZWQgY3VzdG9tIGZ1bmN0aW9uLlxuICpcbiAqIEB0ZW1wbGF0ZSBULCBVXG4gKiBAcGFyYW0ge1RbXX0gZmlyc3RBcnIgLSBUaGUgYXJyYXkgZnJvbSB3aGljaCB0byBnZXQgdGhlIGRpZmZlcmVuY2UuXG4gKiBAcGFyYW0ge1VbXX0gc2Vjb25kQXJyIC0gVGhlIGFycmF5IGNvbnRhaW5pbmcgZWxlbWVudHMgdG8gZXhjbHVkZSBmcm9tIHRoZSBmaXJzdCBhcnJheS5cbiAqIEBwYXJhbSB7KHg6IFQsIHk6IFUpID0+IGJvb2xlYW59IGFyZUl0ZW1zRXF1YWwgLSBBIGZ1bmN0aW9uIHRvIGRldGVybWluZSBpZiB0d28gaXRlbXMgYXJlIGVxdWFsLlxuICogQHJldHVybnMge1RbXX0gQSBuZXcgYXJyYXkgY29udGFpbmluZyB0aGUgZWxlbWVudHMgZnJvbSB0aGUgZmlyc3QgYXJyYXkgdGhhdCBkbyBub3QgbWF0Y2ggYW55IGVsZW1lbnRzIGluIHRoZSBzZWNvbmQgYXJyYXlcbiAqIGFjY29yZGluZyB0byB0aGUgY3VzdG9tIGVxdWFsaXR5IGZ1bmN0aW9uLlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCBhcnJheTEgPSBbeyBpZDogMSB9LCB7IGlkOiAyIH0sIHsgaWQ6IDMgfV07XG4gKiBjb25zdCBhcnJheTIgPSBbeyBpZDogMiB9LCB7IGlkOiA0IH1dO1xuICogY29uc3QgYXJlSXRlbXNFcXVhbCA9IChhLCBiKSA9PiBhLmlkID09PSBiLmlkO1xuICogY29uc3QgcmVzdWx0ID0gZGlmZmVyZW5jZVdpdGgoYXJyYXkxLCBhcnJheTIsIGFyZUl0ZW1zRXF1YWwpO1xuICogLy8gcmVzdWx0IHdpbGwgYmUgW3sgaWQ6IDEgfSwgeyBpZDogMyB9XSBzaW5jZSB0aGUgZWxlbWVudHMgd2l0aCBpZCAyIGFyZSBjb25zaWRlcmVkIGVxdWFsIGFuZCBhcmUgZXhjbHVkZWQgZnJvbSB0aGUgcmVzdWx0LlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCBhcnJheTEgPSBbeyBpZDogMSB9LCB7IGlkOiAyIH0sIHsgaWQ6IDMgfV07XG4gKiBjb25zdCBhcnJheTIgPSBbMiwgNF07XG4gKiBjb25zdCBhcmVJdGVtc0VxdWFsID0gKGEsIGIpID0+IGEuaWQgPT09IGI7XG4gKiBjb25zdCByZXN1bHQgPSBkaWZmZXJlbmNlV2l0aChhcnJheTEsIGFycmF5MiwgYXJlSXRlbXNFcXVhbCk7XG4gKiAvLyByZXN1bHQgd2lsbCBiZSBbeyBpZDogMSB9LCB7IGlkOiAzIH1dIHNpbmNlIHRoZSBlbGVtZW50IHdpdGggaWQgMiBpcyBjb25zaWRlcmVkIGVxdWFsIHRvIHRoZSBzZWNvbmQgYXJyYXkncyBlbGVtZW50IGFuZCBpcyBleGNsdWRlZCBmcm9tIHRoZSByZXN1bHQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkaWZmZXJlbmNlV2l0aDxULCBVPihcbiAgZmlyc3RBcnI6IHJlYWRvbmx5IFRbXSxcbiAgc2Vjb25kQXJyOiByZWFkb25seSBVW10sXG4gIGFyZUl0ZW1zRXF1YWw6ICh4OiBULCB5OiBVKSA9PiBib29sZWFuXG4pOiBUW10ge1xuICByZXR1cm4gZmlyc3RBcnIuZmlsdGVyKGZpcnN0SXRlbSA9PiB7XG4gICAgcmV0dXJuIHNlY29uZEFyci5ldmVyeShzZWNvbmRJdGVtID0+IHtcbiAgICAgIHJldHVybiAhYXJlSXRlbXNFcXVhbChmaXJzdEl0ZW0sIHNlY29uZEl0ZW0pO1xuICAgIH0pO1xuICB9KTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBMkJDLEdBQ0QsT0FBTyxTQUFTLGVBQ2QsUUFBc0IsRUFDdEIsU0FBdUIsRUFDdkIsYUFBc0M7RUFFdEMsT0FBTyxTQUFTLE1BQU0sQ0FBQyxDQUFBO0lBQ3JCLE9BQU8sVUFBVSxLQUFLLENBQUMsQ0FBQTtNQUNyQixPQUFPLENBQUMsY0FBYyxXQUFXO0lBQ25DO0VBQ0Y7QUFDRiJ9
// denoCacheMetadata=8243125462693603444,5100044261377890342