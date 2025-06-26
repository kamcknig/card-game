import { getTag } from '../_internal/getTag.ts';
/**
 * Checks if `value` is an Error object.
 *
 * @param {unknown} value The value to check.
 * @returns {value is Error} Returns `true` if `value` is an Error object, `false` otherwise.
 *
 * @example
 * ```typescript
 * console.log(isError(new Error())); // true
 * console.log(isError('Error')); // false
 * console.log(isError({ name: 'Error', message: '' })); // false
 * ```
 */ export function isError(value) {
  return getTag(value) === '[object Error]';
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvcHJlZGljYXRlL2lzRXJyb3IudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgZ2V0VGFnIH0gZnJvbSAnLi4vX2ludGVybmFsL2dldFRhZy50cyc7XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYW4gRXJyb3Igb2JqZWN0LlxuICpcbiAqIEBwYXJhbSB7dW5rbm93bn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge3ZhbHVlIGlzIEVycm9yfSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGFuIEVycm9yIG9iamVjdCwgYGZhbHNlYCBvdGhlcndpc2UuXG4gKlxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGNvbnNvbGUubG9nKGlzRXJyb3IobmV3IEVycm9yKCkpKTsgLy8gdHJ1ZVxuICogY29uc29sZS5sb2coaXNFcnJvcignRXJyb3InKSk7IC8vIGZhbHNlXG4gKiBjb25zb2xlLmxvZyhpc0Vycm9yKHsgbmFtZTogJ0Vycm9yJywgbWVzc2FnZTogJycgfSkpOyAvLyBmYWxzZVxuICogYGBgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc0Vycm9yKHZhbHVlPzogdW5rbm93bik6IHZhbHVlIGlzIEVycm9yIHtcbiAgcmV0dXJuIGdldFRhZyh2YWx1ZSkgPT09ICdbb2JqZWN0IEVycm9yXSc7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxNQUFNLFFBQVEseUJBQXlCO0FBRWhEOzs7Ozs7Ozs7Ozs7Q0FZQyxHQUNELE9BQU8sU0FBUyxRQUFRLEtBQWU7RUFDckMsT0FBTyxPQUFPLFdBQVc7QUFDM0IifQ==
// denoCacheMetadata=11916621708516156707,5935352113657585129