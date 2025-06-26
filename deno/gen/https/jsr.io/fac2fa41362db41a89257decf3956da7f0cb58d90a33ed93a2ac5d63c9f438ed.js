import { median } from './median.ts';
/**
 * Calculates the median of an array of elements when applying
 * the `getValue` function to each element.
 *
 * The median is the middle value of a sorted array.
 * If the array has an odd number of elements, the median is the middle value.
 * If the array has an even number of elements, it returns the average of the two middle values.
 *
 * If the array is empty, this function returns `NaN`.
 *
 * @template T - The type of elements in the array.
 * @param {T[]} items An array to calculate the median.
 * @param {(element: T) => number} getValue A function that selects a numeric value from each element.
 * @returns {number} The median of all the numbers as determined by the `getValue` function.
 *
 * @example
 * medianBy([{ a: 1 }, { a: 2 }, { a: 3 }, { a: 4 }, { a: 5 }], x => x.a); // Returns: 3
 * medianBy([{ a: 1 }, { a: 2 }, { a: 3 }, { a: 4 }], x => x.a); // Returns: 2.5
 * medianBy([], x => x.a); // Returns: NaN
 */ export function medianBy(items, getValue) {
  const nums = items.map((x)=>getValue(x));
  return median(nums);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9tYXRoL21lZGlhbkJ5LnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IG1lZGlhbiB9IGZyb20gJy4vbWVkaWFuLnRzJztcblxuLyoqXG4gKiBDYWxjdWxhdGVzIHRoZSBtZWRpYW4gb2YgYW4gYXJyYXkgb2YgZWxlbWVudHMgd2hlbiBhcHBseWluZ1xuICogdGhlIGBnZXRWYWx1ZWAgZnVuY3Rpb24gdG8gZWFjaCBlbGVtZW50LlxuICpcbiAqIFRoZSBtZWRpYW4gaXMgdGhlIG1pZGRsZSB2YWx1ZSBvZiBhIHNvcnRlZCBhcnJheS5cbiAqIElmIHRoZSBhcnJheSBoYXMgYW4gb2RkIG51bWJlciBvZiBlbGVtZW50cywgdGhlIG1lZGlhbiBpcyB0aGUgbWlkZGxlIHZhbHVlLlxuICogSWYgdGhlIGFycmF5IGhhcyBhbiBldmVuIG51bWJlciBvZiBlbGVtZW50cywgaXQgcmV0dXJucyB0aGUgYXZlcmFnZSBvZiB0aGUgdHdvIG1pZGRsZSB2YWx1ZXMuXG4gKlxuICogSWYgdGhlIGFycmF5IGlzIGVtcHR5LCB0aGlzIGZ1bmN0aW9uIHJldHVybnMgYE5hTmAuXG4gKlxuICogQHRlbXBsYXRlIFQgLSBUaGUgdHlwZSBvZiBlbGVtZW50cyBpbiB0aGUgYXJyYXkuXG4gKiBAcGFyYW0ge1RbXX0gaXRlbXMgQW4gYXJyYXkgdG8gY2FsY3VsYXRlIHRoZSBtZWRpYW4uXG4gKiBAcGFyYW0geyhlbGVtZW50OiBUKSA9PiBudW1iZXJ9IGdldFZhbHVlIEEgZnVuY3Rpb24gdGhhdCBzZWxlY3RzIGEgbnVtZXJpYyB2YWx1ZSBmcm9tIGVhY2ggZWxlbWVudC5cbiAqIEByZXR1cm5zIHtudW1iZXJ9IFRoZSBtZWRpYW4gb2YgYWxsIHRoZSBudW1iZXJzIGFzIGRldGVybWluZWQgYnkgdGhlIGBnZXRWYWx1ZWAgZnVuY3Rpb24uXG4gKlxuICogQGV4YW1wbGVcbiAqIG1lZGlhbkJ5KFt7IGE6IDEgfSwgeyBhOiAyIH0sIHsgYTogMyB9LCB7IGE6IDQgfSwgeyBhOiA1IH1dLCB4ID0+IHguYSk7IC8vIFJldHVybnM6IDNcbiAqIG1lZGlhbkJ5KFt7IGE6IDEgfSwgeyBhOiAyIH0sIHsgYTogMyB9LCB7IGE6IDQgfV0sIHggPT4geC5hKTsgLy8gUmV0dXJuczogMi41XG4gKiBtZWRpYW5CeShbXSwgeCA9PiB4LmEpOyAvLyBSZXR1cm5zOiBOYU5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1lZGlhbkJ5PFQ+KGl0ZW1zOiByZWFkb25seSBUW10sIGdldFZhbHVlOiAoZWxlbWVudDogVCkgPT4gbnVtYmVyKTogbnVtYmVyIHtcbiAgY29uc3QgbnVtcyA9IGl0ZW1zLm1hcCh4ID0+IGdldFZhbHVlKHgpKTtcblxuICByZXR1cm4gbWVkaWFuKG51bXMpO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsTUFBTSxRQUFRLGNBQWM7QUFFckM7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FtQkMsR0FDRCxPQUFPLFNBQVMsU0FBWSxLQUFtQixFQUFFLFFBQWdDO0VBQy9FLE1BQU0sT0FBTyxNQUFNLEdBQUcsQ0FBQyxDQUFBLElBQUssU0FBUztFQUVyQyxPQUFPLE9BQU87QUFDaEIifQ==
// denoCacheMetadata=7846613017114693702,16706241849549483844