/**
 * Removes leading whitespace or specified characters from a string.
 *
 * @param {string} str - The string from which leading characters will be trimmed.
 * @param {string | string[]} chars - The character(s) to remove from the start of the string.
 * @returns {string} - The resulting string after the specified leading character has been removed.
 *
 * @example
 * const trimmedStr1 = trimStart('---hello', '-') // returns 'hello'
 * const trimmedStr2 = trimStart('000123', '0') // returns '123'
 * const trimmedStr3 = trimStart('abcabcabc', 'a') // returns 'bcabcabc'
 * const trimmedStr4 = trimStart('xxxtrimmed', 'x') // returns 'trimmed'
 */ export function trimStart(str, chars) {
  if (chars === undefined) {
    return str.trimStart();
  }
  let startIndex = 0;
  switch(typeof chars){
    case 'string':
      {
        while(startIndex < str.length && str[startIndex] === chars){
          startIndex++;
        }
        break;
      }
    case 'object':
      {
        while(startIndex < str.length && chars.includes(str[startIndex])){
          startIndex++;
        }
      }
  }
  return str.substring(startIndex);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9zdHJpbmcvdHJpbVN0YXJ0LnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogUmVtb3ZlcyBsZWFkaW5nIHdoaXRlc3BhY2Ugb3Igc3BlY2lmaWVkIGNoYXJhY3RlcnMgZnJvbSBhIHN0cmluZy5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gc3RyIC0gVGhlIHN0cmluZyBmcm9tIHdoaWNoIGxlYWRpbmcgY2hhcmFjdGVycyB3aWxsIGJlIHRyaW1tZWQuXG4gKiBAcGFyYW0ge3N0cmluZyB8IHN0cmluZ1tdfSBjaGFycyAtIFRoZSBjaGFyYWN0ZXIocykgdG8gcmVtb3ZlIGZyb20gdGhlIHN0YXJ0IG9mIHRoZSBzdHJpbmcuXG4gKiBAcmV0dXJucyB7c3RyaW5nfSAtIFRoZSByZXN1bHRpbmcgc3RyaW5nIGFmdGVyIHRoZSBzcGVjaWZpZWQgbGVhZGluZyBjaGFyYWN0ZXIgaGFzIGJlZW4gcmVtb3ZlZC5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgdHJpbW1lZFN0cjEgPSB0cmltU3RhcnQoJy0tLWhlbGxvJywgJy0nKSAvLyByZXR1cm5zICdoZWxsbydcbiAqIGNvbnN0IHRyaW1tZWRTdHIyID0gdHJpbVN0YXJ0KCcwMDAxMjMnLCAnMCcpIC8vIHJldHVybnMgJzEyMydcbiAqIGNvbnN0IHRyaW1tZWRTdHIzID0gdHJpbVN0YXJ0KCdhYmNhYmNhYmMnLCAnYScpIC8vIHJldHVybnMgJ2JjYWJjYWJjJ1xuICogY29uc3QgdHJpbW1lZFN0cjQgPSB0cmltU3RhcnQoJ3h4eHRyaW1tZWQnLCAneCcpIC8vIHJldHVybnMgJ3RyaW1tZWQnXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0cmltU3RhcnQoc3RyOiBzdHJpbmcsIGNoYXJzPzogc3RyaW5nIHwgc3RyaW5nW10pOiBzdHJpbmcge1xuICBpZiAoY2hhcnMgPT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiBzdHIudHJpbVN0YXJ0KCk7XG4gIH1cbiAgbGV0IHN0YXJ0SW5kZXggPSAwO1xuXG4gIHN3aXRjaCAodHlwZW9mIGNoYXJzKSB7XG4gICAgY2FzZSAnc3RyaW5nJzoge1xuICAgICAgd2hpbGUgKHN0YXJ0SW5kZXggPCBzdHIubGVuZ3RoICYmIHN0cltzdGFydEluZGV4XSA9PT0gY2hhcnMpIHtcbiAgICAgICAgc3RhcnRJbmRleCsrO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGNhc2UgJ29iamVjdCc6IHtcbiAgICAgIHdoaWxlIChzdGFydEluZGV4IDwgc3RyLmxlbmd0aCAmJiBjaGFycy5pbmNsdWRlcyhzdHJbc3RhcnRJbmRleF0pKSB7XG4gICAgICAgIHN0YXJ0SW5kZXgrKztcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gc3RyLnN1YnN0cmluZyhzdGFydEluZGV4KTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7O0NBWUMsR0FDRCxPQUFPLFNBQVMsVUFBVSxHQUFXLEVBQUUsS0FBeUI7RUFDOUQsSUFBSSxVQUFVLFdBQVc7SUFDdkIsT0FBTyxJQUFJLFNBQVM7RUFDdEI7RUFDQSxJQUFJLGFBQWE7RUFFakIsT0FBUSxPQUFPO0lBQ2IsS0FBSztNQUFVO1FBQ2IsTUFBTyxhQUFhLElBQUksTUFBTSxJQUFJLEdBQUcsQ0FBQyxXQUFXLEtBQUssTUFBTztVQUMzRDtRQUNGO1FBQ0E7TUFDRjtJQUNBLEtBQUs7TUFBVTtRQUNiLE1BQU8sYUFBYSxJQUFJLE1BQU0sSUFBSSxNQUFNLFFBQVEsQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFHO1VBQ2pFO1FBQ0Y7TUFDRjtFQUNGO0VBRUEsT0FBTyxJQUFJLFNBQVMsQ0FBQztBQUN2QiJ9
// denoCacheMetadata=3423139094236194503,6526635910382788625