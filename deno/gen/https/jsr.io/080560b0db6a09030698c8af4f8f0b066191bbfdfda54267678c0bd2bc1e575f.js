/**
 * Options for the windowed function.
 *
 * @interface WindowedOptions
 * @property {boolean} [partialWindows=false] - Whether to include partial windows at the end of the array.
 */ /**
 * Creates an array of sub-arrays (windows) from the input array, each of the specified size.
 * The windows can overlap depending on the step size provided.
 *
 * By default, only full windows are included in the result, and any leftover elements that can't form a full window are ignored.
 *
 * If the `partialWindows` option is set to true in the options object, the function will also include partial windows at the end of the result.
 * Partial windows are smaller sub-arrays created when there aren't enough elements left in the input array to form a full window.
 *
 * @template T
 * @param {readonly T[]} arr - The input array to create windows from.
 * @param {number} size - The size of each window. Must be a positive integer.
 * @param {number} [step=1] - The step size between the start of each window. Must be a positive integer.
 * @param {WindowedOptions} [options={}] - Options object to configure the behavior of the function.
 * @param {boolean} [options.partialWindows=false] - Whether to include partial windows at the end of the array.
 * @returns {T[][]} An array of windows (sub-arrays) created from the input array.
 * @throws {Error} If the size or step is not a positive integer.
 *
 * @example
 * windowed([1, 2, 3, 4], 2);
 * // => [[1, 2], [2, 3], [3, 4]]
 *
 * @example
 * windowed([1, 2, 3, 4, 5, 6], 3, 2);
 * // => [[1, 2, 3], [3, 4, 5]]
 *
 * @example
 * windowed([1, 2, 3, 4, 5, 6], 3, 2, { partialWindows: true });
 * // => [[1, 2, 3], [3, 4, 5], [5, 6]]
 */ export function windowed(arr, size, step = 1, { partialWindows = false } = {}) {
  if (size <= 0 || !Number.isInteger(size)) {
    throw new Error('Size must be a positive integer.');
  }
  if (step <= 0 || !Number.isInteger(step)) {
    throw new Error('Step must be a positive integer.');
  }
  const result = [];
  const end = partialWindows ? arr.length : arr.length - size + 1;
  for(let i = 0; i < end; i += step){
    result.push(arr.slice(i, i + size));
  }
  return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9hcnJheS93aW5kb3dlZC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIE9wdGlvbnMgZm9yIHRoZSB3aW5kb3dlZCBmdW5jdGlvbi5cbiAqXG4gKiBAaW50ZXJmYWNlIFdpbmRvd2VkT3B0aW9uc1xuICogQHByb3BlcnR5IHtib29sZWFufSBbcGFydGlhbFdpbmRvd3M9ZmFsc2VdIC0gV2hldGhlciB0byBpbmNsdWRlIHBhcnRpYWwgd2luZG93cyBhdCB0aGUgZW5kIG9mIHRoZSBhcnJheS5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBXaW5kb3dlZE9wdGlvbnMge1xuICAvKipcbiAgICogV2hldGhlciB0byBpbmNsdWRlIHBhcnRpYWwgd2luZG93cyBhdCB0aGUgZW5kIG9mIHRoZSBhcnJheS5cbiAgICpcbiAgICogQnkgZGVmYXVsdCwgYHdpbmRvd2VkYCBvbmx5IGluY2x1ZGVzIGZ1bGwgd2luZG93cyBpbiB0aGUgcmVzdWx0LFxuICAgKiBpZ25vcmluZyBhbnkgbGVmdG92ZXIgZWxlbWVudHMgdGhhdCBjYW4ndCBmb3JtIGEgZnVsbCB3aW5kb3cuXG4gICAqXG4gICAqIElmIGBwYXJ0aWFsV2luZG93c2AgaXMgdHJ1ZSwgdGhlIGZ1bmN0aW9uIHdpbGwgYWxzbyBpbmNsdWRlIHRoZXNlIHNtYWxsZXIsIHBhcnRpYWwgd2luZG93cyBhdCB0aGUgZW5kIG9mIHRoZSByZXN1bHQuXG4gICAqL1xuICBwYXJ0aWFsV2luZG93cz86IGJvb2xlYW47XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhbiBhcnJheSBvZiBzdWItYXJyYXlzICh3aW5kb3dzKSBmcm9tIHRoZSBpbnB1dCBhcnJheSwgZWFjaCBvZiB0aGUgc3BlY2lmaWVkIHNpemUuXG4gKiBUaGUgd2luZG93cyBjYW4gb3ZlcmxhcCBkZXBlbmRpbmcgb24gdGhlIHN0ZXAgc2l6ZSBwcm92aWRlZC5cbiAqXG4gKiBCeSBkZWZhdWx0LCBvbmx5IGZ1bGwgd2luZG93cyBhcmUgaW5jbHVkZWQgaW4gdGhlIHJlc3VsdCwgYW5kIGFueSBsZWZ0b3ZlciBlbGVtZW50cyB0aGF0IGNhbid0IGZvcm0gYSBmdWxsIHdpbmRvdyBhcmUgaWdub3JlZC5cbiAqXG4gKiBJZiB0aGUgYHBhcnRpYWxXaW5kb3dzYCBvcHRpb24gaXMgc2V0IHRvIHRydWUgaW4gdGhlIG9wdGlvbnMgb2JqZWN0LCB0aGUgZnVuY3Rpb24gd2lsbCBhbHNvIGluY2x1ZGUgcGFydGlhbCB3aW5kb3dzIGF0IHRoZSBlbmQgb2YgdGhlIHJlc3VsdC5cbiAqIFBhcnRpYWwgd2luZG93cyBhcmUgc21hbGxlciBzdWItYXJyYXlzIGNyZWF0ZWQgd2hlbiB0aGVyZSBhcmVuJ3QgZW5vdWdoIGVsZW1lbnRzIGxlZnQgaW4gdGhlIGlucHV0IGFycmF5IHRvIGZvcm0gYSBmdWxsIHdpbmRvdy5cbiAqXG4gKiBAdGVtcGxhdGUgVFxuICogQHBhcmFtIHtyZWFkb25seSBUW119IGFyciAtIFRoZSBpbnB1dCBhcnJheSB0byBjcmVhdGUgd2luZG93cyBmcm9tLlxuICogQHBhcmFtIHtudW1iZXJ9IHNpemUgLSBUaGUgc2l6ZSBvZiBlYWNoIHdpbmRvdy4gTXVzdCBiZSBhIHBvc2l0aXZlIGludGVnZXIuXG4gKiBAcGFyYW0ge251bWJlcn0gW3N0ZXA9MV0gLSBUaGUgc3RlcCBzaXplIGJldHdlZW4gdGhlIHN0YXJ0IG9mIGVhY2ggd2luZG93LiBNdXN0IGJlIGEgcG9zaXRpdmUgaW50ZWdlci5cbiAqIEBwYXJhbSB7V2luZG93ZWRPcHRpb25zfSBbb3B0aW9ucz17fV0gLSBPcHRpb25zIG9iamVjdCB0byBjb25maWd1cmUgdGhlIGJlaGF2aW9yIG9mIHRoZSBmdW5jdGlvbi5cbiAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMucGFydGlhbFdpbmRvd3M9ZmFsc2VdIC0gV2hldGhlciB0byBpbmNsdWRlIHBhcnRpYWwgd2luZG93cyBhdCB0aGUgZW5kIG9mIHRoZSBhcnJheS5cbiAqIEByZXR1cm5zIHtUW11bXX0gQW4gYXJyYXkgb2Ygd2luZG93cyAoc3ViLWFycmF5cykgY3JlYXRlZCBmcm9tIHRoZSBpbnB1dCBhcnJheS5cbiAqIEB0aHJvd3Mge0Vycm9yfSBJZiB0aGUgc2l6ZSBvciBzdGVwIGlzIG5vdCBhIHBvc2l0aXZlIGludGVnZXIuXG4gKlxuICogQGV4YW1wbGVcbiAqIHdpbmRvd2VkKFsxLCAyLCAzLCA0XSwgMik7XG4gKiAvLyA9PiBbWzEsIDJdLCBbMiwgM10sIFszLCA0XV1cbiAqXG4gKiBAZXhhbXBsZVxuICogd2luZG93ZWQoWzEsIDIsIDMsIDQsIDUsIDZdLCAzLCAyKTtcbiAqIC8vID0+IFtbMSwgMiwgM10sIFszLCA0LCA1XV1cbiAqXG4gKiBAZXhhbXBsZVxuICogd2luZG93ZWQoWzEsIDIsIDMsIDQsIDUsIDZdLCAzLCAyLCB7IHBhcnRpYWxXaW5kb3dzOiB0cnVlIH0pO1xuICogLy8gPT4gW1sxLCAyLCAzXSwgWzMsIDQsIDVdLCBbNSwgNl1dXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB3aW5kb3dlZDxUPihcbiAgYXJyOiByZWFkb25seSBUW10sXG4gIHNpemU6IG51bWJlcixcbiAgc3RlcDogbnVtYmVyID0gMSxcbiAgeyBwYXJ0aWFsV2luZG93cyA9IGZhbHNlIH06IFdpbmRvd2VkT3B0aW9ucyA9IHt9XG4pOiBUW11bXSB7XG4gIGlmIChzaXplIDw9IDAgfHwgIU51bWJlci5pc0ludGVnZXIoc2l6ZSkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1NpemUgbXVzdCBiZSBhIHBvc2l0aXZlIGludGVnZXIuJyk7XG4gIH1cblxuICBpZiAoc3RlcCA8PSAwIHx8ICFOdW1iZXIuaXNJbnRlZ2VyKHN0ZXApKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdTdGVwIG11c3QgYmUgYSBwb3NpdGl2ZSBpbnRlZ2VyLicpO1xuICB9XG5cbiAgY29uc3QgcmVzdWx0OiBUW11bXSA9IFtdO1xuICBjb25zdCBlbmQgPSBwYXJ0aWFsV2luZG93cyA/IGFyci5sZW5ndGggOiBhcnIubGVuZ3RoIC0gc2l6ZSArIDE7XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBlbmQ7IGkgKz0gc3RlcCkge1xuICAgIHJlc3VsdC5wdXNoKGFyci5zbGljZShpLCBpICsgc2l6ZSkpO1xuICB9XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Q0FLQyxHQWFEOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQTZCQyxHQUNELE9BQU8sU0FBUyxTQUNkLEdBQWlCLEVBQ2pCLElBQVksRUFDWixPQUFlLENBQUMsRUFDaEIsRUFBRSxpQkFBaUIsS0FBSyxFQUFtQixHQUFHLENBQUMsQ0FBQztFQUVoRCxJQUFJLFFBQVEsS0FBSyxDQUFDLE9BQU8sU0FBUyxDQUFDLE9BQU87SUFDeEMsTUFBTSxJQUFJLE1BQU07RUFDbEI7RUFFQSxJQUFJLFFBQVEsS0FBSyxDQUFDLE9BQU8sU0FBUyxDQUFDLE9BQU87SUFDeEMsTUFBTSxJQUFJLE1BQU07RUFDbEI7RUFFQSxNQUFNLFNBQWdCLEVBQUU7RUFDeEIsTUFBTSxNQUFNLGlCQUFpQixJQUFJLE1BQU0sR0FBRyxJQUFJLE1BQU0sR0FBRyxPQUFPO0VBRTlELElBQUssSUFBSSxJQUFJLEdBQUcsSUFBSSxLQUFLLEtBQUssS0FBTTtJQUNsQyxPQUFPLElBQUksQ0FBQyxJQUFJLEtBQUssQ0FBQyxHQUFHLElBQUk7RUFDL0I7RUFFQSxPQUFPO0FBQ1QifQ==
// denoCacheMetadata=15215796781912444523,12122692838431636271