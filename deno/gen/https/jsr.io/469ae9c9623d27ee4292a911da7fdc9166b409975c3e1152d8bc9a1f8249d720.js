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
  return str.substring(0, 1).toLowerCase() + str.substring(1);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9zdHJpbmcvbG93ZXJGaXJzdC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIENvbnZlcnRzIHRoZSBmaXJzdCBjaGFyYWN0ZXIgb2Ygc3RyaW5nIHRvIGxvd2VyIGNhc2UuXG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IHN0ciAtIFRoZSBzdHJpbmcgdGhhdCBpcyB0byBiZSBjaGFuZ2VkXG4gKiBAcmV0dXJucyB7c3RyaW5nfSAtIFRoZSBjb252ZXJ0ZWQgc3RyaW5nLlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCBjb252ZXJ0ZWRTdHIxID0gbG93ZXJDYXNlKCdmcmVkJykgLy8gcmV0dXJucyAnZnJlZCdcbiAqIGNvbnN0IGNvbnZlcnRlZFN0cjIgPSBsb3dlckNhc2UoJ0ZyZWQnKSAvLyByZXR1cm5zICdmcmVkJ1xuICogY29uc3QgY29udmVydGVkU3RyMyA9IGxvd2VyQ2FzZSgnRlJFRCcpIC8vIHJldHVybnMgJ2ZSRUQnXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBsb3dlckZpcnN0KHN0cjogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIHN0ci5zdWJzdHJpbmcoMCwgMSkudG9Mb3dlckNhc2UoKSArIHN0ci5zdWJzdHJpbmcoMSk7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7Ozs7Q0FVQyxHQUNELE9BQU8sU0FBUyxXQUFXLEdBQVc7RUFDcEMsT0FBTyxJQUFJLFNBQVMsQ0FBQyxHQUFHLEdBQUcsV0FBVyxLQUFLLElBQUksU0FBUyxDQUFDO0FBQzNEIn0=
// denoCacheMetadata=2457773413214734753,5430405254610367868