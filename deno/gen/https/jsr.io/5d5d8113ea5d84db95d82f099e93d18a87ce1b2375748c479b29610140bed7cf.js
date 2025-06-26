import { isObjectLike } from './isObjectLike.ts';
import { isPlainObject } from './isPlainObject.ts';
/**
 * Checks if `value` is likely a DOM element.
 *
 * @param {any} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a DOM element, else `false`.
 *
 * @example
 * console.log(isElement(document.body)); // true
 * console.log(isElement('<body>')); // false
 */ export function isElement(value) {
  return isObjectLike(value) && value.nodeType === 1 && !isPlainObject(value);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvcHJlZGljYXRlL2lzRWxlbWVudC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBpc09iamVjdExpa2UgfSBmcm9tICcuL2lzT2JqZWN0TGlrZS50cyc7XG5pbXBvcnQgeyBpc1BsYWluT2JqZWN0IH0gZnJvbSAnLi9pc1BsYWluT2JqZWN0LnRzJztcblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBsaWtlbHkgYSBET00gZWxlbWVudC5cbiAqXG4gKiBAcGFyYW0ge2FueX0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYSBET00gZWxlbWVudCwgZWxzZSBgZmFsc2VgLlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zb2xlLmxvZyhpc0VsZW1lbnQoZG9jdW1lbnQuYm9keSkpOyAvLyB0cnVlXG4gKiBjb25zb2xlLmxvZyhpc0VsZW1lbnQoJzxib2R5PicpKTsgLy8gZmFsc2VcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzRWxlbWVudCh2YWx1ZT86IGFueSk6IGJvb2xlYW4ge1xuICByZXR1cm4gaXNPYmplY3RMaWtlKHZhbHVlKSAmJiAodmFsdWUgYXMgYW55KS5ub2RlVHlwZSA9PT0gMSAmJiAhaXNQbGFpbk9iamVjdCh2YWx1ZSk7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxZQUFZLFFBQVEsb0JBQW9CO0FBQ2pELFNBQVMsYUFBYSxRQUFRLHFCQUFxQjtBQUVuRDs7Ozs7Ozs7O0NBU0MsR0FDRCxPQUFPLFNBQVMsVUFBVSxLQUFXO0VBQ25DLE9BQU8sYUFBYSxVQUFVLEFBQUMsTUFBYyxRQUFRLEtBQUssS0FBSyxDQUFDLGNBQWM7QUFDaEYifQ==
// denoCacheMetadata=17230577992835532196,3626407825414630928