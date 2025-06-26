/**
 * Creates a function that accepts arguments of `func` and either invokes `func` returning its result, if at least `arity` number of arguments have been provided, or returns a function that accepts the remaining `func` arguments, and so on.
 * The arity of `func` may be specified if `func.length` is not sufficient.
 *
 * Unlike `curry`, this function curries the function from right to left.
 *
 * The `curryRight.placeholder` value, which defaults to a `symbol`, may be used as a placeholder for partially applied arguments.
 *
 * Note: This method doesn't set the `length` property of curried functions.
 *
 * @param {(...args: any[]) => any} func - The function to curry.
 * @param {number=func.length} arity - The arity of func.
 * @param {unknown} guard - Enables use as an iteratee for methods like `Array#map`.
 * @returns {((...args: any[]) => any) & { placeholder: typeof curryRight.placeholder }} - Returns the new curried function.
 *
 * @example
 * const abc = function(a, b, c) {
 *   return Array.from(arguments);
 * };
 *
 * let curried = curryRight(abc);
 *
 * curried(3)(2)(1);
 * // => [1, 2, 3]
 *
 * curried(2, 3)(1);
 * // => [1, 2, 3]
 *
 * curried(1, 2, 3);
 * // => [1, 2, 3]
 *
 * // Curried with placeholders.
 * curried(3)(curryRight.placeholder, 2)(1);
 * // => [1, 2, 3]
 *
 * // Curried with arity.
 * curried = curryRight(abc, 2);
 *
 * curried(2)(1);
 * // => [1, 2]
 */ export function curryRight(func, arity = func.length, guard) {
  arity = guard ? func.length : arity;
  arity = Number.parseInt(arity, 10);
  if (Number.isNaN(arity) || arity < 1) {
    arity = 0;
  }
  const wrapper = function(...partialArgs) {
    const holders = partialArgs.filter((item)=>item === curryRight.placeholder);
    const length = partialArgs.length - holders.length;
    if (length < arity) {
      return makeCurryRight(func, arity - length, partialArgs);
    }
    if (this instanceof wrapper) {
      // @ts-expect-error - fn is a constructor
      return new func(...partialArgs);
    }
    return func.apply(this, partialArgs);
  };
  wrapper.placeholder = curryRightPlaceholder;
  return wrapper;
}
function makeCurryRight(func, arity, partialArgs) {
  function wrapper(...providedArgs) {
    const holders = providedArgs.filter((item)=>item === curryRight.placeholder);
    const length = providedArgs.length - holders.length;
    providedArgs = composeArgs(providedArgs, partialArgs);
    if (length < arity) {
      return makeCurryRight(func, arity - length, providedArgs);
    }
    if (this instanceof wrapper) {
      // @ts-expect-error - fn is a constructor
      return new func(...providedArgs);
    }
    return func.apply(this, providedArgs);
  }
  wrapper.placeholder = curryRightPlaceholder;
  return wrapper;
}
function composeArgs(providedArgs, partialArgs) {
  const placeholderLength = partialArgs.filter((arg)=>arg === curryRight.placeholder).length;
  const rangeLength = Math.max(providedArgs.length - placeholderLength, 0);
  const args = [];
  let providedIndex = 0;
  for(let i = 0; i < rangeLength; i++){
    args.push(providedArgs[providedIndex++]);
  }
  for(let i = 0; i < partialArgs.length; i++){
    const arg = partialArgs[i];
    if (arg === curryRight.placeholder) {
      if (providedIndex < providedArgs.length) {
        args.push(providedArgs[providedIndex++]);
      } else {
        args.push(arg);
      }
    } else {
      args.push(arg);
    }
  }
  return args;
}
const curryRightPlaceholder = Symbol('curryRight.placeholder');
curryRight.placeholder = curryRightPlaceholder;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvZnVuY3Rpb24vY3VycnlSaWdodC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIENyZWF0ZXMgYSBmdW5jdGlvbiB0aGF0IGFjY2VwdHMgYXJndW1lbnRzIG9mIGBmdW5jYCBhbmQgZWl0aGVyIGludm9rZXMgYGZ1bmNgIHJldHVybmluZyBpdHMgcmVzdWx0LCBpZiBhdCBsZWFzdCBgYXJpdHlgIG51bWJlciBvZiBhcmd1bWVudHMgaGF2ZSBiZWVuIHByb3ZpZGVkLCBvciByZXR1cm5zIGEgZnVuY3Rpb24gdGhhdCBhY2NlcHRzIHRoZSByZW1haW5pbmcgYGZ1bmNgIGFyZ3VtZW50cywgYW5kIHNvIG9uLlxuICogVGhlIGFyaXR5IG9mIGBmdW5jYCBtYXkgYmUgc3BlY2lmaWVkIGlmIGBmdW5jLmxlbmd0aGAgaXMgbm90IHN1ZmZpY2llbnQuXG4gKlxuICogVW5saWtlIGBjdXJyeWAsIHRoaXMgZnVuY3Rpb24gY3VycmllcyB0aGUgZnVuY3Rpb24gZnJvbSByaWdodCB0byBsZWZ0LlxuICpcbiAqIFRoZSBgY3VycnlSaWdodC5wbGFjZWhvbGRlcmAgdmFsdWUsIHdoaWNoIGRlZmF1bHRzIHRvIGEgYHN5bWJvbGAsIG1heSBiZSB1c2VkIGFzIGEgcGxhY2Vob2xkZXIgZm9yIHBhcnRpYWxseSBhcHBsaWVkIGFyZ3VtZW50cy5cbiAqXG4gKiBOb3RlOiBUaGlzIG1ldGhvZCBkb2Vzbid0IHNldCB0aGUgYGxlbmd0aGAgcHJvcGVydHkgb2YgY3VycmllZCBmdW5jdGlvbnMuXG4gKlxuICogQHBhcmFtIHsoLi4uYXJnczogYW55W10pID0+IGFueX0gZnVuYyAtIFRoZSBmdW5jdGlvbiB0byBjdXJyeS5cbiAqIEBwYXJhbSB7bnVtYmVyPWZ1bmMubGVuZ3RofSBhcml0eSAtIFRoZSBhcml0eSBvZiBmdW5jLlxuICogQHBhcmFtIHt1bmtub3dufSBndWFyZCAtIEVuYWJsZXMgdXNlIGFzIGFuIGl0ZXJhdGVlIGZvciBtZXRob2RzIGxpa2UgYEFycmF5I21hcGAuXG4gKiBAcmV0dXJucyB7KCguLi5hcmdzOiBhbnlbXSkgPT4gYW55KSAmIHsgcGxhY2Vob2xkZXI6IHR5cGVvZiBjdXJyeVJpZ2h0LnBsYWNlaG9sZGVyIH19IC0gUmV0dXJucyB0aGUgbmV3IGN1cnJpZWQgZnVuY3Rpb24uXG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IGFiYyA9IGZ1bmN0aW9uKGEsIGIsIGMpIHtcbiAqICAgcmV0dXJuIEFycmF5LmZyb20oYXJndW1lbnRzKTtcbiAqIH07XG4gKlxuICogbGV0IGN1cnJpZWQgPSBjdXJyeVJpZ2h0KGFiYyk7XG4gKlxuICogY3VycmllZCgzKSgyKSgxKTtcbiAqIC8vID0+IFsxLCAyLCAzXVxuICpcbiAqIGN1cnJpZWQoMiwgMykoMSk7XG4gKiAvLyA9PiBbMSwgMiwgM11cbiAqXG4gKiBjdXJyaWVkKDEsIDIsIDMpO1xuICogLy8gPT4gWzEsIDIsIDNdXG4gKlxuICogLy8gQ3VycmllZCB3aXRoIHBsYWNlaG9sZGVycy5cbiAqIGN1cnJpZWQoMykoY3VycnlSaWdodC5wbGFjZWhvbGRlciwgMikoMSk7XG4gKiAvLyA9PiBbMSwgMiwgM11cbiAqXG4gKiAvLyBDdXJyaWVkIHdpdGggYXJpdHkuXG4gKiBjdXJyaWVkID0gY3VycnlSaWdodChhYmMsIDIpO1xuICpcbiAqIGN1cnJpZWQoMikoMSk7XG4gKiAvLyA9PiBbMSwgMl1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGN1cnJ5UmlnaHQoXG4gIGZ1bmM6ICguLi5hcmdzOiBhbnlbXSkgPT4gYW55LFxuICBhcml0eTogbnVtYmVyID0gZnVuYy5sZW5ndGgsXG4gIGd1YXJkPzogdW5rbm93blxuKTogKCguLi5hcmdzOiBhbnlbXSkgPT4gYW55KSAmIHsgcGxhY2Vob2xkZXI6IHR5cGVvZiBjdXJyeVJpZ2h0LnBsYWNlaG9sZGVyIH0ge1xuICBhcml0eSA9IGd1YXJkID8gZnVuYy5sZW5ndGggOiBhcml0eTtcbiAgYXJpdHkgPSBOdW1iZXIucGFyc2VJbnQoYXJpdHkgYXMgYW55LCAxMCk7XG4gIGlmIChOdW1iZXIuaXNOYU4oYXJpdHkpIHx8IGFyaXR5IDwgMSkge1xuICAgIGFyaXR5ID0gMDtcbiAgfVxuXG4gIGNvbnN0IHdyYXBwZXIgPSBmdW5jdGlvbiAodGhpczogYW55LCAuLi5wYXJ0aWFsQXJnczogYW55W10pIHtcbiAgICBjb25zdCBob2xkZXJzID0gcGFydGlhbEFyZ3MuZmlsdGVyKGl0ZW0gPT4gaXRlbSA9PT0gY3VycnlSaWdodC5wbGFjZWhvbGRlcik7XG4gICAgY29uc3QgbGVuZ3RoID0gcGFydGlhbEFyZ3MubGVuZ3RoIC0gaG9sZGVycy5sZW5ndGg7XG4gICAgaWYgKGxlbmd0aCA8IGFyaXR5KSB7XG4gICAgICByZXR1cm4gbWFrZUN1cnJ5UmlnaHQoZnVuYywgYXJpdHkgLSBsZW5ndGgsIHBhcnRpYWxBcmdzKTtcbiAgICB9XG4gICAgaWYgKHRoaXMgaW5zdGFuY2VvZiB3cmFwcGVyKSB7XG4gICAgICAvLyBAdHMtZXhwZWN0LWVycm9yIC0gZm4gaXMgYSBjb25zdHJ1Y3RvclxuICAgICAgcmV0dXJuIG5ldyBmdW5jKC4uLnBhcnRpYWxBcmdzKTtcbiAgICB9XG4gICAgcmV0dXJuIGZ1bmMuYXBwbHkodGhpcywgcGFydGlhbEFyZ3MpO1xuICB9O1xuXG4gIHdyYXBwZXIucGxhY2Vob2xkZXIgPSBjdXJyeVJpZ2h0UGxhY2Vob2xkZXI7XG5cbiAgcmV0dXJuIHdyYXBwZXI7XG59XG5cbmZ1bmN0aW9uIG1ha2VDdXJyeVJpZ2h0KFxuICBmdW5jOiAoLi4uYXJnczogYW55W10pID0+IGFueSxcbiAgYXJpdHk6IG51bWJlcixcbiAgcGFydGlhbEFyZ3M6IGFueVtdXG4pOiAoKC4uLmFyZ3M6IGFueVtdKSA9PiBhbnkpICYgeyBwbGFjZWhvbGRlcjogdHlwZW9mIGN1cnJ5UmlnaHQucGxhY2Vob2xkZXIgfSB7XG4gIGZ1bmN0aW9uIHdyYXBwZXIodGhpczogYW55LCAuLi5wcm92aWRlZEFyZ3M6IGFueVtdKSB7XG4gICAgY29uc3QgaG9sZGVycyA9IHByb3ZpZGVkQXJncy5maWx0ZXIoaXRlbSA9PiBpdGVtID09PSBjdXJyeVJpZ2h0LnBsYWNlaG9sZGVyKTtcbiAgICBjb25zdCBsZW5ndGggPSBwcm92aWRlZEFyZ3MubGVuZ3RoIC0gaG9sZGVycy5sZW5ndGg7XG4gICAgcHJvdmlkZWRBcmdzID0gY29tcG9zZUFyZ3MocHJvdmlkZWRBcmdzLCBwYXJ0aWFsQXJncyk7XG4gICAgaWYgKGxlbmd0aCA8IGFyaXR5KSB7XG4gICAgICByZXR1cm4gbWFrZUN1cnJ5UmlnaHQoZnVuYywgYXJpdHkgLSBsZW5ndGgsIHByb3ZpZGVkQXJncyk7XG4gICAgfVxuICAgIGlmICh0aGlzIGluc3RhbmNlb2Ygd3JhcHBlcikge1xuICAgICAgLy8gQHRzLWV4cGVjdC1lcnJvciAtIGZuIGlzIGEgY29uc3RydWN0b3JcbiAgICAgIHJldHVybiBuZXcgZnVuYyguLi5wcm92aWRlZEFyZ3MpO1xuICAgIH1cbiAgICByZXR1cm4gZnVuYy5hcHBseSh0aGlzLCBwcm92aWRlZEFyZ3MpO1xuICB9XG4gIHdyYXBwZXIucGxhY2Vob2xkZXIgPSBjdXJyeVJpZ2h0UGxhY2Vob2xkZXI7XG4gIHJldHVybiB3cmFwcGVyO1xufVxuXG5mdW5jdGlvbiBjb21wb3NlQXJncyhwcm92aWRlZEFyZ3M6IGFueVtdLCBwYXJ0aWFsQXJnczogYW55W10pOiBhbnlbXSB7XG4gIGNvbnN0IHBsYWNlaG9sZGVyTGVuZ3RoID0gcGFydGlhbEFyZ3MuZmlsdGVyKGFyZyA9PiBhcmcgPT09IGN1cnJ5UmlnaHQucGxhY2Vob2xkZXIpLmxlbmd0aDtcbiAgY29uc3QgcmFuZ2VMZW5ndGggPSBNYXRoLm1heChwcm92aWRlZEFyZ3MubGVuZ3RoIC0gcGxhY2Vob2xkZXJMZW5ndGgsIDApO1xuICBjb25zdCBhcmdzOiBhbnlbXSA9IFtdO1xuXG4gIGxldCBwcm92aWRlZEluZGV4ID0gMDtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCByYW5nZUxlbmd0aDsgaSsrKSB7XG4gICAgYXJncy5wdXNoKHByb3ZpZGVkQXJnc1twcm92aWRlZEluZGV4KytdKTtcbiAgfVxuICBmb3IgKGxldCBpID0gMDsgaSA8IHBhcnRpYWxBcmdzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgYXJnID0gcGFydGlhbEFyZ3NbaV07XG5cbiAgICBpZiAoYXJnID09PSBjdXJyeVJpZ2h0LnBsYWNlaG9sZGVyKSB7XG4gICAgICBpZiAocHJvdmlkZWRJbmRleCA8IHByb3ZpZGVkQXJncy5sZW5ndGgpIHtcbiAgICAgICAgYXJncy5wdXNoKHByb3ZpZGVkQXJnc1twcm92aWRlZEluZGV4KytdKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGFyZ3MucHVzaChhcmcpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBhcmdzLnB1c2goYXJnKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGFyZ3M7XG59XG5cbmNvbnN0IGN1cnJ5UmlnaHRQbGFjZWhvbGRlcjogdW5pcXVlIHN5bWJvbCA9IFN5bWJvbCgnY3VycnlSaWdodC5wbGFjZWhvbGRlcicpO1xuY3VycnlSaWdodC5wbGFjZWhvbGRlciA9IGN1cnJ5UmlnaHRQbGFjZWhvbGRlcjtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQXdDQyxHQUNELE9BQU8sU0FBUyxXQUNkLElBQTZCLEVBQzdCLFFBQWdCLEtBQUssTUFBTSxFQUMzQixLQUFlO0VBRWYsUUFBUSxRQUFRLEtBQUssTUFBTSxHQUFHO0VBQzlCLFFBQVEsT0FBTyxRQUFRLENBQUMsT0FBYztFQUN0QyxJQUFJLE9BQU8sS0FBSyxDQUFDLFVBQVUsUUFBUSxHQUFHO0lBQ3BDLFFBQVE7RUFDVjtFQUVBLE1BQU0sVUFBVSxTQUFxQixHQUFHLFdBQWtCO0lBQ3hELE1BQU0sVUFBVSxZQUFZLE1BQU0sQ0FBQyxDQUFBLE9BQVEsU0FBUyxXQUFXLFdBQVc7SUFDMUUsTUFBTSxTQUFTLFlBQVksTUFBTSxHQUFHLFFBQVEsTUFBTTtJQUNsRCxJQUFJLFNBQVMsT0FBTztNQUNsQixPQUFPLGVBQWUsTUFBTSxRQUFRLFFBQVE7SUFDOUM7SUFDQSxJQUFJLElBQUksWUFBWSxTQUFTO01BQzNCLHlDQUF5QztNQUN6QyxPQUFPLElBQUksUUFBUTtJQUNyQjtJQUNBLE9BQU8sS0FBSyxLQUFLLENBQUMsSUFBSSxFQUFFO0VBQzFCO0VBRUEsUUFBUSxXQUFXLEdBQUc7RUFFdEIsT0FBTztBQUNUO0FBRUEsU0FBUyxlQUNQLElBQTZCLEVBQzdCLEtBQWEsRUFDYixXQUFrQjtFQUVsQixTQUFTLFFBQW1CLEdBQUcsWUFBbUI7SUFDaEQsTUFBTSxVQUFVLGFBQWEsTUFBTSxDQUFDLENBQUEsT0FBUSxTQUFTLFdBQVcsV0FBVztJQUMzRSxNQUFNLFNBQVMsYUFBYSxNQUFNLEdBQUcsUUFBUSxNQUFNO0lBQ25ELGVBQWUsWUFBWSxjQUFjO0lBQ3pDLElBQUksU0FBUyxPQUFPO01BQ2xCLE9BQU8sZUFBZSxNQUFNLFFBQVEsUUFBUTtJQUM5QztJQUNBLElBQUksSUFBSSxZQUFZLFNBQVM7TUFDM0IseUNBQXlDO01BQ3pDLE9BQU8sSUFBSSxRQUFRO0lBQ3JCO0lBQ0EsT0FBTyxLQUFLLEtBQUssQ0FBQyxJQUFJLEVBQUU7RUFDMUI7RUFDQSxRQUFRLFdBQVcsR0FBRztFQUN0QixPQUFPO0FBQ1Q7QUFFQSxTQUFTLFlBQVksWUFBbUIsRUFBRSxXQUFrQjtFQUMxRCxNQUFNLG9CQUFvQixZQUFZLE1BQU0sQ0FBQyxDQUFBLE1BQU8sUUFBUSxXQUFXLFdBQVcsRUFBRSxNQUFNO0VBQzFGLE1BQU0sY0FBYyxLQUFLLEdBQUcsQ0FBQyxhQUFhLE1BQU0sR0FBRyxtQkFBbUI7RUFDdEUsTUFBTSxPQUFjLEVBQUU7RUFFdEIsSUFBSSxnQkFBZ0I7RUFDcEIsSUFBSyxJQUFJLElBQUksR0FBRyxJQUFJLGFBQWEsSUFBSztJQUNwQyxLQUFLLElBQUksQ0FBQyxZQUFZLENBQUMsZ0JBQWdCO0VBQ3pDO0VBQ0EsSUFBSyxJQUFJLElBQUksR0FBRyxJQUFJLFlBQVksTUFBTSxFQUFFLElBQUs7SUFDM0MsTUFBTSxNQUFNLFdBQVcsQ0FBQyxFQUFFO0lBRTFCLElBQUksUUFBUSxXQUFXLFdBQVcsRUFBRTtNQUNsQyxJQUFJLGdCQUFnQixhQUFhLE1BQU0sRUFBRTtRQUN2QyxLQUFLLElBQUksQ0FBQyxZQUFZLENBQUMsZ0JBQWdCO01BQ3pDLE9BQU87UUFDTCxLQUFLLElBQUksQ0FBQztNQUNaO0lBQ0YsT0FBTztNQUNMLEtBQUssSUFBSSxDQUFDO0lBQ1o7RUFDRjtFQUNBLE9BQU87QUFDVDtBQUVBLE1BQU0sd0JBQXVDLE9BQU87QUFDcEQsV0FBVyxXQUFXLEdBQUcifQ==
// denoCacheMetadata=7541764197174927647,1711180636051469023