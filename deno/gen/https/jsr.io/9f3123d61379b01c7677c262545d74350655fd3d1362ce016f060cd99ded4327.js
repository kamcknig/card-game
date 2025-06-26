/**
 * Iterates over elements of 'arr' from right to left and invokes 'callback' for each element.
 *
 * @template T - The type of elements in the array.
 * @param {T[]} arr - The array to iterate over.
 * @param {(value: T, index: number, arr: T[]) => void} callback - The function invoked per iteration.
 * The callback function receives three arguments:
 *  - 'value': The current element being processed in the array.
 *  - 'index': The index of the current element being processed in the array.
 *  - 'arr': The array 'forEachRight' was called upon.
 *
 * @example
 * const array = [1, 2, 3];
 * const result: number[] = [];
 *
 * // Use the forEachRight function to iterate through the array and add each element to the result array.
 * forEachRight(array, (value) => {
 *  result.push(value);
 * })
 *
 * console.log(result) // Output: [3, 2, 1]
 */ /**
 * Iterates over elements of 'arr' from right to left and invokes 'callback' for each element.
 *
 * @template T - The type of elements in the array.
 * @param {T[]} arr - The array to iterate over.
 * @param {(value: T, index: number, arr: T[]) => void} callback - The function invoked per iteration.
 * The callback function receives three arguments:
 *  - 'value': The current element being processed in the array.
 *  - 'index': The index of the current element being processed in the array.
 *  - 'arr': The array 'forEachRight' was called upon.
 *
 * @example
 * const array = [1, 2, 3];
 * const result: number[] = [];
 *
 * // Use the forEachRight function to iterate through the array and add each element to the result array.
 * forEachRight(array, (value) => {
 *  result.push(value);
 * })
 *
 * console.log(result) // Output: [3, 2, 1]
 */ export function forEachRight(arr, callback) {
  for(let i = arr.length - 1; i >= 0; i--){
    const element = arr[i];
    callback(element, i, arr);
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9hcnJheS9mb3JFYWNoUmlnaHQudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBJdGVyYXRlcyBvdmVyIGVsZW1lbnRzIG9mICdhcnInIGZyb20gcmlnaHQgdG8gbGVmdCBhbmQgaW52b2tlcyAnY2FsbGJhY2snIGZvciBlYWNoIGVsZW1lbnQuXG4gKlxuICogQHRlbXBsYXRlIFQgLSBUaGUgdHlwZSBvZiBlbGVtZW50cyBpbiB0aGUgYXJyYXkuXG4gKiBAcGFyYW0ge1RbXX0gYXJyIC0gVGhlIGFycmF5IHRvIGl0ZXJhdGUgb3Zlci5cbiAqIEBwYXJhbSB7KHZhbHVlOiBULCBpbmRleDogbnVtYmVyLCBhcnI6IFRbXSkgPT4gdm9pZH0gY2FsbGJhY2sgLSBUaGUgZnVuY3Rpb24gaW52b2tlZCBwZXIgaXRlcmF0aW9uLlxuICogVGhlIGNhbGxiYWNrIGZ1bmN0aW9uIHJlY2VpdmVzIHRocmVlIGFyZ3VtZW50czpcbiAqICAtICd2YWx1ZSc6IFRoZSBjdXJyZW50IGVsZW1lbnQgYmVpbmcgcHJvY2Vzc2VkIGluIHRoZSBhcnJheS5cbiAqICAtICdpbmRleCc6IFRoZSBpbmRleCBvZiB0aGUgY3VycmVudCBlbGVtZW50IGJlaW5nIHByb2Nlc3NlZCBpbiB0aGUgYXJyYXkuXG4gKiAgLSAnYXJyJzogVGhlIGFycmF5ICdmb3JFYWNoUmlnaHQnIHdhcyBjYWxsZWQgdXBvbi5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgYXJyYXkgPSBbMSwgMiwgM107XG4gKiBjb25zdCByZXN1bHQ6IG51bWJlcltdID0gW107XG4gKlxuICogLy8gVXNlIHRoZSBmb3JFYWNoUmlnaHQgZnVuY3Rpb24gdG8gaXRlcmF0ZSB0aHJvdWdoIHRoZSBhcnJheSBhbmQgYWRkIGVhY2ggZWxlbWVudCB0byB0aGUgcmVzdWx0IGFycmF5LlxuICogZm9yRWFjaFJpZ2h0KGFycmF5LCAodmFsdWUpID0+IHtcbiAqICByZXN1bHQucHVzaCh2YWx1ZSk7XG4gKiB9KVxuICpcbiAqIGNvbnNvbGUubG9nKHJlc3VsdCkgLy8gT3V0cHV0OiBbMywgMiwgMV1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGZvckVhY2hSaWdodDxUPihhcnI6IFRbXSwgY2FsbGJhY2s6ICh2YWx1ZTogVCwgaW5kZXg6IG51bWJlciwgYXJyOiBUW10pID0+IHZvaWQpOiB2b2lkO1xuLyoqXG4gKiBJdGVyYXRlcyBvdmVyIGVsZW1lbnRzIG9mICdhcnInIGZyb20gcmlnaHQgdG8gbGVmdCBhbmQgaW52b2tlcyAnY2FsbGJhY2snIGZvciBlYWNoIGVsZW1lbnQuXG4gKlxuICogQHRlbXBsYXRlIFQgLSBUaGUgdHlwZSBvZiBlbGVtZW50cyBpbiB0aGUgYXJyYXkuXG4gKiBAcGFyYW0ge1RbXX0gYXJyIC0gVGhlIGFycmF5IHRvIGl0ZXJhdGUgb3Zlci5cbiAqIEBwYXJhbSB7KHZhbHVlOiBULCBpbmRleDogbnVtYmVyLCBhcnI6IFRbXSkgPT4gdm9pZH0gY2FsbGJhY2sgLSBUaGUgZnVuY3Rpb24gaW52b2tlZCBwZXIgaXRlcmF0aW9uLlxuICogVGhlIGNhbGxiYWNrIGZ1bmN0aW9uIHJlY2VpdmVzIHRocmVlIGFyZ3VtZW50czpcbiAqICAtICd2YWx1ZSc6IFRoZSBjdXJyZW50IGVsZW1lbnQgYmVpbmcgcHJvY2Vzc2VkIGluIHRoZSBhcnJheS5cbiAqICAtICdpbmRleCc6IFRoZSBpbmRleCBvZiB0aGUgY3VycmVudCBlbGVtZW50IGJlaW5nIHByb2Nlc3NlZCBpbiB0aGUgYXJyYXkuXG4gKiAgLSAnYXJyJzogVGhlIGFycmF5ICdmb3JFYWNoUmlnaHQnIHdhcyBjYWxsZWQgdXBvbi5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgYXJyYXkgPSBbMSwgMiwgM107XG4gKiBjb25zdCByZXN1bHQ6IG51bWJlcltdID0gW107XG4gKlxuICogLy8gVXNlIHRoZSBmb3JFYWNoUmlnaHQgZnVuY3Rpb24gdG8gaXRlcmF0ZSB0aHJvdWdoIHRoZSBhcnJheSBhbmQgYWRkIGVhY2ggZWxlbWVudCB0byB0aGUgcmVzdWx0IGFycmF5LlxuICogZm9yRWFjaFJpZ2h0KGFycmF5LCAodmFsdWUpID0+IHtcbiAqICByZXN1bHQucHVzaCh2YWx1ZSk7XG4gKiB9KVxuICpcbiAqIGNvbnNvbGUubG9nKHJlc3VsdCkgLy8gT3V0cHV0OiBbMywgMiwgMV1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGZvckVhY2hSaWdodDxUPihcbiAgYXJyOiByZWFkb25seSBUW10sXG4gIGNhbGxiYWNrOiAodmFsdWU6IFQsIGluZGV4OiBudW1iZXIsIGFycjogcmVhZG9ubHkgVFtdKSA9PiB2b2lkXG4pOiB2b2lkO1xuXG4vKipcbiAqIEl0ZXJhdGVzIG92ZXIgZWxlbWVudHMgb2YgJ2FycicgZnJvbSByaWdodCB0byBsZWZ0IGFuZCBpbnZva2VzICdjYWxsYmFjaycgZm9yIGVhY2ggZWxlbWVudC5cbiAqXG4gKiBAdGVtcGxhdGUgVCAtIFRoZSB0eXBlIG9mIGVsZW1lbnRzIGluIHRoZSBhcnJheS5cbiAqIEBwYXJhbSB7VFtdfSBhcnIgLSBUaGUgYXJyYXkgdG8gaXRlcmF0ZSBvdmVyLlxuICogQHBhcmFtIHsodmFsdWU6IFQsIGluZGV4OiBudW1iZXIsIGFycjogVFtdKSA9PiB2b2lkfSBjYWxsYmFjayAtIFRoZSBmdW5jdGlvbiBpbnZva2VkIHBlciBpdGVyYXRpb24uXG4gKiBUaGUgY2FsbGJhY2sgZnVuY3Rpb24gcmVjZWl2ZXMgdGhyZWUgYXJndW1lbnRzOlxuICogIC0gJ3ZhbHVlJzogVGhlIGN1cnJlbnQgZWxlbWVudCBiZWluZyBwcm9jZXNzZWQgaW4gdGhlIGFycmF5LlxuICogIC0gJ2luZGV4JzogVGhlIGluZGV4IG9mIHRoZSBjdXJyZW50IGVsZW1lbnQgYmVpbmcgcHJvY2Vzc2VkIGluIHRoZSBhcnJheS5cbiAqICAtICdhcnInOiBUaGUgYXJyYXkgJ2ZvckVhY2hSaWdodCcgd2FzIGNhbGxlZCB1cG9uLlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCBhcnJheSA9IFsxLCAyLCAzXTtcbiAqIGNvbnN0IHJlc3VsdDogbnVtYmVyW10gPSBbXTtcbiAqXG4gKiAvLyBVc2UgdGhlIGZvckVhY2hSaWdodCBmdW5jdGlvbiB0byBpdGVyYXRlIHRocm91Z2ggdGhlIGFycmF5IGFuZCBhZGQgZWFjaCBlbGVtZW50IHRvIHRoZSByZXN1bHQgYXJyYXkuXG4gKiBmb3JFYWNoUmlnaHQoYXJyYXksICh2YWx1ZSkgPT4ge1xuICogIHJlc3VsdC5wdXNoKHZhbHVlKTtcbiAqIH0pXG4gKlxuICogY29uc29sZS5sb2cocmVzdWx0KSAvLyBPdXRwdXQ6IFszLCAyLCAxXVxuICovXG5leHBvcnQgZnVuY3Rpb24gZm9yRWFjaFJpZ2h0PFQ+KGFycjogcmVhZG9ubHkgVFtdLCBjYWxsYmFjazogKHZhbHVlOiBULCBpbmRleDogbnVtYmVyLCBhcnI6IFRbXSkgPT4gdm9pZCk6IHZvaWQge1xuICBmb3IgKGxldCBpID0gYXJyLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgY29uc3QgZWxlbWVudCA9IGFycltpXTtcbiAgICBjYWxsYmFjayhlbGVtZW50LCBpLCBhcnIgYXMgVFtdKTtcbiAgfVxufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FxQkMsR0E2QkQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQXFCQyxHQUNELE9BQU8sU0FBUyxhQUFnQixHQUFpQixFQUFFLFFBQXFEO0VBQ3RHLElBQUssSUFBSSxJQUFJLElBQUksTUFBTSxHQUFHLEdBQUcsS0FBSyxHQUFHLElBQUs7SUFDeEMsTUFBTSxVQUFVLEdBQUcsQ0FBQyxFQUFFO0lBQ3RCLFNBQVMsU0FBUyxHQUFHO0VBQ3ZCO0FBQ0YifQ==
// denoCacheMetadata=17753719963169016894,17308744131699491232