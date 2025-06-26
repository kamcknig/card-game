/**
 * Casts value as an array if it's not one.
 *
 * @template T The type of elements in the array.
 * @param {T | T[]} value The value to be cast to an array.
 * @returns {T[]} An array containing the input value if it wasn't an array, or the original array if it was.
 *
 * @example
 * const arr1 = castArray(1);
 * // Returns: [1]
 *
 * const arr2 = castArray([1]);
 * // Returns: [1]
 *
 * const arr3 = castArray({'a': 1});
 * // Returns: [{'a': 1}]
 *
 * const arr4 = castArray(null);
 * // Returns: [null]
 *
 * const arr5 = castArray(undefined);
 * // Returns: [undefined]
 *
 * const arr6 = castArray();
 * // Returns: []
 */ export function castArray(value) {
  if (arguments.length === 0) {
    return [];
  }
  return Array.isArray(value) ? value : [
    value
  ];
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvYXJyYXkvY2FzdEFycmF5LnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQ2FzdHMgdmFsdWUgYXMgYW4gYXJyYXkgaWYgaXQncyBub3Qgb25lLlxuICpcbiAqIEB0ZW1wbGF0ZSBUIFRoZSB0eXBlIG9mIGVsZW1lbnRzIGluIHRoZSBhcnJheS5cbiAqIEBwYXJhbSB7VCB8IFRbXX0gdmFsdWUgVGhlIHZhbHVlIHRvIGJlIGNhc3QgdG8gYW4gYXJyYXkuXG4gKiBAcmV0dXJucyB7VFtdfSBBbiBhcnJheSBjb250YWluaW5nIHRoZSBpbnB1dCB2YWx1ZSBpZiBpdCB3YXNuJ3QgYW4gYXJyYXksIG9yIHRoZSBvcmlnaW5hbCBhcnJheSBpZiBpdCB3YXMuXG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IGFycjEgPSBjYXN0QXJyYXkoMSk7XG4gKiAvLyBSZXR1cm5zOiBbMV1cbiAqXG4gKiBjb25zdCBhcnIyID0gY2FzdEFycmF5KFsxXSk7XG4gKiAvLyBSZXR1cm5zOiBbMV1cbiAqXG4gKiBjb25zdCBhcnIzID0gY2FzdEFycmF5KHsnYSc6IDF9KTtcbiAqIC8vIFJldHVybnM6IFt7J2EnOiAxfV1cbiAqXG4gKiBjb25zdCBhcnI0ID0gY2FzdEFycmF5KG51bGwpO1xuICogLy8gUmV0dXJuczogW251bGxdXG4gKlxuICogY29uc3QgYXJyNSA9IGNhc3RBcnJheSh1bmRlZmluZWQpO1xuICogLy8gUmV0dXJuczogW3VuZGVmaW5lZF1cbiAqXG4gKiBjb25zdCBhcnI2ID0gY2FzdEFycmF5KCk7XG4gKiAvLyBSZXR1cm5zOiBbXVxuICovXG5cbmV4cG9ydCBmdW5jdGlvbiBjYXN0QXJyYXk8VD4odmFsdWU/OiBUIHwgcmVhZG9ubHkgVFtdKTogVFtdIHtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gW107XG4gIH1cblxuICByZXR1cm4gQXJyYXkuaXNBcnJheSh2YWx1ZSkgPyB2YWx1ZSA6IChbdmFsdWVdIGFzIFRbXSk7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0F5QkMsR0FFRCxPQUFPLFNBQVMsVUFBYSxLQUF3QjtFQUNuRCxJQUFJLFVBQVUsTUFBTSxLQUFLLEdBQUc7SUFDMUIsT0FBTyxFQUFFO0VBQ1g7RUFFQSxPQUFPLE1BQU0sT0FBTyxDQUFDLFNBQVMsUUFBUztJQUFDO0dBQU07QUFDaEQifQ==
// denoCacheMetadata=9797692607389585143,6982257625465413463