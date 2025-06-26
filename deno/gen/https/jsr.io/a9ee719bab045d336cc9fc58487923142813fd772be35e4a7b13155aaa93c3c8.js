import { capitalize } from './capitalize.ts';
import { words as getWords } from './words.ts';
/**
 * Converts a string to camel case.
 *
 * Camel case is the naming convention in which the first word is written in lowercase and
 * each subsequent word begins with a capital letter, concatenated without any separator characters.
 *
 * @param {string} str - The string that is to be changed to camel case.
 * @returns {string} - The converted string to camel case.
 *
 * @example
 * const convertedStr1 = camelCase('camelCase') // returns 'camelCase'
 * const convertedStr2 = camelCase('some whitespace') // returns 'someWhitespace'
 * const convertedStr3 = camelCase('hyphen-text') // returns 'hyphenText'
 * const convertedStr4 = camelCase('HTTPRequest') // returns 'httpRequest'
 * const convertedStr5 = camelCase('Keep unicode 😅') // returns 'keepUnicode😅'
 */ export function camelCase(str) {
  const words = getWords(str);
  if (words.length === 0) {
    return '';
  }
  const [first, ...rest] = words;
  return `${first.toLowerCase()}${rest.map((word)=>capitalize(word)).join('')}`;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9zdHJpbmcvY2FtZWxDYXNlLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGNhcGl0YWxpemUgfSBmcm9tICcuL2NhcGl0YWxpemUudHMnO1xuaW1wb3J0IHsgd29yZHMgYXMgZ2V0V29yZHMgfSBmcm9tICcuL3dvcmRzLnRzJztcblxuLyoqXG4gKiBDb252ZXJ0cyBhIHN0cmluZyB0byBjYW1lbCBjYXNlLlxuICpcbiAqIENhbWVsIGNhc2UgaXMgdGhlIG5hbWluZyBjb252ZW50aW9uIGluIHdoaWNoIHRoZSBmaXJzdCB3b3JkIGlzIHdyaXR0ZW4gaW4gbG93ZXJjYXNlIGFuZFxuICogZWFjaCBzdWJzZXF1ZW50IHdvcmQgYmVnaW5zIHdpdGggYSBjYXBpdGFsIGxldHRlciwgY29uY2F0ZW5hdGVkIHdpdGhvdXQgYW55IHNlcGFyYXRvciBjaGFyYWN0ZXJzLlxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSBzdHIgLSBUaGUgc3RyaW5nIHRoYXQgaXMgdG8gYmUgY2hhbmdlZCB0byBjYW1lbCBjYXNlLlxuICogQHJldHVybnMge3N0cmluZ30gLSBUaGUgY29udmVydGVkIHN0cmluZyB0byBjYW1lbCBjYXNlLlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCBjb252ZXJ0ZWRTdHIxID0gY2FtZWxDYXNlKCdjYW1lbENhc2UnKSAvLyByZXR1cm5zICdjYW1lbENhc2UnXG4gKiBjb25zdCBjb252ZXJ0ZWRTdHIyID0gY2FtZWxDYXNlKCdzb21lIHdoaXRlc3BhY2UnKSAvLyByZXR1cm5zICdzb21lV2hpdGVzcGFjZSdcbiAqIGNvbnN0IGNvbnZlcnRlZFN0cjMgPSBjYW1lbENhc2UoJ2h5cGhlbi10ZXh0JykgLy8gcmV0dXJucyAnaHlwaGVuVGV4dCdcbiAqIGNvbnN0IGNvbnZlcnRlZFN0cjQgPSBjYW1lbENhc2UoJ0hUVFBSZXF1ZXN0JykgLy8gcmV0dXJucyAnaHR0cFJlcXVlc3QnXG4gKiBjb25zdCBjb252ZXJ0ZWRTdHI1ID0gY2FtZWxDYXNlKCdLZWVwIHVuaWNvZGUg8J+YhScpIC8vIHJldHVybnMgJ2tlZXBVbmljb2Rl8J+YhSdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNhbWVsQ2FzZShzdHI6IHN0cmluZyk6IHN0cmluZyB7XG4gIGNvbnN0IHdvcmRzID0gZ2V0V29yZHMoc3RyKTtcblxuICBpZiAod29yZHMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuICcnO1xuICB9XG5cbiAgY29uc3QgW2ZpcnN0LCAuLi5yZXN0XSA9IHdvcmRzO1xuXG4gIHJldHVybiBgJHtmaXJzdC50b0xvd2VyQ2FzZSgpfSR7cmVzdC5tYXAod29yZCA9PiBjYXBpdGFsaXplKHdvcmQpKS5qb2luKCcnKX1gO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsVUFBVSxRQUFRLGtCQUFrQjtBQUM3QyxTQUFTLFNBQVMsUUFBUSxRQUFRLGFBQWE7QUFFL0M7Ozs7Ozs7Ozs7Ozs7OztDQWVDLEdBQ0QsT0FBTyxTQUFTLFVBQVUsR0FBVztFQUNuQyxNQUFNLFFBQVEsU0FBUztFQUV2QixJQUFJLE1BQU0sTUFBTSxLQUFLLEdBQUc7SUFDdEIsT0FBTztFQUNUO0VBRUEsTUFBTSxDQUFDLE9BQU8sR0FBRyxLQUFLLEdBQUc7RUFFekIsT0FBTyxHQUFHLE1BQU0sV0FBVyxLQUFLLEtBQUssR0FBRyxDQUFDLENBQUEsT0FBUSxXQUFXLE9BQU8sSUFBSSxDQUFDLEtBQUs7QUFDL0UifQ==
// denoCacheMetadata=589696335666991659,9435562197549998989