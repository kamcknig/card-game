import { isBlob } from './isBlob.ts';
/**
 * Checks if the given value is a File.
 *
 * This function tests whether the provided value is an instance of `File`.
 * It returns `true` if the value is an instance of `File`, and `false` otherwise.
 *
 * @param {unknown} x - The value to test if it is a File.
 * @returns {x is File} True if the value is a File, false otherwise.
 *
 * @example
 * const value1 = new File(["content"], "example.txt");
 * const value2 = {};
 * const value3 = new Blob(["content"], { type: "text/plain" });
 *
 * console.log(isFile(value1)); // true
 * console.log(isFile(value2)); // false
 * console.log(isFile(value3)); // false
 */ export function isFile(x) {
  // Return false if File is not supported in the environment
  if (typeof File === 'undefined') {
    return false;
  }
  return isBlob(x) && x instanceof File;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9wcmVkaWNhdGUvaXNGaWxlLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGlzQmxvYiB9IGZyb20gJy4vaXNCbG9iLnRzJztcblxuLyoqXG4gKiBDaGVja3MgaWYgdGhlIGdpdmVuIHZhbHVlIGlzIGEgRmlsZS5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIHRlc3RzIHdoZXRoZXIgdGhlIHByb3ZpZGVkIHZhbHVlIGlzIGFuIGluc3RhbmNlIG9mIGBGaWxlYC5cbiAqIEl0IHJldHVybnMgYHRydWVgIGlmIHRoZSB2YWx1ZSBpcyBhbiBpbnN0YW5jZSBvZiBgRmlsZWAsIGFuZCBgZmFsc2VgIG90aGVyd2lzZS5cbiAqXG4gKiBAcGFyYW0ge3Vua25vd259IHggLSBUaGUgdmFsdWUgdG8gdGVzdCBpZiBpdCBpcyBhIEZpbGUuXG4gKiBAcmV0dXJucyB7eCBpcyBGaWxlfSBUcnVlIGlmIHRoZSB2YWx1ZSBpcyBhIEZpbGUsIGZhbHNlIG90aGVyd2lzZS5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgdmFsdWUxID0gbmV3IEZpbGUoW1wiY29udGVudFwiXSwgXCJleGFtcGxlLnR4dFwiKTtcbiAqIGNvbnN0IHZhbHVlMiA9IHt9O1xuICogY29uc3QgdmFsdWUzID0gbmV3IEJsb2IoW1wiY29udGVudFwiXSwgeyB0eXBlOiBcInRleHQvcGxhaW5cIiB9KTtcbiAqXG4gKiBjb25zb2xlLmxvZyhpc0ZpbGUodmFsdWUxKSk7IC8vIHRydWVcbiAqIGNvbnNvbGUubG9nKGlzRmlsZSh2YWx1ZTIpKTsgLy8gZmFsc2VcbiAqIGNvbnNvbGUubG9nKGlzRmlsZSh2YWx1ZTMpKTsgLy8gZmFsc2VcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzRmlsZSh4OiB1bmtub3duKTogeCBpcyBGaWxlIHtcbiAgLy8gUmV0dXJuIGZhbHNlIGlmIEZpbGUgaXMgbm90IHN1cHBvcnRlZCBpbiB0aGUgZW52aXJvbm1lbnRcbiAgaWYgKHR5cGVvZiBGaWxlID09PSAndW5kZWZpbmVkJykge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHJldHVybiBpc0Jsb2IoeCkgJiYgeCBpbnN0YW5jZW9mIEZpbGU7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxNQUFNLFFBQVEsY0FBYztBQUVyQzs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FpQkMsR0FDRCxPQUFPLFNBQVMsT0FBTyxDQUFVO0VBQy9CLDJEQUEyRDtFQUMzRCxJQUFJLE9BQU8sU0FBUyxhQUFhO0lBQy9CLE9BQU87RUFDVDtFQUVBLE9BQU8sT0FBTyxNQUFNLGFBQWE7QUFDbkMifQ==
// denoCacheMetadata=16524105578036404246,602185454720111349