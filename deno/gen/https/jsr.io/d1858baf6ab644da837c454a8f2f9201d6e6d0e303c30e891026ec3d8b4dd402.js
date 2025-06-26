import { at } from './at.ts';
/**
 * Removes elements from an array at specified indices and returns the removed elements.
 *
 * This function supports negative indices, which count from the end of the array.
 *
 * @template T
 * @param {T[]} arr - The array from which elements will be removed.
 * @param {number[]} indicesToRemove - An array of indices specifying the positions of elements to remove.
 * @returns {Array<T | undefined>} An array containing the elements that were removed from the original array.
 *
 * @example
 * import { pullAt } from './pullAt';
 *
 * const numbers = [10, 20, 30, 40, 50];
 * const removed = pullAt(numbers, [1, 3, 4]);
 * console.log(removed); // [20, 40, 50]
 * console.log(numbers); // [10, 30]
 */ export function pullAt(arr, indicesToRemove) {
  const removed = at(arr, indicesToRemove);
  const indices = new Set(indicesToRemove.slice().sort((x, y)=>y - x));
  for (const index of indices){
    arr.splice(index, 1);
  }
  return removed;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9hcnJheS9wdWxsQXQudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgYXQgfSBmcm9tICcuL2F0LnRzJztcblxuLyoqXG4gKiBSZW1vdmVzIGVsZW1lbnRzIGZyb20gYW4gYXJyYXkgYXQgc3BlY2lmaWVkIGluZGljZXMgYW5kIHJldHVybnMgdGhlIHJlbW92ZWQgZWxlbWVudHMuXG4gKlxuICogVGhpcyBmdW5jdGlvbiBzdXBwb3J0cyBuZWdhdGl2ZSBpbmRpY2VzLCB3aGljaCBjb3VudCBmcm9tIHRoZSBlbmQgb2YgdGhlIGFycmF5LlxuICpcbiAqIEB0ZW1wbGF0ZSBUXG4gKiBAcGFyYW0ge1RbXX0gYXJyIC0gVGhlIGFycmF5IGZyb20gd2hpY2ggZWxlbWVudHMgd2lsbCBiZSByZW1vdmVkLlxuICogQHBhcmFtIHtudW1iZXJbXX0gaW5kaWNlc1RvUmVtb3ZlIC0gQW4gYXJyYXkgb2YgaW5kaWNlcyBzcGVjaWZ5aW5nIHRoZSBwb3NpdGlvbnMgb2YgZWxlbWVudHMgdG8gcmVtb3ZlLlxuICogQHJldHVybnMge0FycmF5PFQgfCB1bmRlZmluZWQ+fSBBbiBhcnJheSBjb250YWluaW5nIHRoZSBlbGVtZW50cyB0aGF0IHdlcmUgcmVtb3ZlZCBmcm9tIHRoZSBvcmlnaW5hbCBhcnJheS5cbiAqXG4gKiBAZXhhbXBsZVxuICogaW1wb3J0IHsgcHVsbEF0IH0gZnJvbSAnLi9wdWxsQXQnO1xuICpcbiAqIGNvbnN0IG51bWJlcnMgPSBbMTAsIDIwLCAzMCwgNDAsIDUwXTtcbiAqIGNvbnN0IHJlbW92ZWQgPSBwdWxsQXQobnVtYmVycywgWzEsIDMsIDRdKTtcbiAqIGNvbnNvbGUubG9nKHJlbW92ZWQpOyAvLyBbMjAsIDQwLCA1MF1cbiAqIGNvbnNvbGUubG9nKG51bWJlcnMpOyAvLyBbMTAsIDMwXVxuICovXG5leHBvcnQgZnVuY3Rpb24gcHVsbEF0PFQ+KGFycjogVFtdLCBpbmRpY2VzVG9SZW1vdmU6IG51bWJlcltdKTogVFtdIHtcbiAgY29uc3QgcmVtb3ZlZCA9IGF0KGFyciwgaW5kaWNlc1RvUmVtb3ZlKTtcbiAgY29uc3QgaW5kaWNlcyA9IG5ldyBTZXQoaW5kaWNlc1RvUmVtb3ZlLnNsaWNlKCkuc29ydCgoeCwgeSkgPT4geSAtIHgpKTtcblxuICBmb3IgKGNvbnN0IGluZGV4IG9mIGluZGljZXMpIHtcbiAgICBhcnIuc3BsaWNlKGluZGV4LCAxKTtcbiAgfVxuXG4gIHJldHVybiByZW1vdmVkO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsRUFBRSxRQUFRLFVBQVU7QUFFN0I7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBaUJDLEdBQ0QsT0FBTyxTQUFTLE9BQVUsR0FBUSxFQUFFLGVBQXlCO0VBQzNELE1BQU0sVUFBVSxHQUFHLEtBQUs7RUFDeEIsTUFBTSxVQUFVLElBQUksSUFBSSxnQkFBZ0IsS0FBSyxHQUFHLElBQUksQ0FBQyxDQUFDLEdBQUcsSUFBTSxJQUFJO0VBRW5FLEtBQUssTUFBTSxTQUFTLFFBQVM7SUFDM0IsSUFBSSxNQUFNLENBQUMsT0FBTztFQUNwQjtFQUVBLE9BQU87QUFDVCJ9
// denoCacheMetadata=1683313501290382498,1540070633879318473