import { debounce as debounceToolkit } from '../../function/debounce.ts';
/**
 * Creates a debounced function that delays invoking the provided function until after `debounceMs` milliseconds
 * have elapsed since the last time the debounced function was invoked. The debounced function also has a `cancel`
 * method to cancel any pending execution.
 *
 * You can set the debounced function to run at the start (`leading`) or end (`trailing`) of the delay period.
 * If `leading` is true, the function runs immediately on the first call.
 * If `trailing` is true, the function runs after `debounceMs` milliseconds have passed since the last call.
 * If both `leading` and `trailing` are true, the function runs at both the start and end, but it must be called at least twice within `debounceMs` milliseconds for this to happen
 * (since one debounced function call cannot trigger the function twice).
 *
 * You can also set a `maxWait` time, which is the maximum time the function is allowed to be delayed before it is called.
 *
 * @template F - The type of function.
 * @param {F} func - The function to debounce.
 * @param {number} debounceMs - The number of milliseconds to delay.
 * @param {DebounceOptions} options - The options object
 * @param {AbortSignal} options.signal - An optional AbortSignal to cancel the debounced function.
 * @param {boolean} options.leading - If `true`, the function will be invoked on the leading edge of the timeout.
 * @param {boolean} options.trailing - If `true`, the function will be invoked on the trailing edge of the timeout.
 * @param {number} options.maxWait - The maximum time `func` is allowed to be delayed before it's invoked.
 * @returns A new debounced function with a `cancel` method.
 *
 * @example
 * const debouncedFunction = debounce(() => {
 *   console.log('Function executed');
 * }, 1000);
 *
 * // Will log 'Function executed' after 1 second if not called again in that time
 * debouncedFunction();
 *
 * // Will not log anything as the previous call is canceled
 * debouncedFunction.cancel();
 *
 * // With AbortSignal
 * const controller = new AbortController();
 * const signal = controller.signal;
 * const debouncedWithSignal = debounce(() => {
 *  console.log('Function executed');
 * }, 1000, { signal });
 *
 * debouncedWithSignal();
 *
 * // Will cancel the debounced function call
 * controller.abort();
 */ export function debounce(func, debounceMs = 0, options = {}) {
  if (typeof options !== 'object') {
    options = {};
  }
  const { signal, leading = false, trailing = true, maxWait } = options;
  const edges = Array(2);
  if (leading) {
    edges[0] = 'leading';
  }
  if (trailing) {
    edges[1] = 'trailing';
  }
  let result = undefined;
  let pendingAt = null;
  const _debounced = debounceToolkit(function(...args) {
    result = func.apply(this, args);
    pendingAt = null;
  }, debounceMs, {
    signal,
    edges
  });
  const debounced = function(...args) {
    if (maxWait != null) {
      if (pendingAt === null) {
        pendingAt = Date.now();
      } else {
        if (Date.now() - pendingAt >= maxWait) {
          result = func.apply(this, args);
          pendingAt = Date.now();
          _debounced.cancel();
          _debounced.schedule();
          return result;
        }
      }
    }
    _debounced.apply(this, args);
    return result;
  };
  const flush = ()=>{
    _debounced.flush();
    return result;
  };
  debounced.cancel = _debounced.cancel;
  debounced.flush = flush;
  return debounced;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvZnVuY3Rpb24vZGVib3VuY2UudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgZGVib3VuY2UgYXMgZGVib3VuY2VUb29sa2l0IH0gZnJvbSAnLi4vLi4vZnVuY3Rpb24vZGVib3VuY2UudHMnO1xuXG5pbnRlcmZhY2UgRGVib3VuY2VPcHRpb25zIHtcbiAgLyoqXG4gICAqIEFuIG9wdGlvbmFsIEFib3J0U2lnbmFsIHRvIGNhbmNlbCB0aGUgZGVib3VuY2VkIGZ1bmN0aW9uLlxuICAgKi9cbiAgc2lnbmFsPzogQWJvcnRTaWduYWw7XG5cbiAgLyoqXG4gICAqIElmIGB0cnVlYCwgdGhlIGZ1bmN0aW9uIHdpbGwgYmUgaW52b2tlZCBvbiB0aGUgbGVhZGluZyBlZGdlIG9mIHRoZSB0aW1lb3V0LlxuICAgKiBAZGVmYXVsdCBmYWxzZVxuICAgKi9cbiAgbGVhZGluZz86IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIElmIGB0cnVlYCwgdGhlIGZ1bmN0aW9uIHdpbGwgYmUgaW52b2tlZCBvbiB0aGUgdHJhaWxpbmcgZWRnZSBvZiB0aGUgdGltZW91dC5cbiAgICogQGRlZmF1bHQgdHJ1ZVxuICAgKi9cbiAgdHJhaWxpbmc/OiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBUaGUgbWF4aW11bSB0aW1lIGBmdW5jYCBpcyBhbGxvd2VkIHRvIGJlIGRlbGF5ZWQgYmVmb3JlIGl0J3MgaW52b2tlZC5cbiAgICogQGRlZmF1bHQgSW5maW5pdHlcbiAgICovXG4gIG1heFdhaXQ/OiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRGVib3VuY2VkRnVuY3Rpb248RiBleHRlbmRzICguLi5hcmdzOiBhbnlbXSkgPT4gYW55PiB7XG4gICguLi5hcmdzOiBQYXJhbWV0ZXJzPEY+KTogUmV0dXJuVHlwZTxGPiB8IHVuZGVmaW5lZDtcbiAgY2FuY2VsKCk6IHZvaWQ7XG4gIGZsdXNoKCk6IHZvaWQ7XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIGRlYm91bmNlZCBmdW5jdGlvbiB0aGF0IGRlbGF5cyBpbnZva2luZyB0aGUgcHJvdmlkZWQgZnVuY3Rpb24gdW50aWwgYWZ0ZXIgYGRlYm91bmNlTXNgIG1pbGxpc2Vjb25kc1xuICogaGF2ZSBlbGFwc2VkIHNpbmNlIHRoZSBsYXN0IHRpbWUgdGhlIGRlYm91bmNlZCBmdW5jdGlvbiB3YXMgaW52b2tlZC4gVGhlIGRlYm91bmNlZCBmdW5jdGlvbiBhbHNvIGhhcyBhIGBjYW5jZWxgXG4gKiBtZXRob2QgdG8gY2FuY2VsIGFueSBwZW5kaW5nIGV4ZWN1dGlvbi5cbiAqXG4gKiBZb3UgY2FuIHNldCB0aGUgZGVib3VuY2VkIGZ1bmN0aW9uIHRvIHJ1biBhdCB0aGUgc3RhcnQgKGBsZWFkaW5nYCkgb3IgZW5kIChgdHJhaWxpbmdgKSBvZiB0aGUgZGVsYXkgcGVyaW9kLlxuICogSWYgYGxlYWRpbmdgIGlzIHRydWUsIHRoZSBmdW5jdGlvbiBydW5zIGltbWVkaWF0ZWx5IG9uIHRoZSBmaXJzdCBjYWxsLlxuICogSWYgYHRyYWlsaW5nYCBpcyB0cnVlLCB0aGUgZnVuY3Rpb24gcnVucyBhZnRlciBgZGVib3VuY2VNc2AgbWlsbGlzZWNvbmRzIGhhdmUgcGFzc2VkIHNpbmNlIHRoZSBsYXN0IGNhbGwuXG4gKiBJZiBib3RoIGBsZWFkaW5nYCBhbmQgYHRyYWlsaW5nYCBhcmUgdHJ1ZSwgdGhlIGZ1bmN0aW9uIHJ1bnMgYXQgYm90aCB0aGUgc3RhcnQgYW5kIGVuZCwgYnV0IGl0IG11c3QgYmUgY2FsbGVkIGF0IGxlYXN0IHR3aWNlIHdpdGhpbiBgZGVib3VuY2VNc2AgbWlsbGlzZWNvbmRzIGZvciB0aGlzIHRvIGhhcHBlblxuICogKHNpbmNlIG9uZSBkZWJvdW5jZWQgZnVuY3Rpb24gY2FsbCBjYW5ub3QgdHJpZ2dlciB0aGUgZnVuY3Rpb24gdHdpY2UpLlxuICpcbiAqIFlvdSBjYW4gYWxzbyBzZXQgYSBgbWF4V2FpdGAgdGltZSwgd2hpY2ggaXMgdGhlIG1heGltdW0gdGltZSB0aGUgZnVuY3Rpb24gaXMgYWxsb3dlZCB0byBiZSBkZWxheWVkIGJlZm9yZSBpdCBpcyBjYWxsZWQuXG4gKlxuICogQHRlbXBsYXRlIEYgLSBUaGUgdHlwZSBvZiBmdW5jdGlvbi5cbiAqIEBwYXJhbSB7Rn0gZnVuYyAtIFRoZSBmdW5jdGlvbiB0byBkZWJvdW5jZS5cbiAqIEBwYXJhbSB7bnVtYmVyfSBkZWJvdW5jZU1zIC0gVGhlIG51bWJlciBvZiBtaWxsaXNlY29uZHMgdG8gZGVsYXkuXG4gKiBAcGFyYW0ge0RlYm91bmNlT3B0aW9uc30gb3B0aW9ucyAtIFRoZSBvcHRpb25zIG9iamVjdFxuICogQHBhcmFtIHtBYm9ydFNpZ25hbH0gb3B0aW9ucy5zaWduYWwgLSBBbiBvcHRpb25hbCBBYm9ydFNpZ25hbCB0byBjYW5jZWwgdGhlIGRlYm91bmNlZCBmdW5jdGlvbi5cbiAqIEBwYXJhbSB7Ym9vbGVhbn0gb3B0aW9ucy5sZWFkaW5nIC0gSWYgYHRydWVgLCB0aGUgZnVuY3Rpb24gd2lsbCBiZSBpbnZva2VkIG9uIHRoZSBsZWFkaW5nIGVkZ2Ugb2YgdGhlIHRpbWVvdXQuXG4gKiBAcGFyYW0ge2Jvb2xlYW59IG9wdGlvbnMudHJhaWxpbmcgLSBJZiBgdHJ1ZWAsIHRoZSBmdW5jdGlvbiB3aWxsIGJlIGludm9rZWQgb24gdGhlIHRyYWlsaW5nIGVkZ2Ugb2YgdGhlIHRpbWVvdXQuXG4gKiBAcGFyYW0ge251bWJlcn0gb3B0aW9ucy5tYXhXYWl0IC0gVGhlIG1heGltdW0gdGltZSBgZnVuY2AgaXMgYWxsb3dlZCB0byBiZSBkZWxheWVkIGJlZm9yZSBpdCdzIGludm9rZWQuXG4gKiBAcmV0dXJucyBBIG5ldyBkZWJvdW5jZWQgZnVuY3Rpb24gd2l0aCBhIGBjYW5jZWxgIG1ldGhvZC5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgZGVib3VuY2VkRnVuY3Rpb24gPSBkZWJvdW5jZSgoKSA9PiB7XG4gKiAgIGNvbnNvbGUubG9nKCdGdW5jdGlvbiBleGVjdXRlZCcpO1xuICogfSwgMTAwMCk7XG4gKlxuICogLy8gV2lsbCBsb2cgJ0Z1bmN0aW9uIGV4ZWN1dGVkJyBhZnRlciAxIHNlY29uZCBpZiBub3QgY2FsbGVkIGFnYWluIGluIHRoYXQgdGltZVxuICogZGVib3VuY2VkRnVuY3Rpb24oKTtcbiAqXG4gKiAvLyBXaWxsIG5vdCBsb2cgYW55dGhpbmcgYXMgdGhlIHByZXZpb3VzIGNhbGwgaXMgY2FuY2VsZWRcbiAqIGRlYm91bmNlZEZ1bmN0aW9uLmNhbmNlbCgpO1xuICpcbiAqIC8vIFdpdGggQWJvcnRTaWduYWxcbiAqIGNvbnN0IGNvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gKiBjb25zdCBzaWduYWwgPSBjb250cm9sbGVyLnNpZ25hbDtcbiAqIGNvbnN0IGRlYm91bmNlZFdpdGhTaWduYWwgPSBkZWJvdW5jZSgoKSA9PiB7XG4gKiAgY29uc29sZS5sb2coJ0Z1bmN0aW9uIGV4ZWN1dGVkJyk7XG4gKiB9LCAxMDAwLCB7IHNpZ25hbCB9KTtcbiAqXG4gKiBkZWJvdW5jZWRXaXRoU2lnbmFsKCk7XG4gKlxuICogLy8gV2lsbCBjYW5jZWwgdGhlIGRlYm91bmNlZCBmdW5jdGlvbiBjYWxsXG4gKiBjb250cm9sbGVyLmFib3J0KCk7XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkZWJvdW5jZTxGIGV4dGVuZHMgKC4uLmFyZ3M6IGFueVtdKSA9PiBhbnk+KFxuICBmdW5jOiBGLFxuICBkZWJvdW5jZU1zID0gMCxcbiAgb3B0aW9uczogRGVib3VuY2VPcHRpb25zID0ge31cbik6IERlYm91bmNlZEZ1bmN0aW9uPEY+IHtcbiAgaWYgKHR5cGVvZiBvcHRpb25zICE9PSAnb2JqZWN0Jykge1xuICAgIG9wdGlvbnMgPSB7fTtcbiAgfVxuXG4gIGNvbnN0IHsgc2lnbmFsLCBsZWFkaW5nID0gZmFsc2UsIHRyYWlsaW5nID0gdHJ1ZSwgbWF4V2FpdCB9ID0gb3B0aW9ucztcblxuICBjb25zdCBlZGdlcyA9IEFycmF5KDIpO1xuXG4gIGlmIChsZWFkaW5nKSB7XG4gICAgZWRnZXNbMF0gPSAnbGVhZGluZyc7XG4gIH1cblxuICBpZiAodHJhaWxpbmcpIHtcbiAgICBlZGdlc1sxXSA9ICd0cmFpbGluZyc7XG4gIH1cblxuICBsZXQgcmVzdWx0OiBSZXR1cm5UeXBlPEY+IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuICBsZXQgcGVuZGluZ0F0OiBudW1iZXIgfCBudWxsID0gbnVsbDtcblxuICBjb25zdCBfZGVib3VuY2VkID0gZGVib3VuY2VUb29sa2l0KFxuICAgIGZ1bmN0aW9uICh0aGlzOiBhbnksIC4uLmFyZ3M6IFBhcmFtZXRlcnM8Rj4pIHtcbiAgICAgIHJlc3VsdCA9IGZ1bmMuYXBwbHkodGhpcywgYXJncyk7XG4gICAgICBwZW5kaW5nQXQgPSBudWxsO1xuICAgIH0sXG4gICAgZGVib3VuY2VNcyxcbiAgICB7IHNpZ25hbCwgZWRnZXMgfVxuICApO1xuXG4gIGNvbnN0IGRlYm91bmNlZCA9IGZ1bmN0aW9uICh0aGlzOiBhbnksIC4uLmFyZ3M6IFBhcmFtZXRlcnM8Rj4pIHtcbiAgICBpZiAobWF4V2FpdCAhPSBudWxsKSB7XG4gICAgICBpZiAocGVuZGluZ0F0ID09PSBudWxsKSB7XG4gICAgICAgIHBlbmRpbmdBdCA9IERhdGUubm93KCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoRGF0ZS5ub3coKSAtIHBlbmRpbmdBdCA+PSBtYXhXYWl0KSB7XG4gICAgICAgICAgcmVzdWx0ID0gZnVuYy5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICAgICAgICBwZW5kaW5nQXQgPSBEYXRlLm5vdygpO1xuXG4gICAgICAgICAgX2RlYm91bmNlZC5jYW5jZWwoKTtcbiAgICAgICAgICBfZGVib3VuY2VkLnNjaGVkdWxlKCk7XG5cbiAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgX2RlYm91bmNlZC5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xuXG4gIGNvbnN0IGZsdXNoID0gKCkgPT4ge1xuICAgIF9kZWJvdW5jZWQuZmx1c2goKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xuXG4gIGRlYm91bmNlZC5jYW5jZWwgPSBfZGVib3VuY2VkLmNhbmNlbDtcbiAgZGVib3VuY2VkLmZsdXNoID0gZmx1c2g7XG5cbiAgcmV0dXJuIGRlYm91bmNlZDtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLFlBQVksZUFBZSxRQUFRLDZCQUE2QjtBQWlDekU7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQTZDQyxHQUNELE9BQU8sU0FBUyxTQUNkLElBQU8sRUFDUCxhQUFhLENBQUMsRUFDZCxVQUEyQixDQUFDLENBQUM7RUFFN0IsSUFBSSxPQUFPLFlBQVksVUFBVTtJQUMvQixVQUFVLENBQUM7RUFDYjtFQUVBLE1BQU0sRUFBRSxNQUFNLEVBQUUsVUFBVSxLQUFLLEVBQUUsV0FBVyxJQUFJLEVBQUUsT0FBTyxFQUFFLEdBQUc7RUFFOUQsTUFBTSxRQUFRLE1BQU07RUFFcEIsSUFBSSxTQUFTO0lBQ1gsS0FBSyxDQUFDLEVBQUUsR0FBRztFQUNiO0VBRUEsSUFBSSxVQUFVO0lBQ1osS0FBSyxDQUFDLEVBQUUsR0FBRztFQUNiO0VBRUEsSUFBSSxTQUFvQztFQUN4QyxJQUFJLFlBQTJCO0VBRS9CLE1BQU0sYUFBYSxnQkFDakIsU0FBcUIsR0FBRyxJQUFtQjtJQUN6QyxTQUFTLEtBQUssS0FBSyxDQUFDLElBQUksRUFBRTtJQUMxQixZQUFZO0VBQ2QsR0FDQSxZQUNBO0lBQUU7SUFBUTtFQUFNO0VBR2xCLE1BQU0sWUFBWSxTQUFxQixHQUFHLElBQW1CO0lBQzNELElBQUksV0FBVyxNQUFNO01BQ25CLElBQUksY0FBYyxNQUFNO1FBQ3RCLFlBQVksS0FBSyxHQUFHO01BQ3RCLE9BQU87UUFDTCxJQUFJLEtBQUssR0FBRyxLQUFLLGFBQWEsU0FBUztVQUNyQyxTQUFTLEtBQUssS0FBSyxDQUFDLElBQUksRUFBRTtVQUMxQixZQUFZLEtBQUssR0FBRztVQUVwQixXQUFXLE1BQU07VUFDakIsV0FBVyxRQUFRO1VBRW5CLE9BQU87UUFDVDtNQUNGO0lBQ0Y7SUFFQSxXQUFXLEtBQUssQ0FBQyxJQUFJLEVBQUU7SUFDdkIsT0FBTztFQUNUO0VBRUEsTUFBTSxRQUFRO0lBQ1osV0FBVyxLQUFLO0lBQ2hCLE9BQU87RUFDVDtFQUVBLFVBQVUsTUFBTSxHQUFHLFdBQVcsTUFBTTtFQUNwQyxVQUFVLEtBQUssR0FBRztFQUVsQixPQUFPO0FBQ1QifQ==
// denoCacheMetadata=1195996383962950384,2509362641127351995