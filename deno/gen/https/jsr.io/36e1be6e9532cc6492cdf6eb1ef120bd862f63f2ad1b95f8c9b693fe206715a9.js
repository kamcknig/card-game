/**
 * Gathers elements in the same position in an internal array
 * from a grouped array of elements and returns them as a new array.
 *
 * @template T - The type of elements in the nested array.
 * @param {Array<[...T]>} zipped - The nested array to unzip.
 * @returns {Unzip<T>} A new array of unzipped elements.
 *
 * @example
 * const zipped = [['a', true, 1],['b', false, 2]];
 * const result = unzip(zipped);
 * // result will be [['a', 'b'], [true, false], [1, 2]]
 */ export function unzip(zipped) {
  // For performance reasons, use this implementation instead of
  // const maxLen = Math.max(...zipped.map(arr => arr.length));
  let maxLen = 0;
  for(let i = 0; i < zipped.length; i++){
    if (zipped[i].length > maxLen) {
      maxLen = zipped[i].length;
    }
  }
  const result = new Array(maxLen);
  for(let i = 0; i < maxLen; i++){
    result[i] = new Array(zipped.length);
    for(let j = 0; j < zipped.length; j++){
      result[i][j] = zipped[j][i];
    }
  }
  return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9hcnJheS91bnppcC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEdhdGhlcnMgZWxlbWVudHMgaW4gdGhlIHNhbWUgcG9zaXRpb24gaW4gYW4gaW50ZXJuYWwgYXJyYXlcbiAqIGZyb20gYSBncm91cGVkIGFycmF5IG9mIGVsZW1lbnRzIGFuZCByZXR1cm5zIHRoZW0gYXMgYSBuZXcgYXJyYXkuXG4gKlxuICogQHRlbXBsYXRlIFQgLSBUaGUgdHlwZSBvZiBlbGVtZW50cyBpbiB0aGUgbmVzdGVkIGFycmF5LlxuICogQHBhcmFtIHtBcnJheTxbLi4uVF0+fSB6aXBwZWQgLSBUaGUgbmVzdGVkIGFycmF5IHRvIHVuemlwLlxuICogQHJldHVybnMge1VuemlwPFQ+fSBBIG5ldyBhcnJheSBvZiB1bnppcHBlZCBlbGVtZW50cy5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgemlwcGVkID0gW1snYScsIHRydWUsIDFdLFsnYicsIGZhbHNlLCAyXV07XG4gKiBjb25zdCByZXN1bHQgPSB1bnppcCh6aXBwZWQpO1xuICogLy8gcmVzdWx0IHdpbGwgYmUgW1snYScsICdiJ10sIFt0cnVlLCBmYWxzZV0sIFsxLCAyXV1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHVuemlwPFQgZXh0ZW5kcyB1bmtub3duW10+KHppcHBlZDogUmVhZG9ubHlBcnJheTxbLi4uVF0+KTogVW56aXA8VD4ge1xuICAvLyBGb3IgcGVyZm9ybWFuY2UgcmVhc29ucywgdXNlIHRoaXMgaW1wbGVtZW50YXRpb24gaW5zdGVhZCBvZlxuICAvLyBjb25zdCBtYXhMZW4gPSBNYXRoLm1heCguLi56aXBwZWQubWFwKGFyciA9PiBhcnIubGVuZ3RoKSk7XG4gIGxldCBtYXhMZW4gPSAwO1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgemlwcGVkLmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKHppcHBlZFtpXS5sZW5ndGggPiBtYXhMZW4pIHtcbiAgICAgIG1heExlbiA9IHppcHBlZFtpXS5sZW5ndGg7XG4gICAgfVxuICB9XG5cbiAgY29uc3QgcmVzdWx0ID0gbmV3IEFycmF5KG1heExlbikgYXMgVW56aXA8VD47XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBtYXhMZW47IGkrKykge1xuICAgIHJlc3VsdFtpXSA9IG5ldyBBcnJheSh6aXBwZWQubGVuZ3RoKTtcbiAgICBmb3IgKGxldCBqID0gMDsgaiA8IHppcHBlZC5sZW5ndGg7IGorKykge1xuICAgICAgcmVzdWx0W2ldW2pdID0gemlwcGVkW2pdW2ldO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiByZXN1bHQ7XG59XG5cbnR5cGUgVW56aXA8SyBleHRlbmRzIHVua25vd25bXT4gPSB7IFtJIGluIGtleW9mIEtdOiBBcnJheTxLW0ldPiB9O1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7Q0FZQyxHQUNELE9BQU8sU0FBUyxNQUEyQixNQUE2QjtFQUN0RSw4REFBOEQ7RUFDOUQsNkRBQTZEO0VBQzdELElBQUksU0FBUztFQUViLElBQUssSUFBSSxJQUFJLEdBQUcsSUFBSSxPQUFPLE1BQU0sRUFBRSxJQUFLO0lBQ3RDLElBQUksTUFBTSxDQUFDLEVBQUUsQ0FBQyxNQUFNLEdBQUcsUUFBUTtNQUM3QixTQUFTLE1BQU0sQ0FBQyxFQUFFLENBQUMsTUFBTTtJQUMzQjtFQUNGO0VBRUEsTUFBTSxTQUFTLElBQUksTUFBTTtFQUV6QixJQUFLLElBQUksSUFBSSxHQUFHLElBQUksUUFBUSxJQUFLO0lBQy9CLE1BQU0sQ0FBQyxFQUFFLEdBQUcsSUFBSSxNQUFNLE9BQU8sTUFBTTtJQUNuQyxJQUFLLElBQUksSUFBSSxHQUFHLElBQUksT0FBTyxNQUFNLEVBQUUsSUFBSztNQUN0QyxNQUFNLENBQUMsRUFBRSxDQUFDLEVBQUUsR0FBRyxNQUFNLENBQUMsRUFBRSxDQUFDLEVBQUU7SUFDN0I7RUFDRjtFQUVBLE9BQU87QUFDVCJ9
// denoCacheMetadata=6150993346983814367,10995755808642674710