import { words as getWords } from './words.ts';
/**
 * Converts a string to kebab case.
 *
 * Kebab case is the naming convention in which each word is written in lowercase and separated by a dash (-) character.
 *
 * @param {string} str - The string that is to be changed to kebab case.
 * @returns {string} - The converted string to kebab case.
 *
 * @example
 * const convertedStr1 = kebabCase('camelCase') // returns 'camel-case'
 * const convertedStr2 = kebabCase('some whitespace') // returns 'some-whitespace'
 * const convertedStr3 = kebabCase('hyphen-text') // returns 'hyphen-text'
 * const convertedStr4 = kebabCase('HTTPRequest') // returns 'http-request'
 */ export function kebabCase(str) {
  const words = getWords(str);
  return words.map((word)=>word.toLowerCase()).join('-');
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9zdHJpbmcva2ViYWJDYXNlLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHdvcmRzIGFzIGdldFdvcmRzIH0gZnJvbSAnLi93b3Jkcy50cyc7XG5cbi8qKlxuICogQ29udmVydHMgYSBzdHJpbmcgdG8ga2ViYWIgY2FzZS5cbiAqXG4gKiBLZWJhYiBjYXNlIGlzIHRoZSBuYW1pbmcgY29udmVudGlvbiBpbiB3aGljaCBlYWNoIHdvcmQgaXMgd3JpdHRlbiBpbiBsb3dlcmNhc2UgYW5kIHNlcGFyYXRlZCBieSBhIGRhc2ggKC0pIGNoYXJhY3Rlci5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gc3RyIC0gVGhlIHN0cmluZyB0aGF0IGlzIHRvIGJlIGNoYW5nZWQgdG8ga2ViYWIgY2FzZS5cbiAqIEByZXR1cm5zIHtzdHJpbmd9IC0gVGhlIGNvbnZlcnRlZCBzdHJpbmcgdG8ga2ViYWIgY2FzZS5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgY29udmVydGVkU3RyMSA9IGtlYmFiQ2FzZSgnY2FtZWxDYXNlJykgLy8gcmV0dXJucyAnY2FtZWwtY2FzZSdcbiAqIGNvbnN0IGNvbnZlcnRlZFN0cjIgPSBrZWJhYkNhc2UoJ3NvbWUgd2hpdGVzcGFjZScpIC8vIHJldHVybnMgJ3NvbWUtd2hpdGVzcGFjZSdcbiAqIGNvbnN0IGNvbnZlcnRlZFN0cjMgPSBrZWJhYkNhc2UoJ2h5cGhlbi10ZXh0JykgLy8gcmV0dXJucyAnaHlwaGVuLXRleHQnXG4gKiBjb25zdCBjb252ZXJ0ZWRTdHI0ID0ga2ViYWJDYXNlKCdIVFRQUmVxdWVzdCcpIC8vIHJldHVybnMgJ2h0dHAtcmVxdWVzdCdcbiAqL1xuXG5leHBvcnQgZnVuY3Rpb24ga2ViYWJDYXNlKHN0cjogc3RyaW5nKTogc3RyaW5nIHtcbiAgY29uc3Qgd29yZHMgPSBnZXRXb3JkcyhzdHIpO1xuICByZXR1cm4gd29yZHMubWFwKHdvcmQgPT4gd29yZC50b0xvd2VyQ2FzZSgpKS5qb2luKCctJyk7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxTQUFTLFFBQVEsUUFBUSxhQUFhO0FBRS9DOzs7Ozs7Ozs7Ozs7O0NBYUMsR0FFRCxPQUFPLFNBQVMsVUFBVSxHQUFXO0VBQ25DLE1BQU0sUUFBUSxTQUFTO0VBQ3ZCLE9BQU8sTUFBTSxHQUFHLENBQUMsQ0FBQSxPQUFRLEtBQUssV0FBVyxJQUFJLElBQUksQ0FBQztBQUNwRCJ9
// denoCacheMetadata=5629322404309037863,6967664091962769369