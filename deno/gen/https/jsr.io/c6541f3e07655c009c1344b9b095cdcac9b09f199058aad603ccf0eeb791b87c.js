/**
 * Splits an array into smaller arrays of a specified length.
 *
 * This function takes an input array and divides it into multiple smaller arrays,
 * each of a specified length. If the input array cannot be evenly divided,
 * the final sub-array will contain the remaining elements.
 *
 * @template T The type of elements in the array.
 * @param {T[]} arr - The array to be chunked into smaller arrays.
 * @param {number} size - The size of each smaller array. Must be a positive integer.
 * @returns {T[][]} A two-dimensional array where each sub-array has a maximum length of `size`.
 * @throws {Error} Throws an error if `size` is not a positive integer.
 *
 * @example
 * // Splits an array of numbers into sub-arrays of length 2
 * chunk([1, 2, 3, 4, 5], 2);
 * // Returns: [[1, 2], [3, 4], [5]]
 *
 * @example
 * // Splits an array of strings into sub-arrays of length 3
 * chunk(['a', 'b', 'c', 'd', 'e', 'f', 'g'], 3);
 * // Returns: [['a', 'b', 'c'], ['d', 'e', 'f'], ['g']]
 */ export function chunk(arr, size) {
  if (!Number.isInteger(size) || size <= 0) {
    throw new Error('Size must be an integer greater than zero.');
  }
  const chunkLength = Math.ceil(arr.length / size);
  const result = Array(chunkLength);
  for(let index = 0; index < chunkLength; index++){
    const start = index * size;
    const end = start + size;
    result[index] = arr.slice(start, end);
  }
  return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9hcnJheS9jaHVuay50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFNwbGl0cyBhbiBhcnJheSBpbnRvIHNtYWxsZXIgYXJyYXlzIG9mIGEgc3BlY2lmaWVkIGxlbmd0aC5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIHRha2VzIGFuIGlucHV0IGFycmF5IGFuZCBkaXZpZGVzIGl0IGludG8gbXVsdGlwbGUgc21hbGxlciBhcnJheXMsXG4gKiBlYWNoIG9mIGEgc3BlY2lmaWVkIGxlbmd0aC4gSWYgdGhlIGlucHV0IGFycmF5IGNhbm5vdCBiZSBldmVubHkgZGl2aWRlZCxcbiAqIHRoZSBmaW5hbCBzdWItYXJyYXkgd2lsbCBjb250YWluIHRoZSByZW1haW5pbmcgZWxlbWVudHMuXG4gKlxuICogQHRlbXBsYXRlIFQgVGhlIHR5cGUgb2YgZWxlbWVudHMgaW4gdGhlIGFycmF5LlxuICogQHBhcmFtIHtUW119IGFyciAtIFRoZSBhcnJheSB0byBiZSBjaHVua2VkIGludG8gc21hbGxlciBhcnJheXMuXG4gKiBAcGFyYW0ge251bWJlcn0gc2l6ZSAtIFRoZSBzaXplIG9mIGVhY2ggc21hbGxlciBhcnJheS4gTXVzdCBiZSBhIHBvc2l0aXZlIGludGVnZXIuXG4gKiBAcmV0dXJucyB7VFtdW119IEEgdHdvLWRpbWVuc2lvbmFsIGFycmF5IHdoZXJlIGVhY2ggc3ViLWFycmF5IGhhcyBhIG1heGltdW0gbGVuZ3RoIG9mIGBzaXplYC5cbiAqIEB0aHJvd3Mge0Vycm9yfSBUaHJvd3MgYW4gZXJyb3IgaWYgYHNpemVgIGlzIG5vdCBhIHBvc2l0aXZlIGludGVnZXIuXG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIFNwbGl0cyBhbiBhcnJheSBvZiBudW1iZXJzIGludG8gc3ViLWFycmF5cyBvZiBsZW5ndGggMlxuICogY2h1bmsoWzEsIDIsIDMsIDQsIDVdLCAyKTtcbiAqIC8vIFJldHVybnM6IFtbMSwgMl0sIFszLCA0XSwgWzVdXVxuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBTcGxpdHMgYW4gYXJyYXkgb2Ygc3RyaW5ncyBpbnRvIHN1Yi1hcnJheXMgb2YgbGVuZ3RoIDNcbiAqIGNodW5rKFsnYScsICdiJywgJ2MnLCAnZCcsICdlJywgJ2YnLCAnZyddLCAzKTtcbiAqIC8vIFJldHVybnM6IFtbJ2EnLCAnYicsICdjJ10sIFsnZCcsICdlJywgJ2YnXSwgWydnJ11dXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjaHVuazxUPihhcnI6IHJlYWRvbmx5IFRbXSwgc2l6ZTogbnVtYmVyKTogVFtdW10ge1xuICBpZiAoIU51bWJlci5pc0ludGVnZXIoc2l6ZSkgfHwgc2l6ZSA8PSAwKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdTaXplIG11c3QgYmUgYW4gaW50ZWdlciBncmVhdGVyIHRoYW4gemVyby4nKTtcbiAgfVxuXG4gIGNvbnN0IGNodW5rTGVuZ3RoID0gTWF0aC5jZWlsKGFyci5sZW5ndGggLyBzaXplKTtcbiAgY29uc3QgcmVzdWx0OiBUW11bXSA9IEFycmF5KGNodW5rTGVuZ3RoKTtcblxuICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgY2h1bmtMZW5ndGg7IGluZGV4KyspIHtcbiAgICBjb25zdCBzdGFydCA9IGluZGV4ICogc2l6ZTtcbiAgICBjb25zdCBlbmQgPSBzdGFydCArIHNpemU7XG5cbiAgICByZXN1bHRbaW5kZXhdID0gYXJyLnNsaWNlKHN0YXJ0LCBlbmQpO1xuICB9XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQXNCQyxHQUNELE9BQU8sU0FBUyxNQUFTLEdBQWlCLEVBQUUsSUFBWTtFQUN0RCxJQUFJLENBQUMsT0FBTyxTQUFTLENBQUMsU0FBUyxRQUFRLEdBQUc7SUFDeEMsTUFBTSxJQUFJLE1BQU07RUFDbEI7RUFFQSxNQUFNLGNBQWMsS0FBSyxJQUFJLENBQUMsSUFBSSxNQUFNLEdBQUc7RUFDM0MsTUFBTSxTQUFnQixNQUFNO0VBRTVCLElBQUssSUFBSSxRQUFRLEdBQUcsUUFBUSxhQUFhLFFBQVM7SUFDaEQsTUFBTSxRQUFRLFFBQVE7SUFDdEIsTUFBTSxNQUFNLFFBQVE7SUFFcEIsTUFBTSxDQUFDLE1BQU0sR0FBRyxJQUFJLEtBQUssQ0FBQyxPQUFPO0VBQ25DO0VBRUEsT0FBTztBQUNUIn0=
// denoCacheMetadata=1153896450725314553,2524161667628880020