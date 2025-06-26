/**
 * Creates a function that invokes `func` with the `this` binding of `thisArg` and `partials` prepended to the arguments it receives.
 *
 * The `bind.placeholder` value, which defaults to a `symbol`, may be used as a placeholder for partially applied arguments.
 *
 * Note: Unlike native `Function#bind`, this method doesn't set the `length` property of bound functions.
 *
 * @template F - The type of the function to bind.
 * @param {F} func - The function to bind.
 * @param {unknown} thisObj - The `this` binding of `func`.
 * @param {...any} partialArgs - The arguments to be partially applied.
 * @returns {F} - Returns the new bound function.
 *
 * @example
 * function greet(greeting, punctuation) {
 *   return greeting + ' ' + this.user + punctuation;
 * }
 * const object = { user: 'fred' };
 * let bound = bind(greet, object, 'hi');
 * bound('!');
 * // => 'hi fred!'
 *
 * bound = bind(greet, object, bind.placeholder, '!');
 * bound('hi');
 * // => 'hi fred!'
 */ export function bind(func, thisObj, ...partialArgs) {
  const bound = function(...providedArgs) {
    const args = [];
    // Populate args by merging partialArgs and providedArgs.
    // e.g.. when we call bind(func, {}, [1, bind.placeholder, 3])(2, 4);
    // we have args with [1, 2, 3, 4].
    let startIndex = 0;
    for(let i = 0; i < partialArgs.length; i++){
      const arg = partialArgs[i];
      if (arg === bind.placeholder) {
        args.push(providedArgs[startIndex++]);
      } else {
        args.push(arg);
      }
    }
    for(let i = startIndex; i < providedArgs.length; i++){
      args.push(providedArgs[i]);
    }
    if (this instanceof bound) {
      // @ts-expect-error - fn is a constructor
      return new func(...args);
    }
    return func.apply(thisObj, args);
  };
  return bound;
}
const bindPlaceholder = Symbol('bind.placeholder');
bind.placeholder = bindPlaceholder;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvZnVuY3Rpb24vYmluZC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIENyZWF0ZXMgYSBmdW5jdGlvbiB0aGF0IGludm9rZXMgYGZ1bmNgIHdpdGggdGhlIGB0aGlzYCBiaW5kaW5nIG9mIGB0aGlzQXJnYCBhbmQgYHBhcnRpYWxzYCBwcmVwZW5kZWQgdG8gdGhlIGFyZ3VtZW50cyBpdCByZWNlaXZlcy5cbiAqXG4gKiBUaGUgYGJpbmQucGxhY2Vob2xkZXJgIHZhbHVlLCB3aGljaCBkZWZhdWx0cyB0byBhIGBzeW1ib2xgLCBtYXkgYmUgdXNlZCBhcyBhIHBsYWNlaG9sZGVyIGZvciBwYXJ0aWFsbHkgYXBwbGllZCBhcmd1bWVudHMuXG4gKlxuICogTm90ZTogVW5saWtlIG5hdGl2ZSBgRnVuY3Rpb24jYmluZGAsIHRoaXMgbWV0aG9kIGRvZXNuJ3Qgc2V0IHRoZSBgbGVuZ3RoYCBwcm9wZXJ0eSBvZiBib3VuZCBmdW5jdGlvbnMuXG4gKlxuICogQHRlbXBsYXRlIEYgLSBUaGUgdHlwZSBvZiB0aGUgZnVuY3Rpb24gdG8gYmluZC5cbiAqIEBwYXJhbSB7Rn0gZnVuYyAtIFRoZSBmdW5jdGlvbiB0byBiaW5kLlxuICogQHBhcmFtIHt1bmtub3dufSB0aGlzT2JqIC0gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBmdW5jYC5cbiAqIEBwYXJhbSB7Li4uYW55fSBwYXJ0aWFsQXJncyAtIFRoZSBhcmd1bWVudHMgdG8gYmUgcGFydGlhbGx5IGFwcGxpZWQuXG4gKiBAcmV0dXJucyB7Rn0gLSBSZXR1cm5zIHRoZSBuZXcgYm91bmQgZnVuY3Rpb24uXG4gKlxuICogQGV4YW1wbGVcbiAqIGZ1bmN0aW9uIGdyZWV0KGdyZWV0aW5nLCBwdW5jdHVhdGlvbikge1xuICogICByZXR1cm4gZ3JlZXRpbmcgKyAnICcgKyB0aGlzLnVzZXIgKyBwdW5jdHVhdGlvbjtcbiAqIH1cbiAqIGNvbnN0IG9iamVjdCA9IHsgdXNlcjogJ2ZyZWQnIH07XG4gKiBsZXQgYm91bmQgPSBiaW5kKGdyZWV0LCBvYmplY3QsICdoaScpO1xuICogYm91bmQoJyEnKTtcbiAqIC8vID0+ICdoaSBmcmVkISdcbiAqXG4gKiBib3VuZCA9IGJpbmQoZ3JlZXQsIG9iamVjdCwgYmluZC5wbGFjZWhvbGRlciwgJyEnKTtcbiAqIGJvdW5kKCdoaScpO1xuICogLy8gPT4gJ2hpIGZyZWQhJ1xuICovXG5leHBvcnQgZnVuY3Rpb24gYmluZDxGIGV4dGVuZHMgKC4uLmFyZ3M6IGFueVtdKSA9PiBhbnk+KGZ1bmM6IEYsIHRoaXNPYmo/OiB1bmtub3duLCAuLi5wYXJ0aWFsQXJnczogYW55W10pOiBGIHtcbiAgY29uc3QgYm91bmQgPSBmdW5jdGlvbiAodGhpczogYW55LCAuLi5wcm92aWRlZEFyZ3M6IGFueVtdKSB7XG4gICAgY29uc3QgYXJnczogYW55W10gPSBbXTtcblxuICAgIC8vIFBvcHVsYXRlIGFyZ3MgYnkgbWVyZ2luZyBwYXJ0aWFsQXJncyBhbmQgcHJvdmlkZWRBcmdzLlxuICAgIC8vIGUuZy4uIHdoZW4gd2UgY2FsbCBiaW5kKGZ1bmMsIHt9LCBbMSwgYmluZC5wbGFjZWhvbGRlciwgM10pKDIsIDQpO1xuICAgIC8vIHdlIGhhdmUgYXJncyB3aXRoIFsxLCAyLCAzLCA0XS5cbiAgICBsZXQgc3RhcnRJbmRleCA9IDA7XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBhcnRpYWxBcmdzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBhcmcgPSBwYXJ0aWFsQXJnc1tpXTtcblxuICAgICAgaWYgKGFyZyA9PT0gYmluZC5wbGFjZWhvbGRlcikge1xuICAgICAgICBhcmdzLnB1c2gocHJvdmlkZWRBcmdzW3N0YXJ0SW5kZXgrK10pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYXJncy5wdXNoKGFyZyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZm9yIChsZXQgaSA9IHN0YXJ0SW5kZXg7IGkgPCBwcm92aWRlZEFyZ3MubGVuZ3RoOyBpKyspIHtcbiAgICAgIGFyZ3MucHVzaChwcm92aWRlZEFyZ3NbaV0pO1xuICAgIH1cblxuICAgIGlmICh0aGlzIGluc3RhbmNlb2YgYm91bmQpIHtcbiAgICAgIC8vIEB0cy1leHBlY3QtZXJyb3IgLSBmbiBpcyBhIGNvbnN0cnVjdG9yXG4gICAgICByZXR1cm4gbmV3IGZ1bmMoLi4uYXJncyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZ1bmMuYXBwbHkodGhpc09iaiwgYXJncyk7XG4gIH07XG5cbiAgcmV0dXJuIGJvdW5kIGFzIGFueSBhcyBGO1xufVxuXG5jb25zdCBiaW5kUGxhY2Vob2xkZXI6IHVuaXF1ZSBzeW1ib2wgPSBTeW1ib2woJ2JpbmQucGxhY2Vob2xkZXInKTtcbmJpbmQucGxhY2Vob2xkZXIgPSBiaW5kUGxhY2Vob2xkZXI7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0F5QkMsR0FDRCxPQUFPLFNBQVMsS0FBd0MsSUFBTyxFQUFFLE9BQWlCLEVBQUUsR0FBRyxXQUFrQjtFQUN2RyxNQUFNLFFBQVEsU0FBcUIsR0FBRyxZQUFtQjtJQUN2RCxNQUFNLE9BQWMsRUFBRTtJQUV0Qix5REFBeUQ7SUFDekQscUVBQXFFO0lBQ3JFLGtDQUFrQztJQUNsQyxJQUFJLGFBQWE7SUFFakIsSUFBSyxJQUFJLElBQUksR0FBRyxJQUFJLFlBQVksTUFBTSxFQUFFLElBQUs7TUFDM0MsTUFBTSxNQUFNLFdBQVcsQ0FBQyxFQUFFO01BRTFCLElBQUksUUFBUSxLQUFLLFdBQVcsRUFBRTtRQUM1QixLQUFLLElBQUksQ0FBQyxZQUFZLENBQUMsYUFBYTtNQUN0QyxPQUFPO1FBQ0wsS0FBSyxJQUFJLENBQUM7TUFDWjtJQUNGO0lBRUEsSUFBSyxJQUFJLElBQUksWUFBWSxJQUFJLGFBQWEsTUFBTSxFQUFFLElBQUs7TUFDckQsS0FBSyxJQUFJLENBQUMsWUFBWSxDQUFDLEVBQUU7SUFDM0I7SUFFQSxJQUFJLElBQUksWUFBWSxPQUFPO01BQ3pCLHlDQUF5QztNQUN6QyxPQUFPLElBQUksUUFBUTtJQUNyQjtJQUVBLE9BQU8sS0FBSyxLQUFLLENBQUMsU0FBUztFQUM3QjtFQUVBLE9BQU87QUFDVDtBQUVBLE1BQU0sa0JBQWlDLE9BQU87QUFDOUMsS0FBSyxXQUFXLEdBQUcifQ==
// denoCacheMetadata=6101706650214153119,2317859797328667444