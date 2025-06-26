/**
 * Reverses the order of arguments for a given function.
 *
 * @template F - The type of the function being flipped.
 * @param {F} func - The function whose arguments will be reversed.
 * @returns {(...args: Reversed<Parameters<F>>) => ReturnType<F>} A new function that takes the
 * reversed arguments and returns the result of calling `func`.
 *
 * @example
 * function fn(a: string, b: string, c: string, d: string) {
 *   return [a, b, c, d];
 * }
 *
 * const flipped = flip(fn);
 * flipped('a', 'b', 'c', 'd'); // => ['d', 'c', 'b', 'a']
 */ export function flip(func) {
  return function(...args) {
    return func.apply(this, args.reverse());
  };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvZnVuY3Rpb24vZmxpcC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFJldmVyc2VzIHRoZSBvcmRlciBvZiBhcmd1bWVudHMgZm9yIGEgZ2l2ZW4gZnVuY3Rpb24uXG4gKlxuICogQHRlbXBsYXRlIEYgLSBUaGUgdHlwZSBvZiB0aGUgZnVuY3Rpb24gYmVpbmcgZmxpcHBlZC5cbiAqIEBwYXJhbSB7Rn0gZnVuYyAtIFRoZSBmdW5jdGlvbiB3aG9zZSBhcmd1bWVudHMgd2lsbCBiZSByZXZlcnNlZC5cbiAqIEByZXR1cm5zIHsoLi4uYXJnczogUmV2ZXJzZWQ8UGFyYW1ldGVyczxGPj4pID0+IFJldHVyblR5cGU8Rj59IEEgbmV3IGZ1bmN0aW9uIHRoYXQgdGFrZXMgdGhlXG4gKiByZXZlcnNlZCBhcmd1bWVudHMgYW5kIHJldHVybnMgdGhlIHJlc3VsdCBvZiBjYWxsaW5nIGBmdW5jYC5cbiAqXG4gKiBAZXhhbXBsZVxuICogZnVuY3Rpb24gZm4oYTogc3RyaW5nLCBiOiBzdHJpbmcsIGM6IHN0cmluZywgZDogc3RyaW5nKSB7XG4gKiAgIHJldHVybiBbYSwgYiwgYywgZF07XG4gKiB9XG4gKlxuICogY29uc3QgZmxpcHBlZCA9IGZsaXAoZm4pO1xuICogZmxpcHBlZCgnYScsICdiJywgJ2MnLCAnZCcpOyAvLyA9PiBbJ2QnLCAnYycsICdiJywgJ2EnXVxuICovXG5cbmV4cG9ydCBmdW5jdGlvbiBmbGlwPEYgZXh0ZW5kcyAoLi4uYXJnczogYW55W10pID0+IGFueT4oZnVuYzogRik6ICguLi5hcmdzOiBSZXZlcnNlZDxQYXJhbWV0ZXJzPEY+PikgPT4gUmV0dXJuVHlwZTxGPiB7XG4gIHJldHVybiBmdW5jdGlvbiAodGhpczogYW55LCAuLi5hcmdzOiBSZXZlcnNlZDxQYXJhbWV0ZXJzPEY+Pikge1xuICAgIHJldHVybiBmdW5jLmFwcGx5KHRoaXMsIGFyZ3MucmV2ZXJzZSgpKTtcbiAgfTtcbn1cblxudHlwZSBSZXZlcnNlZDxUIGV4dGVuZHMgYW55W10+ID0gVCBleHRlbmRzIFtpbmZlciBGaXJzdCwgLi4uaW5mZXIgUmVzdF0gPyBbLi4uUmV2ZXJzZWQ8UmVzdD4sIEZpcnN0XSA6IFtdO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7Ozs7Q0FlQyxHQUVELE9BQU8sU0FBUyxLQUF3QyxJQUFPO0VBQzdELE9BQU8sU0FBcUIsR0FBRyxJQUE2QjtJQUMxRCxPQUFPLEtBQUssS0FBSyxDQUFDLElBQUksRUFBRSxLQUFLLE9BQU87RUFDdEM7QUFDRiJ9
// denoCacheMetadata=16387334961138786135,10541710542366747224