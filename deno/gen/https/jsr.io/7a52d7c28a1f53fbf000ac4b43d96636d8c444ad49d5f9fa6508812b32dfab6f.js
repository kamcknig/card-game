/**
 * Check whether a value is a symbol.
 *
 * This function can also serve as a type predicate in TypeScript, narrowing the type of the argument to `symbol`.
 *
 * @param {unknown} value The value to check.
 * @returns {value is symbol} Returns `true` if `value` is a symbol, else `false`.
 *
 * @example
 * import { isSymbol } from 'es-toolkit/predicate';
 *
 * isSymbol(Symbol('a')); // true
 * isSymbol(Symbol.for('a')); // true
 * isSymbol(Symbol.iterator); // true
 *
 * isSymbol(null); // false
 * isSymbol(undefined); // false
 * isSymbol('123'); // false
 * isSymbol(false); // false
 * isSymbol(123n); // false
 * isSymbol({}); // false
 * isSymbol([1, 2, 3]); // false
 */ export function isSymbol(value) {
  return typeof value === 'symbol';
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9wcmVkaWNhdGUvaXNTeW1ib2wudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBDaGVjayB3aGV0aGVyIGEgdmFsdWUgaXMgYSBzeW1ib2wuXG4gKlxuICogVGhpcyBmdW5jdGlvbiBjYW4gYWxzbyBzZXJ2ZSBhcyBhIHR5cGUgcHJlZGljYXRlIGluIFR5cGVTY3JpcHQsIG5hcnJvd2luZyB0aGUgdHlwZSBvZiB0aGUgYXJndW1lbnQgdG8gYHN5bWJvbGAuXG4gKlxuICogQHBhcmFtIHt1bmtub3dufSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7dmFsdWUgaXMgc3ltYm9sfSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGEgc3ltYm9sLCBlbHNlIGBmYWxzZWAuXG4gKlxuICogQGV4YW1wbGVcbiAqIGltcG9ydCB7IGlzU3ltYm9sIH0gZnJvbSAnZXMtdG9vbGtpdC9wcmVkaWNhdGUnO1xuICpcbiAqIGlzU3ltYm9sKFN5bWJvbCgnYScpKTsgLy8gdHJ1ZVxuICogaXNTeW1ib2woU3ltYm9sLmZvcignYScpKTsgLy8gdHJ1ZVxuICogaXNTeW1ib2woU3ltYm9sLml0ZXJhdG9yKTsgLy8gdHJ1ZVxuICpcbiAqIGlzU3ltYm9sKG51bGwpOyAvLyBmYWxzZVxuICogaXNTeW1ib2wodW5kZWZpbmVkKTsgLy8gZmFsc2VcbiAqIGlzU3ltYm9sKCcxMjMnKTsgLy8gZmFsc2VcbiAqIGlzU3ltYm9sKGZhbHNlKTsgLy8gZmFsc2VcbiAqIGlzU3ltYm9sKDEyM24pOyAvLyBmYWxzZVxuICogaXNTeW1ib2woe30pOyAvLyBmYWxzZVxuICogaXNTeW1ib2woWzEsIDIsIDNdKTsgLy8gZmFsc2VcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzU3ltYm9sKHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgc3ltYm9sIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ3N5bWJvbCc7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FzQkMsR0FDRCxPQUFPLFNBQVMsU0FBUyxLQUFjO0VBQ3JDLE9BQU8sT0FBTyxVQUFVO0FBQzFCIn0=
// denoCacheMetadata=15107908974025697053,11270712577890713550