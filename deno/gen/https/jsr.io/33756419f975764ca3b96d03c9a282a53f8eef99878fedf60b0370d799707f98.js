/**
 * Checks if `value` is a function.
 *
 * @param {unknown} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a function, else `false`.
 *
 * @example
 * isFunction(Array.prototype.slice); // true
 * isFunction(async function () {}); // true
 * isFunction(function* () {}); // true
 * isFunction(Proxy); // true
 * isFunction(Int8Array); // true
 */ export function isFunction(value) {
  return typeof value === 'function';
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9wcmVkaWNhdGUvaXNGdW5jdGlvbi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGEgZnVuY3Rpb24uXG4gKlxuICogQHBhcmFtIHt1bmtub3dufSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhIGZ1bmN0aW9uLCBlbHNlIGBmYWxzZWAuXG4gKlxuICogQGV4YW1wbGVcbiAqIGlzRnVuY3Rpb24oQXJyYXkucHJvdG90eXBlLnNsaWNlKTsgLy8gdHJ1ZVxuICogaXNGdW5jdGlvbihhc3luYyBmdW5jdGlvbiAoKSB7fSk7IC8vIHRydWVcbiAqIGlzRnVuY3Rpb24oZnVuY3Rpb24qICgpIHt9KTsgLy8gdHJ1ZVxuICogaXNGdW5jdGlvbihQcm94eSk7IC8vIHRydWVcbiAqIGlzRnVuY3Rpb24oSW50OEFycmF5KTsgLy8gdHJ1ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNGdW5jdGlvbih2YWx1ZTogdW5rbm93bik6IHZhbHVlIGlzICguLi5hcmdzOiB1bmtub3duW10pID0+IHVua25vd24ge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnZnVuY3Rpb24nO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7Q0FZQyxHQUNELE9BQU8sU0FBUyxXQUFXLEtBQWM7RUFDdkMsT0FBTyxPQUFPLFVBQVU7QUFDMUIifQ==
// denoCacheMetadata=3826109467910527310,6863933784535923671