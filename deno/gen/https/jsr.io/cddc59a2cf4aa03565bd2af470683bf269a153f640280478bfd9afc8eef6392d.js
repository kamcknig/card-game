/**
 * Creates a function that invokes the method at `object[key]` with `partialArgs` prepended to the arguments it receives.
 *
 * This method differs from `bind` by allowing bound functions to reference methods that may be redefined or don't yet exist.
 *
 * The `bindKey.placeholder` value, which defaults to a `symbol`, may be used as a placeholder for partially applied arguments.
 *
 * @template T - The type of the object to bind.
 * @template K - The type of the key to bind.
 * @param {T} object - The object to invoke the method on.
 * @param {K} key - The key of the method.
 * @param {...any} partialArgs - The arguments to be partially applied.
 * @returns {T[K] extends (...args: any[]) => any ? (...args: any[]) => ReturnType<T[K]> : never} - Returns the new bound function.
 *
 * @example
 * const object = {
 *   user: 'fred',
 *   greet: function (greeting, punctuation) {
 *     return greeting + ' ' + this.user + punctuation;
 *   },
 * };
 *
 * let bound = bindKey(object, 'greet', 'hi');
 * bound('!');
 * // => 'hi fred!'
 *
 * object.greet = function (greeting, punctuation) {
 *   return greeting + 'ya ' + this.user + punctuation;
 * };
 *
 * bound('!');
 * // => 'hiya fred!'
 *
 * // Bound with placeholders.
 * bound = bindKey(object, 'greet', bindKey.placeholder, '!');
 * bound('hi');
 * // => 'hiya fred!'
 */ export function bindKey(object, key, ...partialArgs) {
  const bound = function(...providedArgs) {
    const args = [];
    // Populate args by merging partialArgs and providedArgs.
    // e.g.. when we call bind(func, {}, [1, bind.placeholder, 3])(2, 4);
    // we have args with [1, 2, 3, 4].
    let startIndex = 0;
    for(let i = 0; i < partialArgs.length; i++){
      const arg = partialArgs[i];
      if (arg === bindKey.placeholder) {
        args.push(providedArgs[startIndex++]);
      } else {
        args.push(arg);
      }
    }
    for(let i = startIndex; i < providedArgs.length; i++){
      args.push(providedArgs[i]);
    }
    if (this instanceof bound) {
      return new object[key](...args);
    }
    // eslint-disable-next-line prefer-spread
    return object[key].apply(object, args);
  };
  return bound;
}
const bindKeyPlaceholder = Symbol('bindKey.placeholder');
bindKey.placeholder = bindKeyPlaceholder;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvZnVuY3Rpb24vYmluZEtleS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIENyZWF0ZXMgYSBmdW5jdGlvbiB0aGF0IGludm9rZXMgdGhlIG1ldGhvZCBhdCBgb2JqZWN0W2tleV1gIHdpdGggYHBhcnRpYWxBcmdzYCBwcmVwZW5kZWQgdG8gdGhlIGFyZ3VtZW50cyBpdCByZWNlaXZlcy5cbiAqXG4gKiBUaGlzIG1ldGhvZCBkaWZmZXJzIGZyb20gYGJpbmRgIGJ5IGFsbG93aW5nIGJvdW5kIGZ1bmN0aW9ucyB0byByZWZlcmVuY2UgbWV0aG9kcyB0aGF0IG1heSBiZSByZWRlZmluZWQgb3IgZG9uJ3QgeWV0IGV4aXN0LlxuICpcbiAqIFRoZSBgYmluZEtleS5wbGFjZWhvbGRlcmAgdmFsdWUsIHdoaWNoIGRlZmF1bHRzIHRvIGEgYHN5bWJvbGAsIG1heSBiZSB1c2VkIGFzIGEgcGxhY2Vob2xkZXIgZm9yIHBhcnRpYWxseSBhcHBsaWVkIGFyZ3VtZW50cy5cbiAqXG4gKiBAdGVtcGxhdGUgVCAtIFRoZSB0eXBlIG9mIHRoZSBvYmplY3QgdG8gYmluZC5cbiAqIEB0ZW1wbGF0ZSBLIC0gVGhlIHR5cGUgb2YgdGhlIGtleSB0byBiaW5kLlxuICogQHBhcmFtIHtUfSBvYmplY3QgLSBUaGUgb2JqZWN0IHRvIGludm9rZSB0aGUgbWV0aG9kIG9uLlxuICogQHBhcmFtIHtLfSBrZXkgLSBUaGUga2V5IG9mIHRoZSBtZXRob2QuXG4gKiBAcGFyYW0gey4uLmFueX0gcGFydGlhbEFyZ3MgLSBUaGUgYXJndW1lbnRzIHRvIGJlIHBhcnRpYWxseSBhcHBsaWVkLlxuICogQHJldHVybnMge1RbS10gZXh0ZW5kcyAoLi4uYXJnczogYW55W10pID0+IGFueSA/ICguLi5hcmdzOiBhbnlbXSkgPT4gUmV0dXJuVHlwZTxUW0tdPiA6IG5ldmVyfSAtIFJldHVybnMgdGhlIG5ldyBib3VuZCBmdW5jdGlvbi5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3Qgb2JqZWN0ID0ge1xuICogICB1c2VyOiAnZnJlZCcsXG4gKiAgIGdyZWV0OiBmdW5jdGlvbiAoZ3JlZXRpbmcsIHB1bmN0dWF0aW9uKSB7XG4gKiAgICAgcmV0dXJuIGdyZWV0aW5nICsgJyAnICsgdGhpcy51c2VyICsgcHVuY3R1YXRpb247XG4gKiAgIH0sXG4gKiB9O1xuICpcbiAqIGxldCBib3VuZCA9IGJpbmRLZXkob2JqZWN0LCAnZ3JlZXQnLCAnaGknKTtcbiAqIGJvdW5kKCchJyk7XG4gKiAvLyA9PiAnaGkgZnJlZCEnXG4gKlxuICogb2JqZWN0LmdyZWV0ID0gZnVuY3Rpb24gKGdyZWV0aW5nLCBwdW5jdHVhdGlvbikge1xuICogICByZXR1cm4gZ3JlZXRpbmcgKyAneWEgJyArIHRoaXMudXNlciArIHB1bmN0dWF0aW9uO1xuICogfTtcbiAqXG4gKiBib3VuZCgnIScpO1xuICogLy8gPT4gJ2hpeWEgZnJlZCEnXG4gKlxuICogLy8gQm91bmQgd2l0aCBwbGFjZWhvbGRlcnMuXG4gKiBib3VuZCA9IGJpbmRLZXkob2JqZWN0LCAnZ3JlZXQnLCBiaW5kS2V5LnBsYWNlaG9sZGVyLCAnIScpO1xuICogYm91bmQoJ2hpJyk7XG4gKiAvLyA9PiAnaGl5YSBmcmVkISdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGJpbmRLZXk8VCBleHRlbmRzIFJlY29yZDxQcm9wZXJ0eUtleSwgYW55PiwgSyBleHRlbmRzIGtleW9mIFQ+KFxuICBvYmplY3Q6IFQsXG4gIGtleTogSyxcbiAgLi4ucGFydGlhbEFyZ3M6IGFueVtdXG4pOiBUW0tdIGV4dGVuZHMgKC4uLmFyZ3M6IGFueVtdKSA9PiBhbnkgPyAoLi4uYXJnczogYW55W10pID0+IFJldHVyblR5cGU8VFtLXT4gOiBuZXZlciB7XG4gIGNvbnN0IGJvdW5kID0gZnVuY3Rpb24gKHRoaXM6IGFueSwgLi4ucHJvdmlkZWRBcmdzOiBhbnlbXSkge1xuICAgIGNvbnN0IGFyZ3M6IGFueVtdID0gW107XG5cbiAgICAvLyBQb3B1bGF0ZSBhcmdzIGJ5IG1lcmdpbmcgcGFydGlhbEFyZ3MgYW5kIHByb3ZpZGVkQXJncy5cbiAgICAvLyBlLmcuLiB3aGVuIHdlIGNhbGwgYmluZChmdW5jLCB7fSwgWzEsIGJpbmQucGxhY2Vob2xkZXIsIDNdKSgyLCA0KTtcbiAgICAvLyB3ZSBoYXZlIGFyZ3Mgd2l0aCBbMSwgMiwgMywgNF0uXG4gICAgbGV0IHN0YXJ0SW5kZXggPSAwO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwYXJ0aWFsQXJncy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgYXJnID0gcGFydGlhbEFyZ3NbaV07XG5cbiAgICAgIGlmIChhcmcgPT09IGJpbmRLZXkucGxhY2Vob2xkZXIpIHtcbiAgICAgICAgYXJncy5wdXNoKHByb3ZpZGVkQXJnc1tzdGFydEluZGV4KytdKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGFyZ3MucHVzaChhcmcpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZvciAobGV0IGkgPSBzdGFydEluZGV4OyBpIDwgcHJvdmlkZWRBcmdzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBhcmdzLnB1c2gocHJvdmlkZWRBcmdzW2ldKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcyBpbnN0YW5jZW9mIGJvdW5kKSB7XG4gICAgICByZXR1cm4gbmV3IG9iamVjdFtrZXldKC4uLmFyZ3MpO1xuICAgIH1cblxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBwcmVmZXItc3ByZWFkXG4gICAgcmV0dXJuIG9iamVjdFtrZXldLmFwcGx5KG9iamVjdCwgYXJncyk7XG4gIH07XG5cbiAgcmV0dXJuIGJvdW5kIGFzIGFueTtcbn1cblxuY29uc3QgYmluZEtleVBsYWNlaG9sZGVyOiB1bmlxdWUgc3ltYm9sID0gU3ltYm9sKCdiaW5kS2V5LnBsYWNlaG9sZGVyJyk7XG5iaW5kS2V5LnBsYWNlaG9sZGVyID0gYmluZEtleVBsYWNlaG9sZGVyO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBcUNDLEdBQ0QsT0FBTyxTQUFTLFFBQ2QsTUFBUyxFQUNULEdBQU0sRUFDTixHQUFHLFdBQWtCO0VBRXJCLE1BQU0sUUFBUSxTQUFxQixHQUFHLFlBQW1CO0lBQ3ZELE1BQU0sT0FBYyxFQUFFO0lBRXRCLHlEQUF5RDtJQUN6RCxxRUFBcUU7SUFDckUsa0NBQWtDO0lBQ2xDLElBQUksYUFBYTtJQUVqQixJQUFLLElBQUksSUFBSSxHQUFHLElBQUksWUFBWSxNQUFNLEVBQUUsSUFBSztNQUMzQyxNQUFNLE1BQU0sV0FBVyxDQUFDLEVBQUU7TUFFMUIsSUFBSSxRQUFRLFFBQVEsV0FBVyxFQUFFO1FBQy9CLEtBQUssSUFBSSxDQUFDLFlBQVksQ0FBQyxhQUFhO01BQ3RDLE9BQU87UUFDTCxLQUFLLElBQUksQ0FBQztNQUNaO0lBQ0Y7SUFFQSxJQUFLLElBQUksSUFBSSxZQUFZLElBQUksYUFBYSxNQUFNLEVBQUUsSUFBSztNQUNyRCxLQUFLLElBQUksQ0FBQyxZQUFZLENBQUMsRUFBRTtJQUMzQjtJQUVBLElBQUksSUFBSSxZQUFZLE9BQU87TUFDekIsT0FBTyxJQUFJLE1BQU0sQ0FBQyxJQUFJLElBQUk7SUFDNUI7SUFFQSx5Q0FBeUM7SUFDekMsT0FBTyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRO0VBQ25DO0VBRUEsT0FBTztBQUNUO0FBRUEsTUFBTSxxQkFBb0MsT0FBTztBQUNqRCxRQUFRLFdBQVcsR0FBRyJ9
// denoCacheMetadata=17913437077241848144,3385727702882557681