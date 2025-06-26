/**
 * Removes trailing whitespace or specified characters from a string.
 *
 * @param {string} str - The string from which trailing characters will be trimmed.
 * @param {string | string[]} chars - The character(s) to remove from the end of the string.
 * @returns {string} - The resulting string after the specified trailing character has been removed.
 *
 * @example
 * const trimmedStr1 = trimEnd('hello---', '-') // returns 'hello'
 * const trimmedStr2 = trimEnd('123000', '0') // returns '123'
 * const trimmedStr3 = trimEnd('abcabcabc', 'c') // returns 'abcabcab'
 * const trimmedStr4 = trimEnd('trimmedxxx', 'x') // returns 'trimmed'
 */ export function trimEnd(str, chars) {
  if (chars === undefined) {
    return str.trimEnd();
  }
  let endIndex = str.length;
  switch(typeof chars){
    case 'string':
      {
        while(endIndex > 0 && str[endIndex - 1] === chars){
          endIndex--;
        }
        break;
      }
    case 'object':
      {
        while(endIndex > 0 && chars.includes(str[endIndex - 1])){
          endIndex--;
        }
      }
  }
  return str.substring(0, endIndex);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9zdHJpbmcvdHJpbUVuZC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFJlbW92ZXMgdHJhaWxpbmcgd2hpdGVzcGFjZSBvciBzcGVjaWZpZWQgY2hhcmFjdGVycyBmcm9tIGEgc3RyaW5nLlxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSBzdHIgLSBUaGUgc3RyaW5nIGZyb20gd2hpY2ggdHJhaWxpbmcgY2hhcmFjdGVycyB3aWxsIGJlIHRyaW1tZWQuXG4gKiBAcGFyYW0ge3N0cmluZyB8IHN0cmluZ1tdfSBjaGFycyAtIFRoZSBjaGFyYWN0ZXIocykgdG8gcmVtb3ZlIGZyb20gdGhlIGVuZCBvZiB0aGUgc3RyaW5nLlxuICogQHJldHVybnMge3N0cmluZ30gLSBUaGUgcmVzdWx0aW5nIHN0cmluZyBhZnRlciB0aGUgc3BlY2lmaWVkIHRyYWlsaW5nIGNoYXJhY3RlciBoYXMgYmVlbiByZW1vdmVkLlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCB0cmltbWVkU3RyMSA9IHRyaW1FbmQoJ2hlbGxvLS0tJywgJy0nKSAvLyByZXR1cm5zICdoZWxsbydcbiAqIGNvbnN0IHRyaW1tZWRTdHIyID0gdHJpbUVuZCgnMTIzMDAwJywgJzAnKSAvLyByZXR1cm5zICcxMjMnXG4gKiBjb25zdCB0cmltbWVkU3RyMyA9IHRyaW1FbmQoJ2FiY2FiY2FiYycsICdjJykgLy8gcmV0dXJucyAnYWJjYWJjYWInXG4gKiBjb25zdCB0cmltbWVkU3RyNCA9IHRyaW1FbmQoJ3RyaW1tZWR4eHgnLCAneCcpIC8vIHJldHVybnMgJ3RyaW1tZWQnXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0cmltRW5kKHN0cjogc3RyaW5nLCBjaGFycz86IHN0cmluZyB8IHN0cmluZ1tdKTogc3RyaW5nIHtcbiAgaWYgKGNoYXJzID09PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gc3RyLnRyaW1FbmQoKTtcbiAgfVxuXG4gIGxldCBlbmRJbmRleCA9IHN0ci5sZW5ndGg7XG5cbiAgc3dpdGNoICh0eXBlb2YgY2hhcnMpIHtcbiAgICBjYXNlICdzdHJpbmcnOiB7XG4gICAgICB3aGlsZSAoZW5kSW5kZXggPiAwICYmIHN0cltlbmRJbmRleCAtIDFdID09PSBjaGFycykge1xuICAgICAgICBlbmRJbmRleC0tO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGNhc2UgJ29iamVjdCc6IHtcbiAgICAgIHdoaWxlIChlbmRJbmRleCA+IDAgJiYgY2hhcnMuaW5jbHVkZXMoc3RyW2VuZEluZGV4IC0gMV0pKSB7XG4gICAgICAgIGVuZEluZGV4LS07XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHN0ci5zdWJzdHJpbmcoMCwgZW5kSW5kZXgpO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7Q0FZQyxHQUNELE9BQU8sU0FBUyxRQUFRLEdBQVcsRUFBRSxLQUF5QjtFQUM1RCxJQUFJLFVBQVUsV0FBVztJQUN2QixPQUFPLElBQUksT0FBTztFQUNwQjtFQUVBLElBQUksV0FBVyxJQUFJLE1BQU07RUFFekIsT0FBUSxPQUFPO0lBQ2IsS0FBSztNQUFVO1FBQ2IsTUFBTyxXQUFXLEtBQUssR0FBRyxDQUFDLFdBQVcsRUFBRSxLQUFLLE1BQU87VUFDbEQ7UUFDRjtRQUNBO01BQ0Y7SUFDQSxLQUFLO01BQVU7UUFDYixNQUFPLFdBQVcsS0FBSyxNQUFNLFFBQVEsQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFLEVBQUc7VUFDeEQ7UUFDRjtNQUNGO0VBQ0Y7RUFFQSxPQUFPLElBQUksU0FBUyxDQUFDLEdBQUc7QUFDMUIifQ==
// denoCacheMetadata=7579951835292793003,158736867550757934