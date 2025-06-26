import { upperFirst as upperFirstToolkit } from '../../string/upperFirst.ts';
import { toString } from '../util/toString.ts';
/**
 * Converts the first character of string to upper case.
 *
 * @param {string} str - The string that is to be changed
 * @returns {string} - The converted string.
 *
 * @example
 * const convertedStr1 = upperFirst('fred') // returns 'Fred'
 * const convertedStr2 = upperFirst('Fred') // returns 'Fred'
 * const convertedStr3 = upperFirst('FRED') // returns 'FRED'
 */ export function upperFirst(str) {
  return upperFirstToolkit(toString(str));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvc3RyaW5nL3VwcGVyRmlyc3QudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgdXBwZXJGaXJzdCBhcyB1cHBlckZpcnN0VG9vbGtpdCB9IGZyb20gJy4uLy4uL3N0cmluZy91cHBlckZpcnN0LnRzJztcbmltcG9ydCB7IHRvU3RyaW5nIH0gZnJvbSAnLi4vdXRpbC90b1N0cmluZy50cyc7XG5cbi8qKlxuICogQ29udmVydHMgdGhlIGZpcnN0IGNoYXJhY3RlciBvZiBzdHJpbmcgdG8gdXBwZXIgY2FzZS5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gc3RyIC0gVGhlIHN0cmluZyB0aGF0IGlzIHRvIGJlIGNoYW5nZWRcbiAqIEByZXR1cm5zIHtzdHJpbmd9IC0gVGhlIGNvbnZlcnRlZCBzdHJpbmcuXG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IGNvbnZlcnRlZFN0cjEgPSB1cHBlckZpcnN0KCdmcmVkJykgLy8gcmV0dXJucyAnRnJlZCdcbiAqIGNvbnN0IGNvbnZlcnRlZFN0cjIgPSB1cHBlckZpcnN0KCdGcmVkJykgLy8gcmV0dXJucyAnRnJlZCdcbiAqIGNvbnN0IGNvbnZlcnRlZFN0cjMgPSB1cHBlckZpcnN0KCdGUkVEJykgLy8gcmV0dXJucyAnRlJFRCdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHVwcGVyRmlyc3Qoc3RyPzogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIHVwcGVyRmlyc3RUb29sa2l0KHRvU3RyaW5nKHN0cikpO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsY0FBYyxpQkFBaUIsUUFBUSw2QkFBNkI7QUFDN0UsU0FBUyxRQUFRLFFBQVEsc0JBQXNCO0FBRS9DOzs7Ozs7Ozs7O0NBVUMsR0FDRCxPQUFPLFNBQVMsV0FBVyxHQUFZO0VBQ3JDLE9BQU8sa0JBQWtCLFNBQVM7QUFDcEMifQ==
// denoCacheMetadata=7264251516050591108,12363320771455717657