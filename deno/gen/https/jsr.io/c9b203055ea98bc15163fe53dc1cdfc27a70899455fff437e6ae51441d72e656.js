/**
 * Creates a memoized version of the provided function. The memoized function caches
 * results based on the argument it receives, so if the same argument is passed again,
 * it returns the cached result instead of recomputing it.
 *
 * This function works with functions that take zero or just one argument. If your function
 * originally takes multiple arguments, you should refactor it to take a single object or array
 * that combines those arguments.
 *
 * If the argument is not primitive (e.g., arrays or objects), provide a
 * `getCacheKey` function to generate a unique cache key for proper caching.
 *
 * @template F - The type of the function to be memoized.
 * @param {F} fn - The function to be memoized. It should accept a single argument and return a value.
 * @param {MemoizeOptions<Parameters<F>[0], ReturnType<F>>} [options={}] - Optional configuration for the memoization.
 * @param {MemoizeCache<any, V>} [options.cache] - The cache object used to store results. Defaults to a new `Map`.
 * @param {(args: A) => unknown} [options.getCacheKey] - An optional function to generate a unique cache key for each argument.
 *
 * @returns The memoized function with an additional `cache` property that exposes the internal cache.
 *
 * @example
 * // Example using the default cache
 * const add = (x: number) => x + 10;
 * const memoizedAdd = memoize(add);
 *
 * console.log(memoizedAdd(5)); // 15
 * console.log(memoizedAdd(5)); // 15 (cached result)
 * console.log(memoizedAdd.cache.size); // 1
 *
 * @example
 * // Example using a custom resolver
 * const sum = (arr: number[]) => arr.reduce((x, y) => x + y, 0);
 * const memoizedSum = memoize(sum, { getCacheKey: (arr: number[]) => arr.join(',') });
 * console.log(memoizedSum([1, 2])); // 3
 * console.log(memoizedSum([1, 2])); // 3 (cached result)
 * console.log(memoizedSum.cache.size); // 1
 *
 * @example
 * // Example using a custom cache implementation
 * class CustomCache<K, T> implements MemoizeCache<K, T> {
 *   private cache = new Map<K, T>();
 *
 *   set(key: K, value: T): void {
 *     this.cache.set(key, value);
 *   }
 *
 *   get(key: K): T | undefined {
 *     return this.cache.get(key);
 *   }
 *
 *   has(key: K): boolean {
 *     return this.cache.has(key);
 *   }
 *
 *   delete(key: K): boolean {
 *     return this.cache.delete(key);
 *   }
 *
 *   clear(): void {
 *     this.cache.clear();
 *   }
 *
 *   get size(): number {
 *     return this.cache.size;
 *   }
 * }
 * const customCache = new CustomCache<string, number>();
 * const memoizedSumWithCustomCache = memoize(sum, { cache: customCache });
 * console.log(memoizedSumWithCustomCache([1, 2])); // 3
 * console.log(memoizedSumWithCustomCache([1, 2])); // 3 (cached result)
 * console.log(memoizedAddWithCustomCache.cache.size); // 1
 */ export function memoize(fn, options = {}) {
  const { cache = new Map(), getCacheKey } = options;
  const memoizedFn = function(arg) {
    const key = getCacheKey ? getCacheKey(arg) : arg;
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = fn.call(this, arg);
    cache.set(key, result);
    return result;
  };
  memoizedFn.cache = cache;
  return memoizedFn;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9mdW5jdGlvbi9tZW1vaXplLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQ3JlYXRlcyBhIG1lbW9pemVkIHZlcnNpb24gb2YgdGhlIHByb3ZpZGVkIGZ1bmN0aW9uLiBUaGUgbWVtb2l6ZWQgZnVuY3Rpb24gY2FjaGVzXG4gKiByZXN1bHRzIGJhc2VkIG9uIHRoZSBhcmd1bWVudCBpdCByZWNlaXZlcywgc28gaWYgdGhlIHNhbWUgYXJndW1lbnQgaXMgcGFzc2VkIGFnYWluLFxuICogaXQgcmV0dXJucyB0aGUgY2FjaGVkIHJlc3VsdCBpbnN0ZWFkIG9mIHJlY29tcHV0aW5nIGl0LlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gd29ya3Mgd2l0aCBmdW5jdGlvbnMgdGhhdCB0YWtlIHplcm8gb3IganVzdCBvbmUgYXJndW1lbnQuIElmIHlvdXIgZnVuY3Rpb25cbiAqIG9yaWdpbmFsbHkgdGFrZXMgbXVsdGlwbGUgYXJndW1lbnRzLCB5b3Ugc2hvdWxkIHJlZmFjdG9yIGl0IHRvIHRha2UgYSBzaW5nbGUgb2JqZWN0IG9yIGFycmF5XG4gKiB0aGF0IGNvbWJpbmVzIHRob3NlIGFyZ3VtZW50cy5cbiAqXG4gKiBJZiB0aGUgYXJndW1lbnQgaXMgbm90IHByaW1pdGl2ZSAoZS5nLiwgYXJyYXlzIG9yIG9iamVjdHMpLCBwcm92aWRlIGFcbiAqIGBnZXRDYWNoZUtleWAgZnVuY3Rpb24gdG8gZ2VuZXJhdGUgYSB1bmlxdWUgY2FjaGUga2V5IGZvciBwcm9wZXIgY2FjaGluZy5cbiAqXG4gKiBAdGVtcGxhdGUgRiAtIFRoZSB0eXBlIG9mIHRoZSBmdW5jdGlvbiB0byBiZSBtZW1vaXplZC5cbiAqIEBwYXJhbSB7Rn0gZm4gLSBUaGUgZnVuY3Rpb24gdG8gYmUgbWVtb2l6ZWQuIEl0IHNob3VsZCBhY2NlcHQgYSBzaW5nbGUgYXJndW1lbnQgYW5kIHJldHVybiBhIHZhbHVlLlxuICogQHBhcmFtIHtNZW1vaXplT3B0aW9uczxQYXJhbWV0ZXJzPEY+WzBdLCBSZXR1cm5UeXBlPEY+Pn0gW29wdGlvbnM9e31dIC0gT3B0aW9uYWwgY29uZmlndXJhdGlvbiBmb3IgdGhlIG1lbW9pemF0aW9uLlxuICogQHBhcmFtIHtNZW1vaXplQ2FjaGU8YW55LCBWPn0gW29wdGlvbnMuY2FjaGVdIC0gVGhlIGNhY2hlIG9iamVjdCB1c2VkIHRvIHN0b3JlIHJlc3VsdHMuIERlZmF1bHRzIHRvIGEgbmV3IGBNYXBgLlxuICogQHBhcmFtIHsoYXJnczogQSkgPT4gdW5rbm93bn0gW29wdGlvbnMuZ2V0Q2FjaGVLZXldIC0gQW4gb3B0aW9uYWwgZnVuY3Rpb24gdG8gZ2VuZXJhdGUgYSB1bmlxdWUgY2FjaGUga2V5IGZvciBlYWNoIGFyZ3VtZW50LlxuICpcbiAqIEByZXR1cm5zIFRoZSBtZW1vaXplZCBmdW5jdGlvbiB3aXRoIGFuIGFkZGl0aW9uYWwgYGNhY2hlYCBwcm9wZXJ0eSB0aGF0IGV4cG9zZXMgdGhlIGludGVybmFsIGNhY2hlLlxuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBFeGFtcGxlIHVzaW5nIHRoZSBkZWZhdWx0IGNhY2hlXG4gKiBjb25zdCBhZGQgPSAoeDogbnVtYmVyKSA9PiB4ICsgMTA7XG4gKiBjb25zdCBtZW1vaXplZEFkZCA9IG1lbW9pemUoYWRkKTtcbiAqXG4gKiBjb25zb2xlLmxvZyhtZW1vaXplZEFkZCg1KSk7IC8vIDE1XG4gKiBjb25zb2xlLmxvZyhtZW1vaXplZEFkZCg1KSk7IC8vIDE1IChjYWNoZWQgcmVzdWx0KVxuICogY29uc29sZS5sb2cobWVtb2l6ZWRBZGQuY2FjaGUuc2l6ZSk7IC8vIDFcbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gRXhhbXBsZSB1c2luZyBhIGN1c3RvbSByZXNvbHZlclxuICogY29uc3Qgc3VtID0gKGFycjogbnVtYmVyW10pID0+IGFyci5yZWR1Y2UoKHgsIHkpID0+IHggKyB5LCAwKTtcbiAqIGNvbnN0IG1lbW9pemVkU3VtID0gbWVtb2l6ZShzdW0sIHsgZ2V0Q2FjaGVLZXk6IChhcnI6IG51bWJlcltdKSA9PiBhcnIuam9pbignLCcpIH0pO1xuICogY29uc29sZS5sb2cobWVtb2l6ZWRTdW0oWzEsIDJdKSk7IC8vIDNcbiAqIGNvbnNvbGUubG9nKG1lbW9pemVkU3VtKFsxLCAyXSkpOyAvLyAzIChjYWNoZWQgcmVzdWx0KVxuICogY29uc29sZS5sb2cobWVtb2l6ZWRTdW0uY2FjaGUuc2l6ZSk7IC8vIDFcbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gRXhhbXBsZSB1c2luZyBhIGN1c3RvbSBjYWNoZSBpbXBsZW1lbnRhdGlvblxuICogY2xhc3MgQ3VzdG9tQ2FjaGU8SywgVD4gaW1wbGVtZW50cyBNZW1vaXplQ2FjaGU8SywgVD4ge1xuICogICBwcml2YXRlIGNhY2hlID0gbmV3IE1hcDxLLCBUPigpO1xuICpcbiAqICAgc2V0KGtleTogSywgdmFsdWU6IFQpOiB2b2lkIHtcbiAqICAgICB0aGlzLmNhY2hlLnNldChrZXksIHZhbHVlKTtcbiAqICAgfVxuICpcbiAqICAgZ2V0KGtleTogSyk6IFQgfCB1bmRlZmluZWQge1xuICogICAgIHJldHVybiB0aGlzLmNhY2hlLmdldChrZXkpO1xuICogICB9XG4gKlxuICogICBoYXMoa2V5OiBLKTogYm9vbGVhbiB7XG4gKiAgICAgcmV0dXJuIHRoaXMuY2FjaGUuaGFzKGtleSk7XG4gKiAgIH1cbiAqXG4gKiAgIGRlbGV0ZShrZXk6IEspOiBib29sZWFuIHtcbiAqICAgICByZXR1cm4gdGhpcy5jYWNoZS5kZWxldGUoa2V5KTtcbiAqICAgfVxuICpcbiAqICAgY2xlYXIoKTogdm9pZCB7XG4gKiAgICAgdGhpcy5jYWNoZS5jbGVhcigpO1xuICogICB9XG4gKlxuICogICBnZXQgc2l6ZSgpOiBudW1iZXIge1xuICogICAgIHJldHVybiB0aGlzLmNhY2hlLnNpemU7XG4gKiAgIH1cbiAqIH1cbiAqIGNvbnN0IGN1c3RvbUNhY2hlID0gbmV3IEN1c3RvbUNhY2hlPHN0cmluZywgbnVtYmVyPigpO1xuICogY29uc3QgbWVtb2l6ZWRTdW1XaXRoQ3VzdG9tQ2FjaGUgPSBtZW1vaXplKHN1bSwgeyBjYWNoZTogY3VzdG9tQ2FjaGUgfSk7XG4gKiBjb25zb2xlLmxvZyhtZW1vaXplZFN1bVdpdGhDdXN0b21DYWNoZShbMSwgMl0pKTsgLy8gM1xuICogY29uc29sZS5sb2cobWVtb2l6ZWRTdW1XaXRoQ3VzdG9tQ2FjaGUoWzEsIDJdKSk7IC8vIDMgKGNhY2hlZCByZXN1bHQpXG4gKiBjb25zb2xlLmxvZyhtZW1vaXplZEFkZFdpdGhDdXN0b21DYWNoZS5jYWNoZS5zaXplKTsgLy8gMVxuICovXG5leHBvcnQgZnVuY3Rpb24gbWVtb2l6ZTxGIGV4dGVuZHMgKC4uLmFyZ3M6IGFueSkgPT4gYW55PihcbiAgZm46IEYsXG4gIG9wdGlvbnM6IHtcbiAgICBjYWNoZT86IE1lbW9pemVDYWNoZTxhbnksIFJldHVyblR5cGU8Rj4+O1xuICAgIGdldENhY2hlS2V5PzogKGFyZ3M6IFBhcmFtZXRlcnM8Rj5bMF0pID0+IHVua25vd247XG4gIH0gPSB7fVxuKTogRiAmIHsgY2FjaGU6IE1lbW9pemVDYWNoZTxhbnksIFJldHVyblR5cGU8Rj4+IH0ge1xuICBjb25zdCB7IGNhY2hlID0gbmV3IE1hcDx1bmtub3duLCBSZXR1cm5UeXBlPEY+PigpLCBnZXRDYWNoZUtleSB9ID0gb3B0aW9ucztcblxuICBjb25zdCBtZW1vaXplZEZuID0gZnVuY3Rpb24gKHRoaXM6IHVua25vd24sIGFyZzogUGFyYW1ldGVyczxGPlswXSk6IFJldHVyblR5cGU8Rj4ge1xuICAgIGNvbnN0IGtleSA9IGdldENhY2hlS2V5ID8gZ2V0Q2FjaGVLZXkoYXJnKSA6IGFyZztcblxuICAgIGlmIChjYWNoZS5oYXMoa2V5KSkge1xuICAgICAgcmV0dXJuIGNhY2hlLmdldChrZXkpITtcbiAgICB9XG5cbiAgICBjb25zdCByZXN1bHQgPSBmbi5jYWxsKHRoaXMsIGFyZyk7XG5cbiAgICBjYWNoZS5zZXQoa2V5LCByZXN1bHQpO1xuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfTtcblxuICBtZW1vaXplZEZuLmNhY2hlID0gY2FjaGU7XG5cbiAgcmV0dXJuIG1lbW9pemVkRm4gYXMgRiAmIHsgY2FjaGU6IE1lbW9pemVDYWNoZTxhbnksIFJldHVyblR5cGU8Rj4+IH07XG59XG5cbi8qKlxuICogUmVwcmVzZW50cyBhIGNhY2hlIGZvciBtZW1vaXphdGlvbiwgYWxsb3dpbmcgc3RvcmFnZSBhbmQgcmV0cmlldmFsIG9mIGNvbXB1dGVkIHZhbHVlcy5cbiAqXG4gKiBAdGVtcGxhdGUgSyAtIFRoZSB0eXBlIG9mIGtleXMgdXNlZCB0byBzdG9yZSB2YWx1ZXMgaW4gdGhlIGNhY2hlLlxuICogQHRlbXBsYXRlIFYgLSBUaGUgdHlwZSBvZiB2YWx1ZXMgc3RvcmVkIGluIHRoZSBjYWNoZS5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBNZW1vaXplQ2FjaGU8SywgVj4ge1xuICAvKipcbiAgICogU3RvcmVzIGEgdmFsdWUgaW4gdGhlIGNhY2hlIHdpdGggdGhlIHNwZWNpZmllZCBrZXkuXG4gICAqXG4gICAqIEBwYXJhbSBrZXkgLSBUaGUga2V5IHRvIGFzc29jaWF0ZSB3aXRoIHRoZSB2YWx1ZS5cbiAgICogQHBhcmFtIHZhbHVlIC0gVGhlIHZhbHVlIHRvIHN0b3JlIGluIHRoZSBjYWNoZS5cbiAgICovXG4gIHNldChrZXk6IEssIHZhbHVlOiBWKTogdm9pZDtcblxuICAvKipcbiAgICogUmV0cmlldmVzIGEgdmFsdWUgZnJvbSB0aGUgY2FjaGUgYnkgaXRzIGtleS5cbiAgICpcbiAgICogQHBhcmFtIGtleSAtIFRoZSBrZXkgb2YgdGhlIHZhbHVlIHRvIHJldHJpZXZlLlxuICAgKiBAcmV0dXJucyBUaGUgdmFsdWUgYXNzb2NpYXRlZCB3aXRoIHRoZSBrZXksIG9yIHVuZGVmaW5lZCBpZiB0aGUga2V5IGRvZXMgbm90IGV4aXN0LlxuICAgKi9cbiAgZ2V0KGtleTogSyk6IFYgfCB1bmRlZmluZWQ7XG5cbiAgLyoqXG4gICAqIENoZWNrcyBpZiBhIHZhbHVlIGV4aXN0cyBpbiB0aGUgY2FjaGUgZm9yIHRoZSBzcGVjaWZpZWQga2V5LlxuICAgKlxuICAgKiBAcGFyYW0ga2V5IC0gVGhlIGtleSB0byBjaGVjayBmb3IgZXhpc3RlbmNlIGluIHRoZSBjYWNoZS5cbiAgICogQHJldHVybnMgVHJ1ZSBpZiB0aGUgY2FjaGUgY29udGFpbnMgdGhlIGtleSwgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgKi9cbiAgaGFzKGtleTogSyk6IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIERlbGV0ZXMgYSB2YWx1ZSBmcm9tIHRoZSBjYWNoZSBieSBpdHMga2V5LlxuICAgKlxuICAgKiBAcGFyYW0ga2V5IC0gVGhlIGtleSBvZiB0aGUgdmFsdWUgdG8gZGVsZXRlLlxuICAgKiBAcmV0dXJucyBUcnVlIGlmIHRoZSB2YWx1ZSB3YXMgc3VjY2Vzc2Z1bGx5IGRlbGV0ZWQsIGZhbHNlIG90aGVyd2lzZS5cbiAgICovXG4gIGRlbGV0ZShrZXk6IEspOiBib29sZWFuIHwgdm9pZDtcblxuICAvKipcbiAgICogQ2xlYXJzIGFsbCB2YWx1ZXMgZnJvbSB0aGUgY2FjaGUuXG4gICAqL1xuICBjbGVhcigpOiB2b2lkO1xuXG4gIC8qKlxuICAgKiBUaGUgbnVtYmVyIG9mIGVudHJpZXMgaW4gdGhlIGNhY2hlLlxuICAgKi9cbiAgc2l6ZTogbnVtYmVyO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQXVFQyxHQUNELE9BQU8sU0FBUyxRQUNkLEVBQUssRUFDTCxVQUdJLENBQUMsQ0FBQztFQUVOLE1BQU0sRUFBRSxRQUFRLElBQUksS0FBNkIsRUFBRSxXQUFXLEVBQUUsR0FBRztFQUVuRSxNQUFNLGFBQWEsU0FBeUIsR0FBcUI7SUFDL0QsTUFBTSxNQUFNLGNBQWMsWUFBWSxPQUFPO0lBRTdDLElBQUksTUFBTSxHQUFHLENBQUMsTUFBTTtNQUNsQixPQUFPLE1BQU0sR0FBRyxDQUFDO0lBQ25CO0lBRUEsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLElBQUksRUFBRTtJQUU3QixNQUFNLEdBQUcsQ0FBQyxLQUFLO0lBRWYsT0FBTztFQUNUO0VBRUEsV0FBVyxLQUFLLEdBQUc7RUFFbkIsT0FBTztBQUNUIn0=
// denoCacheMetadata=17772674555291584530,5876556913318860735