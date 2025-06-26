import { isPrimitive } from '../predicate/isPrimitive.ts';
import { isTypedArray } from '../predicate/isTypedArray.ts';
/**
 * Creates a shallow clone of the given object.
 *
 * @template T - The type of the object.
 * @param {T} obj - The object to clone.
 * @returns {T} - A shallow clone of the given object.
 *
 * @example
 * // Clone a primitive values
 * const num = 29;
 * const clonedNum = clone(num);
 * console.log(clonedNum); // 29
 * console.log(clonedNum === num) ; // true
 *
 * @example
 * // Clone an array
 * const arr = [1, 2, 3];
 * const clonedArr = clone(arr);
 * console.log(clonedArr); // [1, 2, 3]
 * console.log(clonedArr === arr); // false
 *
 * @example
 * // Clone an object
 * const obj = { a: 1, b: 'es-toolkit', c: [1, 2, 3] };
 * const clonedObj = clone(obj);
 * console.log(clonedObj); // { a: 1, b: 'es-toolkit', c: [1, 2, 3] }
 * console.log(clonedObj === obj); // false
 */ export function clone(obj) {
  if (isPrimitive(obj)) {
    return obj;
  }
  if (Array.isArray(obj) || isTypedArray(obj) || obj instanceof ArrayBuffer || typeof SharedArrayBuffer !== 'undefined' && obj instanceof SharedArrayBuffer) {
    return obj.slice(0);
  }
  const prototype = Object.getPrototypeOf(obj);
  const Constructor = prototype.constructor;
  if (obj instanceof Date || obj instanceof Map || obj instanceof Set) {
    return new Constructor(obj);
  }
  if (obj instanceof RegExp) {
    const newRegExp = new Constructor(obj);
    newRegExp.lastIndex = obj.lastIndex;
    return newRegExp;
  }
  if (obj instanceof DataView) {
    return new Constructor(obj.buffer.slice(0));
  }
  if (obj instanceof Error) {
    const newError = new Constructor(obj.message);
    newError.stack = obj.stack;
    newError.name = obj.name;
    newError.cause = obj.cause;
    return newError;
  }
  if (typeof File !== 'undefined' && obj instanceof File) {
    const newFile = new Constructor([
      obj
    ], obj.name, {
      type: obj.type,
      lastModified: obj.lastModified
    });
    return newFile;
  }
  if (typeof obj === 'object') {
    const newObject = Object.create(prototype);
    return Object.assign(newObject, obj);
  }
  return obj;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9vYmplY3QvY2xvbmUudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgaXNQcmltaXRpdmUgfSBmcm9tICcuLi9wcmVkaWNhdGUvaXNQcmltaXRpdmUudHMnO1xuaW1wb3J0IHsgaXNUeXBlZEFycmF5IH0gZnJvbSAnLi4vcHJlZGljYXRlL2lzVHlwZWRBcnJheS50cyc7XG5cbi8qKlxuICogQ3JlYXRlcyBhIHNoYWxsb3cgY2xvbmUgb2YgdGhlIGdpdmVuIG9iamVjdC5cbiAqXG4gKiBAdGVtcGxhdGUgVCAtIFRoZSB0eXBlIG9mIHRoZSBvYmplY3QuXG4gKiBAcGFyYW0ge1R9IG9iaiAtIFRoZSBvYmplY3QgdG8gY2xvbmUuXG4gKiBAcmV0dXJucyB7VH0gLSBBIHNoYWxsb3cgY2xvbmUgb2YgdGhlIGdpdmVuIG9iamVjdC5cbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gQ2xvbmUgYSBwcmltaXRpdmUgdmFsdWVzXG4gKiBjb25zdCBudW0gPSAyOTtcbiAqIGNvbnN0IGNsb25lZE51bSA9IGNsb25lKG51bSk7XG4gKiBjb25zb2xlLmxvZyhjbG9uZWROdW0pOyAvLyAyOVxuICogY29uc29sZS5sb2coY2xvbmVkTnVtID09PSBudW0pIDsgLy8gdHJ1ZVxuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBDbG9uZSBhbiBhcnJheVxuICogY29uc3QgYXJyID0gWzEsIDIsIDNdO1xuICogY29uc3QgY2xvbmVkQXJyID0gY2xvbmUoYXJyKTtcbiAqIGNvbnNvbGUubG9nKGNsb25lZEFycik7IC8vIFsxLCAyLCAzXVxuICogY29uc29sZS5sb2coY2xvbmVkQXJyID09PSBhcnIpOyAvLyBmYWxzZVxuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBDbG9uZSBhbiBvYmplY3RcbiAqIGNvbnN0IG9iaiA9IHsgYTogMSwgYjogJ2VzLXRvb2xraXQnLCBjOiBbMSwgMiwgM10gfTtcbiAqIGNvbnN0IGNsb25lZE9iaiA9IGNsb25lKG9iaik7XG4gKiBjb25zb2xlLmxvZyhjbG9uZWRPYmopOyAvLyB7IGE6IDEsIGI6ICdlcy10b29sa2l0JywgYzogWzEsIDIsIDNdIH1cbiAqIGNvbnNvbGUubG9nKGNsb25lZE9iaiA9PT0gb2JqKTsgLy8gZmFsc2VcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNsb25lPFQ+KG9iajogVCk6IFQge1xuICBpZiAoaXNQcmltaXRpdmUob2JqKSkge1xuICAgIHJldHVybiBvYmo7XG4gIH1cblxuICBpZiAoXG4gICAgQXJyYXkuaXNBcnJheShvYmopIHx8XG4gICAgaXNUeXBlZEFycmF5KG9iaikgfHxcbiAgICBvYmogaW5zdGFuY2VvZiBBcnJheUJ1ZmZlciB8fFxuICAgICh0eXBlb2YgU2hhcmVkQXJyYXlCdWZmZXIgIT09ICd1bmRlZmluZWQnICYmIG9iaiBpbnN0YW5jZW9mIFNoYXJlZEFycmF5QnVmZmVyKVxuICApIHtcbiAgICByZXR1cm4gb2JqLnNsaWNlKDApIGFzIFQ7XG4gIH1cblxuICBjb25zdCBwcm90b3R5cGUgPSBPYmplY3QuZ2V0UHJvdG90eXBlT2Yob2JqKTtcbiAgY29uc3QgQ29uc3RydWN0b3IgPSBwcm90b3R5cGUuY29uc3RydWN0b3I7XG5cbiAgaWYgKG9iaiBpbnN0YW5jZW9mIERhdGUgfHwgb2JqIGluc3RhbmNlb2YgTWFwIHx8IG9iaiBpbnN0YW5jZW9mIFNldCkge1xuICAgIHJldHVybiBuZXcgQ29uc3RydWN0b3Iob2JqKTtcbiAgfVxuXG4gIGlmIChvYmogaW5zdGFuY2VvZiBSZWdFeHApIHtcbiAgICBjb25zdCBuZXdSZWdFeHAgPSBuZXcgQ29uc3RydWN0b3Iob2JqKTtcbiAgICBuZXdSZWdFeHAubGFzdEluZGV4ID0gb2JqLmxhc3RJbmRleDtcblxuICAgIHJldHVybiBuZXdSZWdFeHA7XG4gIH1cblxuICBpZiAob2JqIGluc3RhbmNlb2YgRGF0YVZpZXcpIHtcbiAgICByZXR1cm4gbmV3IENvbnN0cnVjdG9yKG9iai5idWZmZXIuc2xpY2UoMCkpO1xuICB9XG5cbiAgaWYgKG9iaiBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgY29uc3QgbmV3RXJyb3IgPSBuZXcgQ29uc3RydWN0b3Iob2JqLm1lc3NhZ2UpO1xuXG4gICAgbmV3RXJyb3Iuc3RhY2sgPSBvYmouc3RhY2s7XG4gICAgbmV3RXJyb3IubmFtZSA9IG9iai5uYW1lO1xuICAgIG5ld0Vycm9yLmNhdXNlID0gb2JqLmNhdXNlO1xuXG4gICAgcmV0dXJuIG5ld0Vycm9yO1xuICB9XG5cbiAgaWYgKHR5cGVvZiBGaWxlICE9PSAndW5kZWZpbmVkJyAmJiBvYmogaW5zdGFuY2VvZiBGaWxlKSB7XG4gICAgY29uc3QgbmV3RmlsZSA9IG5ldyBDb25zdHJ1Y3Rvcihbb2JqXSwgb2JqLm5hbWUsIHsgdHlwZTogb2JqLnR5cGUsIGxhc3RNb2RpZmllZDogb2JqLmxhc3RNb2RpZmllZCB9KTtcbiAgICByZXR1cm4gbmV3RmlsZTtcbiAgfVxuXG4gIGlmICh0eXBlb2Ygb2JqID09PSAnb2JqZWN0Jykge1xuICAgIGNvbnN0IG5ld09iamVjdCA9IE9iamVjdC5jcmVhdGUocHJvdG90eXBlKTtcbiAgICByZXR1cm4gT2JqZWN0LmFzc2lnbihuZXdPYmplY3QsIG9iaik7XG4gIH1cblxuICByZXR1cm4gb2JqO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsV0FBVyxRQUFRLDhCQUE4QjtBQUMxRCxTQUFTLFlBQVksUUFBUSwrQkFBK0I7QUFFNUQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQTJCQyxHQUNELE9BQU8sU0FBUyxNQUFTLEdBQU07RUFDN0IsSUFBSSxZQUFZLE1BQU07SUFDcEIsT0FBTztFQUNUO0VBRUEsSUFDRSxNQUFNLE9BQU8sQ0FBQyxRQUNkLGFBQWEsUUFDYixlQUFlLGVBQ2QsT0FBTyxzQkFBc0IsZUFBZSxlQUFlLG1CQUM1RDtJQUNBLE9BQU8sSUFBSSxLQUFLLENBQUM7RUFDbkI7RUFFQSxNQUFNLFlBQVksT0FBTyxjQUFjLENBQUM7RUFDeEMsTUFBTSxjQUFjLFVBQVUsV0FBVztFQUV6QyxJQUFJLGVBQWUsUUFBUSxlQUFlLE9BQU8sZUFBZSxLQUFLO0lBQ25FLE9BQU8sSUFBSSxZQUFZO0VBQ3pCO0VBRUEsSUFBSSxlQUFlLFFBQVE7SUFDekIsTUFBTSxZQUFZLElBQUksWUFBWTtJQUNsQyxVQUFVLFNBQVMsR0FBRyxJQUFJLFNBQVM7SUFFbkMsT0FBTztFQUNUO0VBRUEsSUFBSSxlQUFlLFVBQVU7SUFDM0IsT0FBTyxJQUFJLFlBQVksSUFBSSxNQUFNLENBQUMsS0FBSyxDQUFDO0VBQzFDO0VBRUEsSUFBSSxlQUFlLE9BQU87SUFDeEIsTUFBTSxXQUFXLElBQUksWUFBWSxJQUFJLE9BQU87SUFFNUMsU0FBUyxLQUFLLEdBQUcsSUFBSSxLQUFLO0lBQzFCLFNBQVMsSUFBSSxHQUFHLElBQUksSUFBSTtJQUN4QixTQUFTLEtBQUssR0FBRyxJQUFJLEtBQUs7SUFFMUIsT0FBTztFQUNUO0VBRUEsSUFBSSxPQUFPLFNBQVMsZUFBZSxlQUFlLE1BQU07SUFDdEQsTUFBTSxVQUFVLElBQUksWUFBWTtNQUFDO0tBQUksRUFBRSxJQUFJLElBQUksRUFBRTtNQUFFLE1BQU0sSUFBSSxJQUFJO01BQUUsY0FBYyxJQUFJLFlBQVk7SUFBQztJQUNsRyxPQUFPO0VBQ1Q7RUFFQSxJQUFJLE9BQU8sUUFBUSxVQUFVO0lBQzNCLE1BQU0sWUFBWSxPQUFPLE1BQU0sQ0FBQztJQUNoQyxPQUFPLE9BQU8sTUFBTSxDQUFDLFdBQVc7RUFDbEM7RUFFQSxPQUFPO0FBQ1QifQ==
// denoCacheMetadata=3796819834917363186,14750554431118233919