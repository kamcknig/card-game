import { words as getWords } from './words.ts';
/**
 * Converts a string to upper case.
 *
 * Upper case is the naming convention in which each word is written in uppercase and separated by an space ( ) character.
 *
 * @param {string} str - The string that is to be changed to upper case.
 * @returns {string} - The converted string to upper case.
 *
 * @example
 * const convertedStr1 = upperCase('camelCase') // returns 'CAMEL CASE'
 * const convertedStr2 = upperCase('some whitespace') // returns 'SOME WHITESPACE'
 * const convertedStr3 = upperCase('hyphen-text') // returns 'HYPHEN TEXT'
 * const convertedStr4 = upperCase('HTTPRequest') // returns 'HTTP REQUEST'
 */ export function upperCase(str) {
  const words = getWords(str);
  let result = '';
  for(let i = 0; i < words.length; i++){
    result += words[i].toUpperCase();
    if (i < words.length - 1) {
      result += ' ';
    }
  }
  return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9zdHJpbmcvdXBwZXJDYXNlLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHdvcmRzIGFzIGdldFdvcmRzIH0gZnJvbSAnLi93b3Jkcy50cyc7XG5cbi8qKlxuICogQ29udmVydHMgYSBzdHJpbmcgdG8gdXBwZXIgY2FzZS5cbiAqXG4gKiBVcHBlciBjYXNlIGlzIHRoZSBuYW1pbmcgY29udmVudGlvbiBpbiB3aGljaCBlYWNoIHdvcmQgaXMgd3JpdHRlbiBpbiB1cHBlcmNhc2UgYW5kIHNlcGFyYXRlZCBieSBhbiBzcGFjZSAoICkgY2hhcmFjdGVyLlxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSBzdHIgLSBUaGUgc3RyaW5nIHRoYXQgaXMgdG8gYmUgY2hhbmdlZCB0byB1cHBlciBjYXNlLlxuICogQHJldHVybnMge3N0cmluZ30gLSBUaGUgY29udmVydGVkIHN0cmluZyB0byB1cHBlciBjYXNlLlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCBjb252ZXJ0ZWRTdHIxID0gdXBwZXJDYXNlKCdjYW1lbENhc2UnKSAvLyByZXR1cm5zICdDQU1FTCBDQVNFJ1xuICogY29uc3QgY29udmVydGVkU3RyMiA9IHVwcGVyQ2FzZSgnc29tZSB3aGl0ZXNwYWNlJykgLy8gcmV0dXJucyAnU09NRSBXSElURVNQQUNFJ1xuICogY29uc3QgY29udmVydGVkU3RyMyA9IHVwcGVyQ2FzZSgnaHlwaGVuLXRleHQnKSAvLyByZXR1cm5zICdIWVBIRU4gVEVYVCdcbiAqIGNvbnN0IGNvbnZlcnRlZFN0cjQgPSB1cHBlckNhc2UoJ0hUVFBSZXF1ZXN0JykgLy8gcmV0dXJucyAnSFRUUCBSRVFVRVNUJ1xuICovXG5leHBvcnQgZnVuY3Rpb24gdXBwZXJDYXNlKHN0cjogc3RyaW5nKTogc3RyaW5nIHtcbiAgY29uc3Qgd29yZHMgPSBnZXRXb3JkcyhzdHIpO1xuXG4gIGxldCByZXN1bHQgPSAnJztcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IHdvcmRzLmxlbmd0aDsgaSsrKSB7XG4gICAgcmVzdWx0ICs9IHdvcmRzW2ldLnRvVXBwZXJDYXNlKCk7XG4gICAgaWYgKGkgPCB3b3Jkcy5sZW5ndGggLSAxKSB7XG4gICAgICByZXN1bHQgKz0gJyAnO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiByZXN1bHQ7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxTQUFTLFFBQVEsUUFBUSxhQUFhO0FBRS9DOzs7Ozs7Ozs7Ozs7O0NBYUMsR0FDRCxPQUFPLFNBQVMsVUFBVSxHQUFXO0VBQ25DLE1BQU0sUUFBUSxTQUFTO0VBRXZCLElBQUksU0FBUztFQUViLElBQUssSUFBSSxJQUFJLEdBQUcsSUFBSSxNQUFNLE1BQU0sRUFBRSxJQUFLO0lBQ3JDLFVBQVUsS0FBSyxDQUFDLEVBQUUsQ0FBQyxXQUFXO0lBQzlCLElBQUksSUFBSSxNQUFNLE1BQU0sR0FBRyxHQUFHO01BQ3hCLFVBQVU7SUFDWjtFQUNGO0VBRUEsT0FBTztBQUNUIn0=
// denoCacheMetadata=16434930271089867608,5972425553645297719