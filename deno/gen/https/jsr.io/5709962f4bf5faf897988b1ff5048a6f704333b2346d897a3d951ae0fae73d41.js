import { isLength } from '../../predicate/isLength.ts';
/**
 * Checks if `value` is array-like.
 *
 * @param {unknown} value The value to check.
 * @returns {value is ArrayLike<unknown>} Returns `true` if `value` is array-like, else `false`.
 *
 * @example
 * isArrayLike([1, 2, 3]); // true
 * isArrayLike('abc'); // true
 * isArrayLike({ 0: 'a', length: 1 }); // true
 * isArrayLike({}); // false
 * isArrayLike(null); // false
 * isArrayLike(undefined); // false
 */ export function isArrayLike(value) {
  return value != null && typeof value !== 'function' && isLength(value.length);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvcHJlZGljYXRlL2lzQXJyYXlMaWtlLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGlzTGVuZ3RoIH0gZnJvbSAnLi4vLi4vcHJlZGljYXRlL2lzTGVuZ3RoLnRzJztcblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhcnJheS1saWtlLlxuICpcbiAqIEBwYXJhbSB7dW5rbm93bn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge3ZhbHVlIGlzIEFycmF5TGlrZTx1bmtub3duPn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhcnJheS1saWtlLCBlbHNlIGBmYWxzZWAuXG4gKlxuICogQGV4YW1wbGVcbiAqIGlzQXJyYXlMaWtlKFsxLCAyLCAzXSk7IC8vIHRydWVcbiAqIGlzQXJyYXlMaWtlKCdhYmMnKTsgLy8gdHJ1ZVxuICogaXNBcnJheUxpa2UoeyAwOiAnYScsIGxlbmd0aDogMSB9KTsgLy8gdHJ1ZVxuICogaXNBcnJheUxpa2Uoe30pOyAvLyBmYWxzZVxuICogaXNBcnJheUxpa2UobnVsbCk7IC8vIGZhbHNlXG4gKiBpc0FycmF5TGlrZSh1bmRlZmluZWQpOyAvLyBmYWxzZVxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNBcnJheUxpa2UodmFsdWU/OiB1bmtub3duKTogdmFsdWUgaXMgQXJyYXlMaWtlPHVua25vd24+IHtcbiAgcmV0dXJuIHZhbHVlICE9IG51bGwgJiYgdHlwZW9mIHZhbHVlICE9PSAnZnVuY3Rpb24nICYmIGlzTGVuZ3RoKCh2YWx1ZSBhcyBBcnJheUxpa2U8dW5rbm93bj4pLmxlbmd0aCk7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxRQUFRLFFBQVEsOEJBQThCO0FBRXZEOzs7Ozs7Ozs7Ozs7O0NBYUMsR0FDRCxPQUFPLFNBQVMsWUFBWSxLQUFlO0VBQ3pDLE9BQU8sU0FBUyxRQUFRLE9BQU8sVUFBVSxjQUFjLFNBQVMsQUFBQyxNQUE2QixNQUFNO0FBQ3RHIn0=
// denoCacheMetadata=14664288153508691001,69539067491979000