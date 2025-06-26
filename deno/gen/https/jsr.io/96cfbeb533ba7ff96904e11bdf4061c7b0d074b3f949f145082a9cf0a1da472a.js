/**
 * Randomizes the order of elements in an array using the Fisher-Yates algorithm.
 *
 * This function takes an array and returns a new array with its elements shuffled in a random order.
 *
 * @template T - The type of elements in the array.
 * @param {T[]} arr - The array to shuffle.
 * @returns {T[]} A new array with its elements shuffled in random order.
 *
 * @example
 * const array = [1, 2, 3, 4, 5];
 * const shuffledArray = shuffle(array);
 * // shuffledArray will be a new array with elements of array in random order, e.g., [3, 1, 4, 5, 2]
 */ export function shuffle(arr) {
  const result = arr.slice();
  /**
   * https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle#The_modern_algorithm
   */ for(let i = result.length - 1; i >= 1; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [
      result[j],
      result[i]
    ];
  }
  return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9hcnJheS9zaHVmZmxlLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogUmFuZG9taXplcyB0aGUgb3JkZXIgb2YgZWxlbWVudHMgaW4gYW4gYXJyYXkgdXNpbmcgdGhlIEZpc2hlci1ZYXRlcyBhbGdvcml0aG0uXG4gKlxuICogVGhpcyBmdW5jdGlvbiB0YWtlcyBhbiBhcnJheSBhbmQgcmV0dXJucyBhIG5ldyBhcnJheSB3aXRoIGl0cyBlbGVtZW50cyBzaHVmZmxlZCBpbiBhIHJhbmRvbSBvcmRlci5cbiAqXG4gKiBAdGVtcGxhdGUgVCAtIFRoZSB0eXBlIG9mIGVsZW1lbnRzIGluIHRoZSBhcnJheS5cbiAqIEBwYXJhbSB7VFtdfSBhcnIgLSBUaGUgYXJyYXkgdG8gc2h1ZmZsZS5cbiAqIEByZXR1cm5zIHtUW119IEEgbmV3IGFycmF5IHdpdGggaXRzIGVsZW1lbnRzIHNodWZmbGVkIGluIHJhbmRvbSBvcmRlci5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgYXJyYXkgPSBbMSwgMiwgMywgNCwgNV07XG4gKiBjb25zdCBzaHVmZmxlZEFycmF5ID0gc2h1ZmZsZShhcnJheSk7XG4gKiAvLyBzaHVmZmxlZEFycmF5IHdpbGwgYmUgYSBuZXcgYXJyYXkgd2l0aCBlbGVtZW50cyBvZiBhcnJheSBpbiByYW5kb20gb3JkZXIsIGUuZy4sIFszLCAxLCA0LCA1LCAyXVxuICovXG5leHBvcnQgZnVuY3Rpb24gc2h1ZmZsZTxUPihhcnI6IHJlYWRvbmx5IFRbXSk6IFRbXSB7XG4gIGNvbnN0IHJlc3VsdCA9IGFyci5zbGljZSgpO1xuXG4gIC8qKlxuICAgKiBodHRwczovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9GaXNoZXIlRTIlODAlOTNZYXRlc19zaHVmZmxlI1RoZV9tb2Rlcm5fYWxnb3JpdGhtXG4gICAqL1xuICBmb3IgKGxldCBpID0gcmVzdWx0Lmxlbmd0aCAtIDE7IGkgPj0gMTsgaS0tKSB7XG4gICAgY29uc3QgaiA9IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIChpICsgMSkpO1xuICAgIFtyZXN1bHRbaV0sIHJlc3VsdFtqXV0gPSBbcmVzdWx0W2pdLCByZXN1bHRbaV1dO1xuICB9XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7OztDQWFDLEdBQ0QsT0FBTyxTQUFTLFFBQVcsR0FBaUI7RUFDMUMsTUFBTSxTQUFTLElBQUksS0FBSztFQUV4Qjs7R0FFQyxHQUNELElBQUssSUFBSSxJQUFJLE9BQU8sTUFBTSxHQUFHLEdBQUcsS0FBSyxHQUFHLElBQUs7SUFDM0MsTUFBTSxJQUFJLEtBQUssS0FBSyxDQUFDLEtBQUssTUFBTSxLQUFLLENBQUMsSUFBSSxDQUFDO0lBQzNDLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxNQUFNLENBQUMsRUFBRSxDQUFDLEdBQUc7TUFBQyxNQUFNLENBQUMsRUFBRTtNQUFFLE1BQU0sQ0FBQyxFQUFFO0tBQUM7RUFDakQ7RUFFQSxPQUFPO0FBQ1QifQ==
// denoCacheMetadata=13514438340117659026,2061056179195035047