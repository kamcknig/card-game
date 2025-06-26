/**
 * Creates a function that accepts arguments of `func` and either invokes `func` returning its result, if at least `arity` number of arguments have been provided, or returns a function that accepts the remaining `func` arguments, and so on.
 * The arity of `func` may be specified if `func.length` is not sufficient.
 *
 * The `curry.placeholder` value, which defaults to a `symbol`, may be used as a placeholder for partially applied arguments.
 *
 * Note: This method doesn't set the `length` property of curried functions.
 *
 * @param {(...args: any[]) => any} func - The function to curry.
 * @param {number=func.length} arity - The arity of func.
 * @param {unknown} guard - Enables use as an iteratee for methods like `Array#map`.
 * @returns {((...args: any[]) => any) & { placeholder: typeof curry.placeholder }} - Returns the new curried function.
 *
 * @example
 * const abc = function(a, b, c) {
 *   return Array.from(arguments);
 * };
 *
 * let curried = curry(abc);
 *
 * curried(1)(2)(3);
 * // => [1, 2, 3]
 *
 * curried(1, 2)(3);
 * // => [1, 2, 3]
 *
 * curried(1, 2, 3);
 * // => [1, 2, 3]
 *
 * // Curried with placeholders.
 * curried(1)(curry.placeholder, 3)(2);
 * // => [1, 2, 3]
 *
 * // Curried with arity.
 * curried = curry(abc, 2);
 *
 * curried(1)(2);
 * // => [1, 2]
 */ export function curry(func, arity = func.length, guard) {
  arity = guard ? func.length : arity;
  arity = Number.parseInt(arity, 10);
  if (Number.isNaN(arity) || arity < 1) {
    arity = 0;
  }
  const wrapper = function(...partialArgs) {
    const holders = partialArgs.filter((item)=>item === curry.placeholder);
    const length = partialArgs.length - holders.length;
    if (length < arity) {
      return makeCurry(func, arity - length, partialArgs);
    }
    if (this instanceof wrapper) {
      // @ts-expect-error - fn is a constructor
      return new func(...partialArgs);
    }
    return func.apply(this, partialArgs);
  };
  wrapper.placeholder = curryPlaceholder;
  return wrapper;
}
function makeCurry(func, arity, partialArgs) {
  function wrapper(...providedArgs) {
    const holders = providedArgs.filter((item)=>item === curry.placeholder);
    const length = providedArgs.length - holders.length;
    providedArgs = composeArgs(providedArgs, partialArgs);
    if (length < arity) {
      return makeCurry(func, arity - length, providedArgs);
    }
    if (this instanceof wrapper) {
      // @ts-expect-error - fn is a constructor
      return new func(...providedArgs);
    }
    return func.apply(this, providedArgs);
  }
  wrapper.placeholder = curryPlaceholder;
  return wrapper;
}
function composeArgs(providedArgs, partialArgs) {
  const args = [];
  let startIndex = 0;
  for(let i = 0; i < partialArgs.length; i++){
    const arg = partialArgs[i];
    if (arg === curry.placeholder && startIndex < providedArgs.length) {
      args.push(providedArgs[startIndex++]);
    } else {
      args.push(arg);
    }
  }
  for(let i = startIndex; i < providedArgs.length; i++){
    args.push(providedArgs[i]);
  }
  return args;
}
const curryPlaceholder = Symbol('curry.placeholder');
curry.placeholder = curryPlaceholder;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvZnVuY3Rpb24vY3VycnkudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBDcmVhdGVzIGEgZnVuY3Rpb24gdGhhdCBhY2NlcHRzIGFyZ3VtZW50cyBvZiBgZnVuY2AgYW5kIGVpdGhlciBpbnZva2VzIGBmdW5jYCByZXR1cm5pbmcgaXRzIHJlc3VsdCwgaWYgYXQgbGVhc3QgYGFyaXR5YCBudW1iZXIgb2YgYXJndW1lbnRzIGhhdmUgYmVlbiBwcm92aWRlZCwgb3IgcmV0dXJucyBhIGZ1bmN0aW9uIHRoYXQgYWNjZXB0cyB0aGUgcmVtYWluaW5nIGBmdW5jYCBhcmd1bWVudHMsIGFuZCBzbyBvbi5cbiAqIFRoZSBhcml0eSBvZiBgZnVuY2AgbWF5IGJlIHNwZWNpZmllZCBpZiBgZnVuYy5sZW5ndGhgIGlzIG5vdCBzdWZmaWNpZW50LlxuICpcbiAqIFRoZSBgY3VycnkucGxhY2Vob2xkZXJgIHZhbHVlLCB3aGljaCBkZWZhdWx0cyB0byBhIGBzeW1ib2xgLCBtYXkgYmUgdXNlZCBhcyBhIHBsYWNlaG9sZGVyIGZvciBwYXJ0aWFsbHkgYXBwbGllZCBhcmd1bWVudHMuXG4gKlxuICogTm90ZTogVGhpcyBtZXRob2QgZG9lc24ndCBzZXQgdGhlIGBsZW5ndGhgIHByb3BlcnR5IG9mIGN1cnJpZWQgZnVuY3Rpb25zLlxuICpcbiAqIEBwYXJhbSB7KC4uLmFyZ3M6IGFueVtdKSA9PiBhbnl9IGZ1bmMgLSBUaGUgZnVuY3Rpb24gdG8gY3VycnkuXG4gKiBAcGFyYW0ge251bWJlcj1mdW5jLmxlbmd0aH0gYXJpdHkgLSBUaGUgYXJpdHkgb2YgZnVuYy5cbiAqIEBwYXJhbSB7dW5rbm93bn0gZ3VhcmQgLSBFbmFibGVzIHVzZSBhcyBhbiBpdGVyYXRlZSBmb3IgbWV0aG9kcyBsaWtlIGBBcnJheSNtYXBgLlxuICogQHJldHVybnMgeygoLi4uYXJnczogYW55W10pID0+IGFueSkgJiB7IHBsYWNlaG9sZGVyOiB0eXBlb2YgY3VycnkucGxhY2Vob2xkZXIgfX0gLSBSZXR1cm5zIHRoZSBuZXcgY3VycmllZCBmdW5jdGlvbi5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgYWJjID0gZnVuY3Rpb24oYSwgYiwgYykge1xuICogICByZXR1cm4gQXJyYXkuZnJvbShhcmd1bWVudHMpO1xuICogfTtcbiAqXG4gKiBsZXQgY3VycmllZCA9IGN1cnJ5KGFiYyk7XG4gKlxuICogY3VycmllZCgxKSgyKSgzKTtcbiAqIC8vID0+IFsxLCAyLCAzXVxuICpcbiAqIGN1cnJpZWQoMSwgMikoMyk7XG4gKiAvLyA9PiBbMSwgMiwgM11cbiAqXG4gKiBjdXJyaWVkKDEsIDIsIDMpO1xuICogLy8gPT4gWzEsIDIsIDNdXG4gKlxuICogLy8gQ3VycmllZCB3aXRoIHBsYWNlaG9sZGVycy5cbiAqIGN1cnJpZWQoMSkoY3VycnkucGxhY2Vob2xkZXIsIDMpKDIpO1xuICogLy8gPT4gWzEsIDIsIDNdXG4gKlxuICogLy8gQ3VycmllZCB3aXRoIGFyaXR5LlxuICogY3VycmllZCA9IGN1cnJ5KGFiYywgMik7XG4gKlxuICogY3VycmllZCgxKSgyKTtcbiAqIC8vID0+IFsxLCAyXVxuICovXG5leHBvcnQgZnVuY3Rpb24gY3VycnkoXG4gIGZ1bmM6ICguLi5hcmdzOiBhbnlbXSkgPT4gYW55LFxuICBhcml0eTogbnVtYmVyID0gZnVuYy5sZW5ndGgsXG4gIGd1YXJkPzogdW5rbm93blxuKTogKCguLi5hcmdzOiBhbnlbXSkgPT4gYW55KSAmIHsgcGxhY2Vob2xkZXI6IHR5cGVvZiBjdXJyeS5wbGFjZWhvbGRlciB9IHtcbiAgYXJpdHkgPSBndWFyZCA/IGZ1bmMubGVuZ3RoIDogYXJpdHk7XG4gIGFyaXR5ID0gTnVtYmVyLnBhcnNlSW50KGFyaXR5IGFzIGFueSwgMTApO1xuICBpZiAoTnVtYmVyLmlzTmFOKGFyaXR5KSB8fCBhcml0eSA8IDEpIHtcbiAgICBhcml0eSA9IDA7XG4gIH1cblxuICBjb25zdCB3cmFwcGVyID0gZnVuY3Rpb24gKHRoaXM6IGFueSwgLi4ucGFydGlhbEFyZ3M6IGFueVtdKSB7XG4gICAgY29uc3QgaG9sZGVycyA9IHBhcnRpYWxBcmdzLmZpbHRlcihpdGVtID0+IGl0ZW0gPT09IGN1cnJ5LnBsYWNlaG9sZGVyKTtcbiAgICBjb25zdCBsZW5ndGggPSBwYXJ0aWFsQXJncy5sZW5ndGggLSBob2xkZXJzLmxlbmd0aDtcbiAgICBpZiAobGVuZ3RoIDwgYXJpdHkpIHtcbiAgICAgIHJldHVybiBtYWtlQ3VycnkoZnVuYywgYXJpdHkgLSBsZW5ndGgsIHBhcnRpYWxBcmdzKTtcbiAgICB9XG4gICAgaWYgKHRoaXMgaW5zdGFuY2VvZiB3cmFwcGVyKSB7XG4gICAgICAvLyBAdHMtZXhwZWN0LWVycm9yIC0gZm4gaXMgYSBjb25zdHJ1Y3RvclxuICAgICAgcmV0dXJuIG5ldyBmdW5jKC4uLnBhcnRpYWxBcmdzKTtcbiAgICB9XG4gICAgcmV0dXJuIGZ1bmMuYXBwbHkodGhpcywgcGFydGlhbEFyZ3MpO1xuICB9O1xuXG4gIHdyYXBwZXIucGxhY2Vob2xkZXIgPSBjdXJyeVBsYWNlaG9sZGVyO1xuXG4gIHJldHVybiB3cmFwcGVyO1xufVxuXG5mdW5jdGlvbiBtYWtlQ3VycnkoXG4gIGZ1bmM6ICguLi5hcmdzOiBhbnlbXSkgPT4gYW55LFxuICBhcml0eTogbnVtYmVyLFxuICBwYXJ0aWFsQXJnczogYW55W11cbik6ICgoLi4uYXJnczogYW55W10pID0+IGFueSkgJiB7IHBsYWNlaG9sZGVyOiB0eXBlb2YgY3VycnkucGxhY2Vob2xkZXIgfSB7XG4gIGZ1bmN0aW9uIHdyYXBwZXIodGhpczogYW55LCAuLi5wcm92aWRlZEFyZ3M6IGFueVtdKSB7XG4gICAgY29uc3QgaG9sZGVycyA9IHByb3ZpZGVkQXJncy5maWx0ZXIoaXRlbSA9PiBpdGVtID09PSBjdXJyeS5wbGFjZWhvbGRlcik7XG4gICAgY29uc3QgbGVuZ3RoID0gcHJvdmlkZWRBcmdzLmxlbmd0aCAtIGhvbGRlcnMubGVuZ3RoO1xuICAgIHByb3ZpZGVkQXJncyA9IGNvbXBvc2VBcmdzKHByb3ZpZGVkQXJncywgcGFydGlhbEFyZ3MpO1xuICAgIGlmIChsZW5ndGggPCBhcml0eSkge1xuICAgICAgcmV0dXJuIG1ha2VDdXJyeShmdW5jLCBhcml0eSAtIGxlbmd0aCwgcHJvdmlkZWRBcmdzKTtcbiAgICB9XG4gICAgaWYgKHRoaXMgaW5zdGFuY2VvZiB3cmFwcGVyKSB7XG4gICAgICAvLyBAdHMtZXhwZWN0LWVycm9yIC0gZm4gaXMgYSBjb25zdHJ1Y3RvclxuICAgICAgcmV0dXJuIG5ldyBmdW5jKC4uLnByb3ZpZGVkQXJncyk7XG4gICAgfVxuICAgIHJldHVybiBmdW5jLmFwcGx5KHRoaXMsIHByb3ZpZGVkQXJncyk7XG4gIH1cbiAgd3JhcHBlci5wbGFjZWhvbGRlciA9IGN1cnJ5UGxhY2Vob2xkZXI7XG4gIHJldHVybiB3cmFwcGVyO1xufVxuXG5mdW5jdGlvbiBjb21wb3NlQXJncyhwcm92aWRlZEFyZ3M6IGFueVtdLCBwYXJ0aWFsQXJnczogYW55W10pOiBhbnlbXSB7XG4gIGNvbnN0IGFyZ3MgPSBbXTtcbiAgbGV0IHN0YXJ0SW5kZXggPSAwO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHBhcnRpYWxBcmdzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgYXJnID0gcGFydGlhbEFyZ3NbaV07XG5cbiAgICBpZiAoYXJnID09PSBjdXJyeS5wbGFjZWhvbGRlciAmJiBzdGFydEluZGV4IDwgcHJvdmlkZWRBcmdzLmxlbmd0aCkge1xuICAgICAgYXJncy5wdXNoKHByb3ZpZGVkQXJnc1tzdGFydEluZGV4KytdKTtcbiAgICB9IGVsc2Uge1xuICAgICAgYXJncy5wdXNoKGFyZyk7XG4gICAgfVxuICB9XG4gIGZvciAobGV0IGkgPSBzdGFydEluZGV4OyBpIDwgcHJvdmlkZWRBcmdzLmxlbmd0aDsgaSsrKSB7XG4gICAgYXJncy5wdXNoKHByb3ZpZGVkQXJnc1tpXSk7XG4gIH1cbiAgcmV0dXJuIGFyZ3M7XG59XG5cbmNvbnN0IGN1cnJ5UGxhY2Vob2xkZXI6IHVuaXF1ZSBzeW1ib2wgPSBTeW1ib2woJ2N1cnJ5LnBsYWNlaG9sZGVyJyk7XG5jdXJyeS5wbGFjZWhvbGRlciA9IGN1cnJ5UGxhY2Vob2xkZXI7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBc0NDLEdBQ0QsT0FBTyxTQUFTLE1BQ2QsSUFBNkIsRUFDN0IsUUFBZ0IsS0FBSyxNQUFNLEVBQzNCLEtBQWU7RUFFZixRQUFRLFFBQVEsS0FBSyxNQUFNLEdBQUc7RUFDOUIsUUFBUSxPQUFPLFFBQVEsQ0FBQyxPQUFjO0VBQ3RDLElBQUksT0FBTyxLQUFLLENBQUMsVUFBVSxRQUFRLEdBQUc7SUFDcEMsUUFBUTtFQUNWO0VBRUEsTUFBTSxVQUFVLFNBQXFCLEdBQUcsV0FBa0I7SUFDeEQsTUFBTSxVQUFVLFlBQVksTUFBTSxDQUFDLENBQUEsT0FBUSxTQUFTLE1BQU0sV0FBVztJQUNyRSxNQUFNLFNBQVMsWUFBWSxNQUFNLEdBQUcsUUFBUSxNQUFNO0lBQ2xELElBQUksU0FBUyxPQUFPO01BQ2xCLE9BQU8sVUFBVSxNQUFNLFFBQVEsUUFBUTtJQUN6QztJQUNBLElBQUksSUFBSSxZQUFZLFNBQVM7TUFDM0IseUNBQXlDO01BQ3pDLE9BQU8sSUFBSSxRQUFRO0lBQ3JCO0lBQ0EsT0FBTyxLQUFLLEtBQUssQ0FBQyxJQUFJLEVBQUU7RUFDMUI7RUFFQSxRQUFRLFdBQVcsR0FBRztFQUV0QixPQUFPO0FBQ1Q7QUFFQSxTQUFTLFVBQ1AsSUFBNkIsRUFDN0IsS0FBYSxFQUNiLFdBQWtCO0VBRWxCLFNBQVMsUUFBbUIsR0FBRyxZQUFtQjtJQUNoRCxNQUFNLFVBQVUsYUFBYSxNQUFNLENBQUMsQ0FBQSxPQUFRLFNBQVMsTUFBTSxXQUFXO0lBQ3RFLE1BQU0sU0FBUyxhQUFhLE1BQU0sR0FBRyxRQUFRLE1BQU07SUFDbkQsZUFBZSxZQUFZLGNBQWM7SUFDekMsSUFBSSxTQUFTLE9BQU87TUFDbEIsT0FBTyxVQUFVLE1BQU0sUUFBUSxRQUFRO0lBQ3pDO0lBQ0EsSUFBSSxJQUFJLFlBQVksU0FBUztNQUMzQix5Q0FBeUM7TUFDekMsT0FBTyxJQUFJLFFBQVE7SUFDckI7SUFDQSxPQUFPLEtBQUssS0FBSyxDQUFDLElBQUksRUFBRTtFQUMxQjtFQUNBLFFBQVEsV0FBVyxHQUFHO0VBQ3RCLE9BQU87QUFDVDtBQUVBLFNBQVMsWUFBWSxZQUFtQixFQUFFLFdBQWtCO0VBQzFELE1BQU0sT0FBTyxFQUFFO0VBQ2YsSUFBSSxhQUFhO0VBQ2pCLElBQUssSUFBSSxJQUFJLEdBQUcsSUFBSSxZQUFZLE1BQU0sRUFBRSxJQUFLO0lBQzNDLE1BQU0sTUFBTSxXQUFXLENBQUMsRUFBRTtJQUUxQixJQUFJLFFBQVEsTUFBTSxXQUFXLElBQUksYUFBYSxhQUFhLE1BQU0sRUFBRTtNQUNqRSxLQUFLLElBQUksQ0FBQyxZQUFZLENBQUMsYUFBYTtJQUN0QyxPQUFPO01BQ0wsS0FBSyxJQUFJLENBQUM7SUFDWjtFQUNGO0VBQ0EsSUFBSyxJQUFJLElBQUksWUFBWSxJQUFJLGFBQWEsTUFBTSxFQUFFLElBQUs7SUFDckQsS0FBSyxJQUFJLENBQUMsWUFBWSxDQUFDLEVBQUU7RUFDM0I7RUFDQSxPQUFPO0FBQ1Q7QUFFQSxNQUFNLG1CQUFrQyxPQUFPO0FBQy9DLE1BQU0sV0FBVyxHQUFHIn0=
// denoCacheMetadata=16034095667203410023,8124202024782054744