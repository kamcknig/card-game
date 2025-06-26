import { rest as restToolkit } from '../../function/rest.ts';
/**
 * Creates a function that transforms the arguments of the provided function `func`.
 * The transformed arguments are passed to `func` such that the arguments starting from a specified index
 * are grouped into an array, while the previous arguments are passed as individual elements.
 *
 * @template F - The type of the function being transformed.
 * @param {F} func - The function whose arguments are to be transformed.
 * @param {number} [start=func.length - 1] - The index from which to start grouping the remaining arguments into an array.
 *                                            Defaults to `func.length - 1`, grouping all arguments after the last parameter.
 * @returns {(...args: any[]) => ReturnType<F>} A new function that, when called, returns the result of calling `func` with the transformed arguments.
 *
 * The transformed arguments are:
 * - The first `start` arguments as individual elements.
 * - The remaining arguments from index `start` onward grouped into an array.
 * @example
 * function fn(a, b, c) {
 *   return [a, b, c];
 * }
 *
 * // Using default start index (func.length - 1, which is 2 in this case)
 * const transformedFn = rest(fn);
 * console.log(transformedFn(1, 2, 3, 4)); // [1, 2, [3, 4]]
 *
 * // Using start index 1
 * const transformedFnWithStart = rest(fn, 1);
 * console.log(transformedFnWithStart(1, 2, 3, 4)); // [1, [2, 3, 4]]
 *
 * // With fewer arguments than the start index
 * console.log(transformedFn(1)); // [1, undefined, []]
 */ export function rest(func, start = func.length - 1) {
  start = Number.parseInt(start, 10);
  if (Number.isNaN(start) || start < 0) {
    start = func.length - 1;
  }
  return restToolkit(func, start);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvZnVuY3Rpb24vcmVzdC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyByZXN0IGFzIHJlc3RUb29sa2l0IH0gZnJvbSAnLi4vLi4vZnVuY3Rpb24vcmVzdC50cyc7XG5cbi8qKlxuICogQ3JlYXRlcyBhIGZ1bmN0aW9uIHRoYXQgdHJhbnNmb3JtcyB0aGUgYXJndW1lbnRzIG9mIHRoZSBwcm92aWRlZCBmdW5jdGlvbiBgZnVuY2AuXG4gKiBUaGUgdHJhbnNmb3JtZWQgYXJndW1lbnRzIGFyZSBwYXNzZWQgdG8gYGZ1bmNgIHN1Y2ggdGhhdCB0aGUgYXJndW1lbnRzIHN0YXJ0aW5nIGZyb20gYSBzcGVjaWZpZWQgaW5kZXhcbiAqIGFyZSBncm91cGVkIGludG8gYW4gYXJyYXksIHdoaWxlIHRoZSBwcmV2aW91cyBhcmd1bWVudHMgYXJlIHBhc3NlZCBhcyBpbmRpdmlkdWFsIGVsZW1lbnRzLlxuICpcbiAqIEB0ZW1wbGF0ZSBGIC0gVGhlIHR5cGUgb2YgdGhlIGZ1bmN0aW9uIGJlaW5nIHRyYW5zZm9ybWVkLlxuICogQHBhcmFtIHtGfSBmdW5jIC0gVGhlIGZ1bmN0aW9uIHdob3NlIGFyZ3VtZW50cyBhcmUgdG8gYmUgdHJhbnNmb3JtZWQuXG4gKiBAcGFyYW0ge251bWJlcn0gW3N0YXJ0PWZ1bmMubGVuZ3RoIC0gMV0gLSBUaGUgaW5kZXggZnJvbSB3aGljaCB0byBzdGFydCBncm91cGluZyB0aGUgcmVtYWluaW5nIGFyZ3VtZW50cyBpbnRvIGFuIGFycmF5LlxuICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIERlZmF1bHRzIHRvIGBmdW5jLmxlbmd0aCAtIDFgLCBncm91cGluZyBhbGwgYXJndW1lbnRzIGFmdGVyIHRoZSBsYXN0IHBhcmFtZXRlci5cbiAqIEByZXR1cm5zIHsoLi4uYXJnczogYW55W10pID0+IFJldHVyblR5cGU8Rj59IEEgbmV3IGZ1bmN0aW9uIHRoYXQsIHdoZW4gY2FsbGVkLCByZXR1cm5zIHRoZSByZXN1bHQgb2YgY2FsbGluZyBgZnVuY2Agd2l0aCB0aGUgdHJhbnNmb3JtZWQgYXJndW1lbnRzLlxuICpcbiAqIFRoZSB0cmFuc2Zvcm1lZCBhcmd1bWVudHMgYXJlOlxuICogLSBUaGUgZmlyc3QgYHN0YXJ0YCBhcmd1bWVudHMgYXMgaW5kaXZpZHVhbCBlbGVtZW50cy5cbiAqIC0gVGhlIHJlbWFpbmluZyBhcmd1bWVudHMgZnJvbSBpbmRleCBgc3RhcnRgIG9ud2FyZCBncm91cGVkIGludG8gYW4gYXJyYXkuXG4gKiBAZXhhbXBsZVxuICogZnVuY3Rpb24gZm4oYSwgYiwgYykge1xuICogICByZXR1cm4gW2EsIGIsIGNdO1xuICogfVxuICpcbiAqIC8vIFVzaW5nIGRlZmF1bHQgc3RhcnQgaW5kZXggKGZ1bmMubGVuZ3RoIC0gMSwgd2hpY2ggaXMgMiBpbiB0aGlzIGNhc2UpXG4gKiBjb25zdCB0cmFuc2Zvcm1lZEZuID0gcmVzdChmbik7XG4gKiBjb25zb2xlLmxvZyh0cmFuc2Zvcm1lZEZuKDEsIDIsIDMsIDQpKTsgLy8gWzEsIDIsIFszLCA0XV1cbiAqXG4gKiAvLyBVc2luZyBzdGFydCBpbmRleCAxXG4gKiBjb25zdCB0cmFuc2Zvcm1lZEZuV2l0aFN0YXJ0ID0gcmVzdChmbiwgMSk7XG4gKiBjb25zb2xlLmxvZyh0cmFuc2Zvcm1lZEZuV2l0aFN0YXJ0KDEsIDIsIDMsIDQpKTsgLy8gWzEsIFsyLCAzLCA0XV1cbiAqXG4gKiAvLyBXaXRoIGZld2VyIGFyZ3VtZW50cyB0aGFuIHRoZSBzdGFydCBpbmRleFxuICogY29uc29sZS5sb2codHJhbnNmb3JtZWRGbigxKSk7IC8vIFsxLCB1bmRlZmluZWQsIFtdXVxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVzdDxGIGV4dGVuZHMgKC4uLmFyZ3M6IGFueVtdKSA9PiBhbnk+KFxuICBmdW5jOiBGLFxuICBzdGFydCA9IGZ1bmMubGVuZ3RoIC0gMVxuKTogKC4uLmFyZ3M6IGFueVtdKSA9PiBSZXR1cm5UeXBlPEY+IHtcbiAgc3RhcnQgPSBOdW1iZXIucGFyc2VJbnQoc3RhcnQgYXMgYW55LCAxMCk7XG5cbiAgaWYgKE51bWJlci5pc05hTihzdGFydCkgfHwgc3RhcnQgPCAwKSB7XG4gICAgc3RhcnQgPSBmdW5jLmxlbmd0aCAtIDE7XG4gIH1cblxuICByZXR1cm4gcmVzdFRvb2xraXQoZnVuYywgc3RhcnQpO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsUUFBUSxXQUFXLFFBQVEseUJBQXlCO0FBRTdEOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQTZCQyxHQUNELE9BQU8sU0FBUyxLQUNkLElBQU8sRUFDUCxRQUFRLEtBQUssTUFBTSxHQUFHLENBQUM7RUFFdkIsUUFBUSxPQUFPLFFBQVEsQ0FBQyxPQUFjO0VBRXRDLElBQUksT0FBTyxLQUFLLENBQUMsVUFBVSxRQUFRLEdBQUc7SUFDcEMsUUFBUSxLQUFLLE1BQU0sR0FBRztFQUN4QjtFQUVBLE9BQU8sWUFBWSxNQUFNO0FBQzNCIn0=
// denoCacheMetadata=11966104018335955998,16172074379935800799