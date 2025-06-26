import { toInteger } from './toInteger.ts';
import { MAX_SAFE_INTEGER } from '../_internal/MAX_SAFE_INTEGER.ts';
import { clamp } from '../math/clamp.ts';
/**
 * Converts `value` to a safe integer.
 *
 * A safe integer can be compared and represented correctly.
 *
 * @param {unknown} value - The value to convert.
 * @returns {number} Returns the value converted to a safe integer.
 *
 * @example
 * toSafeInteger(3.2); // => 3
 * toSafeInteger(Number.MAX_VALUE); // => 9007199254740991
 * toSafeInteger(Infinity); // => 9007199254740991
 * toSafeInteger('3.2'); // => 3
 * toSafeInteger(NaN); // => 0
 * toSafeInteger(null); // => 0
 * toSafeInteger(-Infinity); // => -9007199254740991
 */ export function toSafeInteger(value) {
  if (value == null) {
    return 0;
  }
  return clamp(toInteger(value), -MAX_SAFE_INTEGER, MAX_SAFE_INTEGER);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvdXRpbC90b1NhZmVJbnRlZ2VyLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHRvSW50ZWdlciB9IGZyb20gJy4vdG9JbnRlZ2VyLnRzJztcbmltcG9ydCB7IE1BWF9TQUZFX0lOVEVHRVIgfSBmcm9tICcuLi9faW50ZXJuYWwvTUFYX1NBRkVfSU5URUdFUi50cyc7XG5pbXBvcnQgeyBjbGFtcCB9IGZyb20gJy4uL21hdGgvY2xhbXAudHMnO1xuXG4vKipcbiAqIENvbnZlcnRzIGB2YWx1ZWAgdG8gYSBzYWZlIGludGVnZXIuXG4gKlxuICogQSBzYWZlIGludGVnZXIgY2FuIGJlIGNvbXBhcmVkIGFuZCByZXByZXNlbnRlZCBjb3JyZWN0bHkuXG4gKlxuICogQHBhcmFtIHt1bmtub3dufSB2YWx1ZSAtIFRoZSB2YWx1ZSB0byBjb252ZXJ0LlxuICogQHJldHVybnMge251bWJlcn0gUmV0dXJucyB0aGUgdmFsdWUgY29udmVydGVkIHRvIGEgc2FmZSBpbnRlZ2VyLlxuICpcbiAqIEBleGFtcGxlXG4gKiB0b1NhZmVJbnRlZ2VyKDMuMik7IC8vID0+IDNcbiAqIHRvU2FmZUludGVnZXIoTnVtYmVyLk1BWF9WQUxVRSk7IC8vID0+IDkwMDcxOTkyNTQ3NDA5OTFcbiAqIHRvU2FmZUludGVnZXIoSW5maW5pdHkpOyAvLyA9PiA5MDA3MTk5MjU0NzQwOTkxXG4gKiB0b1NhZmVJbnRlZ2VyKCczLjInKTsgLy8gPT4gM1xuICogdG9TYWZlSW50ZWdlcihOYU4pOyAvLyA9PiAwXG4gKiB0b1NhZmVJbnRlZ2VyKG51bGwpOyAvLyA9PiAwXG4gKiB0b1NhZmVJbnRlZ2VyKC1JbmZpbml0eSk7IC8vID0+IC05MDA3MTk5MjU0NzQwOTkxXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0b1NhZmVJbnRlZ2VyKHZhbHVlPzogdW5rbm93bik6IG51bWJlciB7XG4gIGlmICh2YWx1ZSA9PSBudWxsKSB7XG4gICAgcmV0dXJuIDA7XG4gIH1cblxuICByZXR1cm4gY2xhbXAodG9JbnRlZ2VyKHZhbHVlKSwgLU1BWF9TQUZFX0lOVEVHRVIsIE1BWF9TQUZFX0lOVEVHRVIpO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsU0FBUyxRQUFRLGlCQUFpQjtBQUMzQyxTQUFTLGdCQUFnQixRQUFRLG1DQUFtQztBQUNwRSxTQUFTLEtBQUssUUFBUSxtQkFBbUI7QUFFekM7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FnQkMsR0FDRCxPQUFPLFNBQVMsY0FBYyxLQUFlO0VBQzNDLElBQUksU0FBUyxNQUFNO0lBQ2pCLE9BQU87RUFDVDtFQUVBLE9BQU8sTUFBTSxVQUFVLFFBQVEsQ0FBQyxrQkFBa0I7QUFDcEQifQ==
// denoCacheMetadata=17661679121906680443,598724921264304316