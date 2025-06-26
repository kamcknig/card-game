import { words as getWords } from './words.ts';
/**
 * Converts a string to lower case.
 *
 * Lower case is the naming convention in which each word is written in lowercase and separated by an space ( ) character.
 *
 * @param {string} str - The string that is to be changed to lower case.
 * @returns {string} - The converted string to lower case.
 *
 * @example
 * const convertedStr1 = lowerCase('camelCase') // returns 'camel case'
 * const convertedStr2 = lowerCase('some whitespace') // returns 'some whitespace'
 * const convertedStr3 = lowerCase('hyphen-text') // returns 'hyphen text'
 * const convertedStr4 = lowerCase('HTTPRequest') // returns 'http request'
 */ export function lowerCase(str) {
  const words = getWords(str);
  return words.map((word)=>word.toLowerCase()).join(' ');
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9zdHJpbmcvbG93ZXJDYXNlLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHdvcmRzIGFzIGdldFdvcmRzIH0gZnJvbSAnLi93b3Jkcy50cyc7XG5cbi8qKlxuICogQ29udmVydHMgYSBzdHJpbmcgdG8gbG93ZXIgY2FzZS5cbiAqXG4gKiBMb3dlciBjYXNlIGlzIHRoZSBuYW1pbmcgY29udmVudGlvbiBpbiB3aGljaCBlYWNoIHdvcmQgaXMgd3JpdHRlbiBpbiBsb3dlcmNhc2UgYW5kIHNlcGFyYXRlZCBieSBhbiBzcGFjZSAoICkgY2hhcmFjdGVyLlxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSBzdHIgLSBUaGUgc3RyaW5nIHRoYXQgaXMgdG8gYmUgY2hhbmdlZCB0byBsb3dlciBjYXNlLlxuICogQHJldHVybnMge3N0cmluZ30gLSBUaGUgY29udmVydGVkIHN0cmluZyB0byBsb3dlciBjYXNlLlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCBjb252ZXJ0ZWRTdHIxID0gbG93ZXJDYXNlKCdjYW1lbENhc2UnKSAvLyByZXR1cm5zICdjYW1lbCBjYXNlJ1xuICogY29uc3QgY29udmVydGVkU3RyMiA9IGxvd2VyQ2FzZSgnc29tZSB3aGl0ZXNwYWNlJykgLy8gcmV0dXJucyAnc29tZSB3aGl0ZXNwYWNlJ1xuICogY29uc3QgY29udmVydGVkU3RyMyA9IGxvd2VyQ2FzZSgnaHlwaGVuLXRleHQnKSAvLyByZXR1cm5zICdoeXBoZW4gdGV4dCdcbiAqIGNvbnN0IGNvbnZlcnRlZFN0cjQgPSBsb3dlckNhc2UoJ0hUVFBSZXF1ZXN0JykgLy8gcmV0dXJucyAnaHR0cCByZXF1ZXN0J1xuICovXG5leHBvcnQgZnVuY3Rpb24gbG93ZXJDYXNlKHN0cjogc3RyaW5nKTogc3RyaW5nIHtcbiAgY29uc3Qgd29yZHMgPSBnZXRXb3JkcyhzdHIpO1xuICByZXR1cm4gd29yZHMubWFwKHdvcmQgPT4gd29yZC50b0xvd2VyQ2FzZSgpKS5qb2luKCcgJyk7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxTQUFTLFFBQVEsUUFBUSxhQUFhO0FBRS9DOzs7Ozs7Ozs7Ozs7O0NBYUMsR0FDRCxPQUFPLFNBQVMsVUFBVSxHQUFXO0VBQ25DLE1BQU0sUUFBUSxTQUFTO0VBQ3ZCLE9BQU8sTUFBTSxHQUFHLENBQUMsQ0FBQSxPQUFRLEtBQUssV0FBVyxJQUFJLElBQUksQ0FBQztBQUNwRCJ9
// denoCacheMetadata=9224337761213677296,9335599472381492943