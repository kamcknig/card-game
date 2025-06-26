/**
 * Creates a new function that spreads elements of an array argument into individual arguments
 * for the original function.
 *
 * @template F - A function type with any number of parameters and any return type.
 * @param {F} func - The function to be transformed. It can be any function with any number of arguments.
 * @returns {(argsArr: Parameters<F>) => ReturnType<F>} - A new function that takes an array of arguments and returns the result of calling the original function with those arguments.
 *
 * @example
 * function add(a, b) {
 *   return a + b;
 * }
 *
 * const spreadAdd = spread(add);
 * console.log(spreadAdd([1, 2])); // Output: 3
 */ export function spread(func) {
  return function(argsArr) {
    return func.apply(this, argsArr);
  };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9mdW5jdGlvbi9zcHJlYWQudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBDcmVhdGVzIGEgbmV3IGZ1bmN0aW9uIHRoYXQgc3ByZWFkcyBlbGVtZW50cyBvZiBhbiBhcnJheSBhcmd1bWVudCBpbnRvIGluZGl2aWR1YWwgYXJndW1lbnRzXG4gKiBmb3IgdGhlIG9yaWdpbmFsIGZ1bmN0aW9uLlxuICpcbiAqIEB0ZW1wbGF0ZSBGIC0gQSBmdW5jdGlvbiB0eXBlIHdpdGggYW55IG51bWJlciBvZiBwYXJhbWV0ZXJzIGFuZCBhbnkgcmV0dXJuIHR5cGUuXG4gKiBAcGFyYW0ge0Z9IGZ1bmMgLSBUaGUgZnVuY3Rpb24gdG8gYmUgdHJhbnNmb3JtZWQuIEl0IGNhbiBiZSBhbnkgZnVuY3Rpb24gd2l0aCBhbnkgbnVtYmVyIG9mIGFyZ3VtZW50cy5cbiAqIEByZXR1cm5zIHsoYXJnc0FycjogUGFyYW1ldGVyczxGPikgPT4gUmV0dXJuVHlwZTxGPn0gLSBBIG5ldyBmdW5jdGlvbiB0aGF0IHRha2VzIGFuIGFycmF5IG9mIGFyZ3VtZW50cyBhbmQgcmV0dXJucyB0aGUgcmVzdWx0IG9mIGNhbGxpbmcgdGhlIG9yaWdpbmFsIGZ1bmN0aW9uIHdpdGggdGhvc2UgYXJndW1lbnRzLlxuICpcbiAqIEBleGFtcGxlXG4gKiBmdW5jdGlvbiBhZGQoYSwgYikge1xuICogICByZXR1cm4gYSArIGI7XG4gKiB9XG4gKlxuICogY29uc3Qgc3ByZWFkQWRkID0gc3ByZWFkKGFkZCk7XG4gKiBjb25zb2xlLmxvZyhzcHJlYWRBZGQoWzEsIDJdKSk7IC8vIE91dHB1dDogM1xuICovXG5leHBvcnQgZnVuY3Rpb24gc3ByZWFkPEYgZXh0ZW5kcyAoLi4uYXJnczogYW55W10pID0+IGFueT4oZnVuYzogRik6IChhcmdzQXJyOiBQYXJhbWV0ZXJzPEY+KSA9PiBSZXR1cm5UeXBlPEY+IHtcbiAgcmV0dXJuIGZ1bmN0aW9uICh0aGlzOiBhbnksIGFyZ3NBcnI6IFBhcmFtZXRlcnM8Rj4pIHtcbiAgICByZXR1cm4gZnVuYy5hcHBseSh0aGlzLCBhcmdzQXJyKTtcbiAgfTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7Ozs7O0NBZUMsR0FDRCxPQUFPLFNBQVMsT0FBMEMsSUFBTztFQUMvRCxPQUFPLFNBQXFCLE9BQXNCO0lBQ2hELE9BQU8sS0FBSyxLQUFLLENBQUMsSUFBSSxFQUFFO0VBQzFCO0FBQ0YifQ==
// denoCacheMetadata=13900730768976967188,3871626899306721143