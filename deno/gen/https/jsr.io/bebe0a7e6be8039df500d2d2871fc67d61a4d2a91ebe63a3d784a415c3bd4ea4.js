import { isArrayLike } from './isArrayLike.ts';
import { isObjectLike } from './isObjectLike.ts';
/**
 * Checks if the given value is a non-primitive, array-like object.
 *
 * @param {unknown} value The value to check.
 * @returns {value is ArrayLike<unknown> & object} `true` if the value is a non-primitive, array-like object, `false` otherwise.
 *
 * @example
 * isArrayLikeObject([1, 2, 3]); // true
 * isArrayLikeObject({ 0: 'a', length: 1 }); // true
 * isArrayLikeObject('abc'); // false
 * isArrayLikeObject(()=>{}); // false
 */ export function isArrayLikeObject(value) {
  return isObjectLike(value) && isArrayLike(value);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvcHJlZGljYXRlL2lzQXJyYXlMaWtlT2JqZWN0LnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGlzQXJyYXlMaWtlIH0gZnJvbSAnLi9pc0FycmF5TGlrZS50cyc7XG5pbXBvcnQgeyBpc09iamVjdExpa2UgfSBmcm9tICcuL2lzT2JqZWN0TGlrZS50cyc7XG5cbi8qKlxuICogQ2hlY2tzIGlmIHRoZSBnaXZlbiB2YWx1ZSBpcyBhIG5vbi1wcmltaXRpdmUsIGFycmF5LWxpa2Ugb2JqZWN0LlxuICpcbiAqIEBwYXJhbSB7dW5rbm93bn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge3ZhbHVlIGlzIEFycmF5TGlrZTx1bmtub3duPiAmIG9iamVjdH0gYHRydWVgIGlmIHRoZSB2YWx1ZSBpcyBhIG5vbi1wcmltaXRpdmUsIGFycmF5LWxpa2Ugb2JqZWN0LCBgZmFsc2VgIG90aGVyd2lzZS5cbiAqXG4gKiBAZXhhbXBsZVxuICogaXNBcnJheUxpa2VPYmplY3QoWzEsIDIsIDNdKTsgLy8gdHJ1ZVxuICogaXNBcnJheUxpa2VPYmplY3QoeyAwOiAnYScsIGxlbmd0aDogMSB9KTsgLy8gdHJ1ZVxuICogaXNBcnJheUxpa2VPYmplY3QoJ2FiYycpOyAvLyBmYWxzZVxuICogaXNBcnJheUxpa2VPYmplY3QoKCk9Pnt9KTsgLy8gZmFsc2VcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzQXJyYXlMaWtlT2JqZWN0KHZhbHVlPzogdW5rbm93bik6IHZhbHVlIGlzIEFycmF5TGlrZTx1bmtub3duPiAmIG9iamVjdCB7XG4gIHJldHVybiBpc09iamVjdExpa2UodmFsdWUpICYmIGlzQXJyYXlMaWtlKHZhbHVlKTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLFdBQVcsUUFBUSxtQkFBbUI7QUFDL0MsU0FBUyxZQUFZLFFBQVEsb0JBQW9CO0FBRWpEOzs7Ozs7Ozs7OztDQVdDLEdBQ0QsT0FBTyxTQUFTLGtCQUFrQixLQUFlO0VBQy9DLE9BQU8sYUFBYSxVQUFVLFlBQVk7QUFDNUMifQ==
// denoCacheMetadata=8318232224295566195,14681824425378836658