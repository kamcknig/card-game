import { flatten } from '../array/flatten.ts';
/**
 * Creates a function that invokes `func` with arguments arranged according to the specified `indices`
 * where the argument value at the first index is provided as the first argument,
 * the argument value at the second index is provided as the second argument, and so on.
 *
 * @template F The type of the function to re-arrange.
 * @param {F} func The function to rearrange arguments for.
 * @param {Array<number | number[]>} indices The arranged argument indices.
 * @returns {(...args: any[]) => ReturnType<F>} Returns the new function.
 *
 * @example
 * const greet = (greeting: string, name: string) => `${greeting}, ${name}!`;
 * const rearrangedGreet = rearg(greet, 1, 0);
 * console.log(rearrangedGreet('World', 'Hello')); // Output: "Hello, World!"
 */ export function rearg(func, ...indices) {
  const flattenIndices = flatten(indices);
  return function(...args) {
    const reorderedArgs = flattenIndices.map((i)=>args[i]).slice(0, args.length);
    for(let i = reorderedArgs.length; i < args.length; i++){
      reorderedArgs.push(args[i]);
    }
    return func.apply(this, reorderedArgs);
  };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvZnVuY3Rpb24vcmVhcmcudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgZmxhdHRlbiB9IGZyb20gJy4uL2FycmF5L2ZsYXR0ZW4udHMnO1xuXG4vKipcbiAqIENyZWF0ZXMgYSBmdW5jdGlvbiB0aGF0IGludm9rZXMgYGZ1bmNgIHdpdGggYXJndW1lbnRzIGFycmFuZ2VkIGFjY29yZGluZyB0byB0aGUgc3BlY2lmaWVkIGBpbmRpY2VzYFxuICogd2hlcmUgdGhlIGFyZ3VtZW50IHZhbHVlIGF0IHRoZSBmaXJzdCBpbmRleCBpcyBwcm92aWRlZCBhcyB0aGUgZmlyc3QgYXJndW1lbnQsXG4gKiB0aGUgYXJndW1lbnQgdmFsdWUgYXQgdGhlIHNlY29uZCBpbmRleCBpcyBwcm92aWRlZCBhcyB0aGUgc2Vjb25kIGFyZ3VtZW50LCBhbmQgc28gb24uXG4gKlxuICogQHRlbXBsYXRlIEYgVGhlIHR5cGUgb2YgdGhlIGZ1bmN0aW9uIHRvIHJlLWFycmFuZ2UuXG4gKiBAcGFyYW0ge0Z9IGZ1bmMgVGhlIGZ1bmN0aW9uIHRvIHJlYXJyYW5nZSBhcmd1bWVudHMgZm9yLlxuICogQHBhcmFtIHtBcnJheTxudW1iZXIgfCBudW1iZXJbXT59IGluZGljZXMgVGhlIGFycmFuZ2VkIGFyZ3VtZW50IGluZGljZXMuXG4gKiBAcmV0dXJucyB7KC4uLmFyZ3M6IGFueVtdKSA9PiBSZXR1cm5UeXBlPEY+fSBSZXR1cm5zIHRoZSBuZXcgZnVuY3Rpb24uXG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IGdyZWV0ID0gKGdyZWV0aW5nOiBzdHJpbmcsIG5hbWU6IHN0cmluZykgPT4gYCR7Z3JlZXRpbmd9LCAke25hbWV9IWA7XG4gKiBjb25zdCByZWFycmFuZ2VkR3JlZXQgPSByZWFyZyhncmVldCwgMSwgMCk7XG4gKiBjb25zb2xlLmxvZyhyZWFycmFuZ2VkR3JlZXQoJ1dvcmxkJywgJ0hlbGxvJykpOyAvLyBPdXRwdXQ6IFwiSGVsbG8sIFdvcmxkIVwiXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZWFyZzxGIGV4dGVuZHMgKC4uLmFyZ3M6IGFueVtdKSA9PiBhbnk+KFxuICBmdW5jOiBGLFxuICAuLi5pbmRpY2VzOiBBcnJheTxudW1iZXIgfCBudW1iZXJbXT5cbik6ICguLi5hcmdzOiBhbnlbXSkgPT4gUmV0dXJuVHlwZTxGPiB7XG4gIGNvbnN0IGZsYXR0ZW5JbmRpY2VzID0gZmxhdHRlbihpbmRpY2VzKTtcblxuICByZXR1cm4gZnVuY3Rpb24gKHRoaXM6IGFueSwgLi4uYXJnczogYW55W10pIHtcbiAgICBjb25zdCByZW9yZGVyZWRBcmdzOiBhbnlbXSA9IGZsYXR0ZW5JbmRpY2VzLm1hcChpID0+IGFyZ3NbaV0pLnNsaWNlKDAsIGFyZ3MubGVuZ3RoKTtcblxuICAgIGZvciAobGV0IGkgPSByZW9yZGVyZWRBcmdzLmxlbmd0aDsgaSA8IGFyZ3MubGVuZ3RoOyBpKyspIHtcbiAgICAgIHJlb3JkZXJlZEFyZ3MucHVzaChhcmdzW2ldKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZnVuYy5hcHBseSh0aGlzLCByZW9yZGVyZWRBcmdzKTtcbiAgfTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLE9BQU8sUUFBUSxzQkFBc0I7QUFFOUM7Ozs7Ozs7Ozs7Ozs7O0NBY0MsR0FDRCxPQUFPLFNBQVMsTUFDZCxJQUFPLEVBQ1AsR0FBRyxPQUFpQztFQUVwQyxNQUFNLGlCQUFpQixRQUFRO0VBRS9CLE9BQU8sU0FBcUIsR0FBRyxJQUFXO0lBQ3hDLE1BQU0sZ0JBQXVCLGVBQWUsR0FBRyxDQUFDLENBQUEsSUFBSyxJQUFJLENBQUMsRUFBRSxFQUFFLEtBQUssQ0FBQyxHQUFHLEtBQUssTUFBTTtJQUVsRixJQUFLLElBQUksSUFBSSxjQUFjLE1BQU0sRUFBRSxJQUFJLEtBQUssTUFBTSxFQUFFLElBQUs7TUFDdkQsY0FBYyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUU7SUFDNUI7SUFFQSxPQUFPLEtBQUssS0FBSyxDQUFDLElBQUksRUFBRTtFQUMxQjtBQUNGIn0=
// denoCacheMetadata=2200430681419026981,7253774827234315372