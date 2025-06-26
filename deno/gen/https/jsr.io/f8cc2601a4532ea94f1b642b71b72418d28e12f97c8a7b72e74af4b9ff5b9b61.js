import { getTag } from '../_internal/getTag.ts';
/**
 * Checks if the given value is an arguments object.
 *
 * This function tests whether the provided value is an arguments object or not.
 * It returns `true` if the value is an arguments object, and `false` otherwise.
 *
 * This function can also serve as a type predicate in TypeScript, narrowing the type of the argument to an arguments object.
 *
 * @param {unknown} value - The value to test if it is an arguments object.
 * @returns {value is IArguments} `true` if the value is an arguments, `false` otherwise.
 *
 * @example
 * const args = (function() { return arguments; })();
 * const strictArgs = (function() { 'use strict'; return arguments; })();
 * const value = [1, 2, 3];
 *
 * console.log(isArguments(args)); // true
 * console.log(isArguments(strictArgs)); // true
 * console.log(isArguments(value)); // false
 */ export function isArguments(value) {
  return value !== null && typeof value === 'object' && getTag(value) === '[object Arguments]';
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvcHJlZGljYXRlL2lzQXJndW1lbnRzLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGdldFRhZyB9IGZyb20gJy4uL19pbnRlcm5hbC9nZXRUYWcudHMnO1xuXG4vKipcbiAqIENoZWNrcyBpZiB0aGUgZ2l2ZW4gdmFsdWUgaXMgYW4gYXJndW1lbnRzIG9iamVjdC5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIHRlc3RzIHdoZXRoZXIgdGhlIHByb3ZpZGVkIHZhbHVlIGlzIGFuIGFyZ3VtZW50cyBvYmplY3Qgb3Igbm90LlxuICogSXQgcmV0dXJucyBgdHJ1ZWAgaWYgdGhlIHZhbHVlIGlzIGFuIGFyZ3VtZW50cyBvYmplY3QsIGFuZCBgZmFsc2VgIG90aGVyd2lzZS5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIGNhbiBhbHNvIHNlcnZlIGFzIGEgdHlwZSBwcmVkaWNhdGUgaW4gVHlwZVNjcmlwdCwgbmFycm93aW5nIHRoZSB0eXBlIG9mIHRoZSBhcmd1bWVudCB0byBhbiBhcmd1bWVudHMgb2JqZWN0LlxuICpcbiAqIEBwYXJhbSB7dW5rbm93bn0gdmFsdWUgLSBUaGUgdmFsdWUgdG8gdGVzdCBpZiBpdCBpcyBhbiBhcmd1bWVudHMgb2JqZWN0LlxuICogQHJldHVybnMge3ZhbHVlIGlzIElBcmd1bWVudHN9IGB0cnVlYCBpZiB0aGUgdmFsdWUgaXMgYW4gYXJndW1lbnRzLCBgZmFsc2VgIG90aGVyd2lzZS5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgYXJncyA9IChmdW5jdGlvbigpIHsgcmV0dXJuIGFyZ3VtZW50czsgfSkoKTtcbiAqIGNvbnN0IHN0cmljdEFyZ3MgPSAoZnVuY3Rpb24oKSB7ICd1c2Ugc3RyaWN0JzsgcmV0dXJuIGFyZ3VtZW50czsgfSkoKTtcbiAqIGNvbnN0IHZhbHVlID0gWzEsIDIsIDNdO1xuICpcbiAqIGNvbnNvbGUubG9nKGlzQXJndW1lbnRzKGFyZ3MpKTsgLy8gdHJ1ZVxuICogY29uc29sZS5sb2coaXNBcmd1bWVudHMoc3RyaWN0QXJncykpOyAvLyB0cnVlXG4gKiBjb25zb2xlLmxvZyhpc0FyZ3VtZW50cyh2YWx1ZSkpOyAvLyBmYWxzZVxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNBcmd1bWVudHModmFsdWU/OiB1bmtub3duKTogdmFsdWUgaXMgSUFyZ3VtZW50cyB7XG4gIHJldHVybiB2YWx1ZSAhPT0gbnVsbCAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmIGdldFRhZyh2YWx1ZSkgPT09ICdbb2JqZWN0IEFyZ3VtZW50c10nO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsTUFBTSxRQUFRLHlCQUF5QjtBQUVoRDs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQW1CQyxHQUNELE9BQU8sU0FBUyxZQUFZLEtBQWU7RUFDekMsT0FBTyxVQUFVLFFBQVEsT0FBTyxVQUFVLFlBQVksT0FBTyxXQUFXO0FBQzFFIn0=
// denoCacheMetadata=867746807924417151,13766157310427254926