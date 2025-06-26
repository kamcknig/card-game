import { isSymbol } from '../predicate/isSymbol.ts';
/**  Matches any deep property path. (e.g. `a.b[0].c`)*/ const regexIsDeepProp = /\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/;
/**  Matches any word character (alphanumeric & underscore).*/ const regexIsPlainProp = /^\w*$/;
/**
 * Checks if `value` is a property name and not a property path. (It's ok that the `value` is not in the keys of the `object`)
 * @param {unknown} value The value to check.
 * @param {unknown} object The object to query.
 * @returns {boolean} Returns `true` if `value` is a property name, else `false`.
 *
 * @example
 * isKey('a', { a: 1 });
 * // => true
 *
 * isKey('a.b', { a: { b: 2 } });
 * // => false
 */ export function isKey(value, object) {
  if (Array.isArray(value)) {
    return false;
  }
  if (typeof value === 'number' || typeof value === 'boolean' || value == null || isSymbol(value)) {
    return true;
  }
  return typeof value === 'string' && (regexIsPlainProp.test(value) || !regexIsDeepProp.test(value)) || object != null && Object.hasOwn(object, value);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvX2ludGVybmFsL2lzS2V5LnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGlzU3ltYm9sIH0gZnJvbSAnLi4vcHJlZGljYXRlL2lzU3ltYm9sLnRzJztcblxuLyoqICBNYXRjaGVzIGFueSBkZWVwIHByb3BlcnR5IHBhdGguIChlLmcuIGBhLmJbMF0uY2ApKi9cbmNvbnN0IHJlZ2V4SXNEZWVwUHJvcCA9IC9cXC58XFxbKD86W15bXFxdXSp8KFtcIiddKSg/Oig/IVxcMSlbXlxcXFxdfFxcXFwuKSo/XFwxKVxcXS87XG4vKiogIE1hdGNoZXMgYW55IHdvcmQgY2hhcmFjdGVyIChhbHBoYW51bWVyaWMgJiB1bmRlcnNjb3JlKS4qL1xuY29uc3QgcmVnZXhJc1BsYWluUHJvcCA9IC9eXFx3KiQvO1xuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGEgcHJvcGVydHkgbmFtZSBhbmQgbm90IGEgcHJvcGVydHkgcGF0aC4gKEl0J3Mgb2sgdGhhdCB0aGUgYHZhbHVlYCBpcyBub3QgaW4gdGhlIGtleXMgb2YgdGhlIGBvYmplY3RgKVxuICogQHBhcmFtIHt1bmtub3dufSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcGFyYW0ge3Vua25vd259IG9iamVjdCBUaGUgb2JqZWN0IHRvIHF1ZXJ5LlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYSBwcm9wZXJ0eSBuYW1lLCBlbHNlIGBmYWxzZWAuXG4gKlxuICogQGV4YW1wbGVcbiAqIGlzS2V5KCdhJywgeyBhOiAxIH0pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIGlzS2V5KCdhLmInLCB7IGE6IHsgYjogMiB9IH0pO1xuICogLy8gPT4gZmFsc2VcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzS2V5KHZhbHVlPzogdW5rbm93biwgb2JqZWN0PzogdW5rbm93bik6IHZhbHVlIGlzIFByb3BlcnR5S2V5IHtcbiAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicgfHwgdHlwZW9mIHZhbHVlID09PSAnYm9vbGVhbicgfHwgdmFsdWUgPT0gbnVsbCB8fCBpc1N5bWJvbCh2YWx1ZSkpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIHJldHVybiAoXG4gICAgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycgJiYgKHJlZ2V4SXNQbGFpblByb3AudGVzdCh2YWx1ZSkgfHwgIXJlZ2V4SXNEZWVwUHJvcC50ZXN0KHZhbHVlKSkpIHx8XG4gICAgKG9iamVjdCAhPSBudWxsICYmIE9iamVjdC5oYXNPd24ob2JqZWN0LCB2YWx1ZSBhcyBQcm9wZXJ0eUtleSkpXG4gICk7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxRQUFRLFFBQVEsMkJBQTJCO0FBRXBELHNEQUFzRCxHQUN0RCxNQUFNLGtCQUFrQjtBQUN4Qiw0REFBNEQsR0FDNUQsTUFBTSxtQkFBbUI7QUFFekI7Ozs7Ozs7Ozs7OztDQVlDLEdBQ0QsT0FBTyxTQUFTLE1BQU0sS0FBZSxFQUFFLE1BQWdCO0VBQ3JELElBQUksTUFBTSxPQUFPLENBQUMsUUFBUTtJQUN4QixPQUFPO0VBQ1Q7RUFFQSxJQUFJLE9BQU8sVUFBVSxZQUFZLE9BQU8sVUFBVSxhQUFhLFNBQVMsUUFBUSxTQUFTLFFBQVE7SUFDL0YsT0FBTztFQUNUO0VBRUEsT0FDRSxBQUFDLE9BQU8sVUFBVSxZQUFZLENBQUMsaUJBQWlCLElBQUksQ0FBQyxVQUFVLENBQUMsZ0JBQWdCLElBQUksQ0FBQyxNQUFNLEtBQzFGLFVBQVUsUUFBUSxPQUFPLE1BQU0sQ0FBQyxRQUFRO0FBRTdDIn0=
// denoCacheMetadata=6802184452664303360,17754369267369778475