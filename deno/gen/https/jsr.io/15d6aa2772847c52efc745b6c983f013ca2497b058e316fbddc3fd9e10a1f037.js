import { lowerFirst as lowerFirstToolkit } from '../../string/lowerFirst.ts';
import { toString } from '../util/toString.ts';
/**
 * Converts the first character of string to lower case.
 *
 * @param {string} str - The string that is to be changed
 * @returns {string} - The converted string.
 *
 * @example
 * const convertedStr1 = lowerCase('fred') // returns 'fred'
 * const convertedStr2 = lowerCase('Fred') // returns 'fred'
 * const convertedStr3 = lowerCase('FRED') // returns 'fRED'
 */ export function lowerFirst(str) {
  return lowerFirstToolkit(toString(str));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvc3RyaW5nL2xvd2VyRmlyc3QudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgbG93ZXJGaXJzdCBhcyBsb3dlckZpcnN0VG9vbGtpdCB9IGZyb20gJy4uLy4uL3N0cmluZy9sb3dlckZpcnN0LnRzJztcbmltcG9ydCB7IHRvU3RyaW5nIH0gZnJvbSAnLi4vdXRpbC90b1N0cmluZy50cyc7XG5cbi8qKlxuICogQ29udmVydHMgdGhlIGZpcnN0IGNoYXJhY3RlciBvZiBzdHJpbmcgdG8gbG93ZXIgY2FzZS5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gc3RyIC0gVGhlIHN0cmluZyB0aGF0IGlzIHRvIGJlIGNoYW5nZWRcbiAqIEByZXR1cm5zIHtzdHJpbmd9IC0gVGhlIGNvbnZlcnRlZCBzdHJpbmcuXG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IGNvbnZlcnRlZFN0cjEgPSBsb3dlckNhc2UoJ2ZyZWQnKSAvLyByZXR1cm5zICdmcmVkJ1xuICogY29uc3QgY29udmVydGVkU3RyMiA9IGxvd2VyQ2FzZSgnRnJlZCcpIC8vIHJldHVybnMgJ2ZyZWQnXG4gKiBjb25zdCBjb252ZXJ0ZWRTdHIzID0gbG93ZXJDYXNlKCdGUkVEJykgLy8gcmV0dXJucyAnZlJFRCdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGxvd2VyRmlyc3Qoc3RyPzogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGxvd2VyRmlyc3RUb29sa2l0KHRvU3RyaW5nKHN0cikpO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsY0FBYyxpQkFBaUIsUUFBUSw2QkFBNkI7QUFDN0UsU0FBUyxRQUFRLFFBQVEsc0JBQXNCO0FBRS9DOzs7Ozs7Ozs7O0NBVUMsR0FDRCxPQUFPLFNBQVMsV0FBVyxHQUFZO0VBQ3JDLE9BQU8sa0JBQWtCLFNBQVM7QUFDcEMifQ==
// denoCacheMetadata=9201514092497911859,5993838940437165616