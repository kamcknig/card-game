import { toNumber } from './toNumber.ts';
/**
 * Converts `value` to a finite number.
 *
 * @param {unknown} value - The value to convert.
 * @returns {number} Returns the number.
 *
 * @example
 * toNumber(3.2); // => 3.2
 * toNumber(Number.MIN_VALUE); // => 5e-324
 * toNumber(Infinity); // => 1.7976931348623157e+308
 * toNumber('3.2'); // => 3.2
 * toNumber(Symbol.iterator); // => 0
 * toNumber(NaN); // => 0
 */ export function toFinite(value) {
  if (!value) {
    return value === 0 ? value : 0;
  }
  value = toNumber(value);
  if (value === Infinity || value === -Infinity) {
    const sign = value < 0 ? -1 : 1;
    return sign * Number.MAX_VALUE;
  }
  return value === value ? value : 0;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvdXRpbC90b0Zpbml0ZS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyB0b051bWJlciB9IGZyb20gJy4vdG9OdW1iZXIudHMnO1xuXG4vKipcbiAqIENvbnZlcnRzIGB2YWx1ZWAgdG8gYSBmaW5pdGUgbnVtYmVyLlxuICpcbiAqIEBwYXJhbSB7dW5rbm93bn0gdmFsdWUgLSBUaGUgdmFsdWUgdG8gY29udmVydC5cbiAqIEByZXR1cm5zIHtudW1iZXJ9IFJldHVybnMgdGhlIG51bWJlci5cbiAqXG4gKiBAZXhhbXBsZVxuICogdG9OdW1iZXIoMy4yKTsgLy8gPT4gMy4yXG4gKiB0b051bWJlcihOdW1iZXIuTUlOX1ZBTFVFKTsgLy8gPT4gNWUtMzI0XG4gKiB0b051bWJlcihJbmZpbml0eSk7IC8vID0+IDEuNzk3NjkzMTM0ODYyMzE1N2UrMzA4XG4gKiB0b051bWJlcignMy4yJyk7IC8vID0+IDMuMlxuICogdG9OdW1iZXIoU3ltYm9sLml0ZXJhdG9yKTsgLy8gPT4gMFxuICogdG9OdW1iZXIoTmFOKTsgLy8gPT4gMFxuICovXG5leHBvcnQgZnVuY3Rpb24gdG9GaW5pdGUodmFsdWU/OiB1bmtub3duKTogbnVtYmVyIHtcbiAgaWYgKCF2YWx1ZSkge1xuICAgIHJldHVybiB2YWx1ZSA9PT0gMCA/IHZhbHVlIDogMDtcbiAgfVxuXG4gIHZhbHVlID0gdG9OdW1iZXIodmFsdWUpO1xuXG4gIGlmICh2YWx1ZSA9PT0gSW5maW5pdHkgfHwgdmFsdWUgPT09IC1JbmZpbml0eSkge1xuICAgIGNvbnN0IHNpZ24gPSB2YWx1ZSA8IDAgPyAtMSA6IDE7XG4gICAgcmV0dXJuIHNpZ24gKiBOdW1iZXIuTUFYX1ZBTFVFO1xuICB9XG5cbiAgcmV0dXJuIHZhbHVlID09PSB2YWx1ZSA/ICh2YWx1ZSBhcyBudW1iZXIpIDogMDtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLFFBQVEsUUFBUSxnQkFBZ0I7QUFFekM7Ozs7Ozs7Ozs7Ozs7Q0FhQyxHQUNELE9BQU8sU0FBUyxTQUFTLEtBQWU7RUFDdEMsSUFBSSxDQUFDLE9BQU87SUFDVixPQUFPLFVBQVUsSUFBSSxRQUFRO0VBQy9CO0VBRUEsUUFBUSxTQUFTO0VBRWpCLElBQUksVUFBVSxZQUFZLFVBQVUsQ0FBQyxVQUFVO0lBQzdDLE1BQU0sT0FBTyxRQUFRLElBQUksQ0FBQyxJQUFJO0lBQzlCLE9BQU8sT0FBTyxPQUFPLFNBQVM7RUFDaEM7RUFFQSxPQUFPLFVBQVUsUUFBUyxRQUFtQjtBQUMvQyJ9
// denoCacheMetadata=3135218358869803496,16887589735472396114