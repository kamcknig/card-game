/**
 * Finds the element in an array that has the minimum value when applying
 * the `getValue` function to each element.
 *
 * @template T - The type of elements in the array.
 * @param {[T, ...T[]]} items The nonempty array of elements to search.
 * @param {(element: T) => number} getValue A function that selects a numeric value from each element.
 * @returns {T} The element with the minimum value as determined by the `getValue` function.
 * @example
 * minBy([{ a: 1 }, { a: 2 }, { a: 3 }], x => x.a); // Returns: { a: 1 }
 * minBy([], x => x.a); // Returns: undefined
 * minBy(
 *   [
 *     { name: 'john', age: 30 },
 *     { name: 'jane', age: 28 },
 *     { name: 'joe', age: 26 },
 *   ],
 *   x => x.age
 * ); // Returns: { name: 'joe', age: 26 }
 */ /**
 * Finds the element in an array that has the minimum value when applying
 * the `getValue` function to each element.
 *
 * @template T - The type of elements in the array.
 * @param {T[]} items The array of elements to search.
 * @param {(element: T) => number} getValue A function that selects a numeric value from each element.
 * @returns {T | undefined} The element with the minimum value as determined by the `getValue` function.
 * @example
 * minBy([{ a: 1 }, { a: 2 }, { a: 3 }], x => x.a); // Returns: { a: 1 }
 * minBy([], x => x.a); // Returns: undefined
 * minBy(
 *   [
 *     { name: 'john', age: 30 },
 *     { name: 'jane', age: 28 },
 *     { name: 'joe', age: 26 },
 *   ],
 *   x => x.age
 * ); // Returns: { name: 'joe', age: 26 }
 */ export function minBy(items, getValue) {
  let minElement = items[0];
  let min = Infinity;
  for(let i = 0; i < items.length; i++){
    const element = items[i];
    const value = getValue(element);
    if (value < min) {
      min = value;
      minElement = element;
    }
  }
  return minElement;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9hcnJheS9taW5CeS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEZpbmRzIHRoZSBlbGVtZW50IGluIGFuIGFycmF5IHRoYXQgaGFzIHRoZSBtaW5pbXVtIHZhbHVlIHdoZW4gYXBwbHlpbmdcbiAqIHRoZSBgZ2V0VmFsdWVgIGZ1bmN0aW9uIHRvIGVhY2ggZWxlbWVudC5cbiAqXG4gKiBAdGVtcGxhdGUgVCAtIFRoZSB0eXBlIG9mIGVsZW1lbnRzIGluIHRoZSBhcnJheS5cbiAqIEBwYXJhbSB7W1QsIC4uLlRbXV19IGl0ZW1zIFRoZSBub25lbXB0eSBhcnJheSBvZiBlbGVtZW50cyB0byBzZWFyY2guXG4gKiBAcGFyYW0geyhlbGVtZW50OiBUKSA9PiBudW1iZXJ9IGdldFZhbHVlIEEgZnVuY3Rpb24gdGhhdCBzZWxlY3RzIGEgbnVtZXJpYyB2YWx1ZSBmcm9tIGVhY2ggZWxlbWVudC5cbiAqIEByZXR1cm5zIHtUfSBUaGUgZWxlbWVudCB3aXRoIHRoZSBtaW5pbXVtIHZhbHVlIGFzIGRldGVybWluZWQgYnkgdGhlIGBnZXRWYWx1ZWAgZnVuY3Rpb24uXG4gKiBAZXhhbXBsZVxuICogbWluQnkoW3sgYTogMSB9LCB7IGE6IDIgfSwgeyBhOiAzIH1dLCB4ID0+IHguYSk7IC8vIFJldHVybnM6IHsgYTogMSB9XG4gKiBtaW5CeShbXSwgeCA9PiB4LmEpOyAvLyBSZXR1cm5zOiB1bmRlZmluZWRcbiAqIG1pbkJ5KFxuICogICBbXG4gKiAgICAgeyBuYW1lOiAnam9obicsIGFnZTogMzAgfSxcbiAqICAgICB7IG5hbWU6ICdqYW5lJywgYWdlOiAyOCB9LFxuICogICAgIHsgbmFtZTogJ2pvZScsIGFnZTogMjYgfSxcbiAqICAgXSxcbiAqICAgeCA9PiB4LmFnZVxuICogKTsgLy8gUmV0dXJuczogeyBuYW1lOiAnam9lJywgYWdlOiAyNiB9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBtaW5CeTxUPihpdGVtczogcmVhZG9ubHkgW1QsIC4uLlRbXV0sIGdldFZhbHVlOiAoZWxlbWVudDogVCkgPT4gbnVtYmVyKTogVDtcbi8qKlxuICogRmluZHMgdGhlIGVsZW1lbnQgaW4gYW4gYXJyYXkgdGhhdCBoYXMgdGhlIG1pbmltdW0gdmFsdWUgd2hlbiBhcHBseWluZ1xuICogdGhlIGBnZXRWYWx1ZWAgZnVuY3Rpb24gdG8gZWFjaCBlbGVtZW50LlxuICpcbiAqIEB0ZW1wbGF0ZSBUIC0gVGhlIHR5cGUgb2YgZWxlbWVudHMgaW4gdGhlIGFycmF5LlxuICogQHBhcmFtIHtUW119IGl0ZW1zIFRoZSBhcnJheSBvZiBlbGVtZW50cyB0byBzZWFyY2guXG4gKiBAcGFyYW0geyhlbGVtZW50OiBUKSA9PiBudW1iZXJ9IGdldFZhbHVlIEEgZnVuY3Rpb24gdGhhdCBzZWxlY3RzIGEgbnVtZXJpYyB2YWx1ZSBmcm9tIGVhY2ggZWxlbWVudC5cbiAqIEByZXR1cm5zIHtUIHwgdW5kZWZpbmVkfSBUaGUgZWxlbWVudCB3aXRoIHRoZSBtaW5pbXVtIHZhbHVlIGFzIGRldGVybWluZWQgYnkgdGhlIGBnZXRWYWx1ZWAgZnVuY3Rpb24uXG4gKiBAZXhhbXBsZVxuICogbWluQnkoW3sgYTogMSB9LCB7IGE6IDIgfSwgeyBhOiAzIH1dLCB4ID0+IHguYSk7IC8vIFJldHVybnM6IHsgYTogMSB9XG4gKiBtaW5CeShbXSwgeCA9PiB4LmEpOyAvLyBSZXR1cm5zOiB1bmRlZmluZWRcbiAqIG1pbkJ5KFxuICogICBbXG4gKiAgICAgeyBuYW1lOiAnam9obicsIGFnZTogMzAgfSxcbiAqICAgICB7IG5hbWU6ICdqYW5lJywgYWdlOiAyOCB9LFxuICogICAgIHsgbmFtZTogJ2pvZScsIGFnZTogMjYgfSxcbiAqICAgXSxcbiAqICAgeCA9PiB4LmFnZVxuICogKTsgLy8gUmV0dXJuczogeyBuYW1lOiAnam9lJywgYWdlOiAyNiB9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBtaW5CeTxUPihpdGVtczogcmVhZG9ubHkgVFtdLCBnZXRWYWx1ZTogKGVsZW1lbnQ6IFQpID0+IG51bWJlcik6IFQgfCB1bmRlZmluZWQ7XG4vKipcbiAqIEZpbmRzIHRoZSBlbGVtZW50IGluIGFuIGFycmF5IHRoYXQgaGFzIHRoZSBtaW5pbXVtIHZhbHVlIHdoZW4gYXBwbHlpbmdcbiAqIHRoZSBgZ2V0VmFsdWVgIGZ1bmN0aW9uIHRvIGVhY2ggZWxlbWVudC5cbiAqXG4gKiBAdGVtcGxhdGUgVCAtIFRoZSB0eXBlIG9mIGVsZW1lbnRzIGluIHRoZSBhcnJheS5cbiAqIEBwYXJhbSB7VFtdfSBpdGVtcyBUaGUgYXJyYXkgb2YgZWxlbWVudHMgdG8gc2VhcmNoLlxuICogQHBhcmFtIHsoZWxlbWVudDogVCkgPT4gbnVtYmVyfSBnZXRWYWx1ZSBBIGZ1bmN0aW9uIHRoYXQgc2VsZWN0cyBhIG51bWVyaWMgdmFsdWUgZnJvbSBlYWNoIGVsZW1lbnQuXG4gKiBAcmV0dXJucyB7VCB8IHVuZGVmaW5lZH0gVGhlIGVsZW1lbnQgd2l0aCB0aGUgbWluaW11bSB2YWx1ZSBhcyBkZXRlcm1pbmVkIGJ5IHRoZSBgZ2V0VmFsdWVgIGZ1bmN0aW9uLlxuICogQGV4YW1wbGVcbiAqIG1pbkJ5KFt7IGE6IDEgfSwgeyBhOiAyIH0sIHsgYTogMyB9XSwgeCA9PiB4LmEpOyAvLyBSZXR1cm5zOiB7IGE6IDEgfVxuICogbWluQnkoW10sIHggPT4geC5hKTsgLy8gUmV0dXJuczogdW5kZWZpbmVkXG4gKiBtaW5CeShcbiAqICAgW1xuICogICAgIHsgbmFtZTogJ2pvaG4nLCBhZ2U6IDMwIH0sXG4gKiAgICAgeyBuYW1lOiAnamFuZScsIGFnZTogMjggfSxcbiAqICAgICB7IG5hbWU6ICdqb2UnLCBhZ2U6IDI2IH0sXG4gKiAgIF0sXG4gKiAgIHggPT4geC5hZ2VcbiAqICk7IC8vIFJldHVybnM6IHsgbmFtZTogJ2pvZScsIGFnZTogMjYgfVxuICovXG5leHBvcnQgZnVuY3Rpb24gbWluQnk8VD4oaXRlbXM6IHJlYWRvbmx5IFRbXSwgZ2V0VmFsdWU6IChlbGVtZW50OiBUKSA9PiBudW1iZXIpOiBUIHwgdW5kZWZpbmVkIHtcbiAgbGV0IG1pbkVsZW1lbnQgPSBpdGVtc1swXTtcbiAgbGV0IG1pbiA9IEluZmluaXR5O1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgaXRlbXMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBlbGVtZW50ID0gaXRlbXNbaV07XG4gICAgY29uc3QgdmFsdWUgPSBnZXRWYWx1ZShlbGVtZW50KTtcbiAgICBpZiAodmFsdWUgPCBtaW4pIHtcbiAgICAgIG1pbiA9IHZhbHVlO1xuICAgICAgbWluRWxlbWVudCA9IGVsZW1lbnQ7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG1pbkVsZW1lbnQ7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FtQkMsR0F1QkQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FtQkMsR0FDRCxPQUFPLFNBQVMsTUFBUyxLQUFtQixFQUFFLFFBQWdDO0VBQzVFLElBQUksYUFBYSxLQUFLLENBQUMsRUFBRTtFQUN6QixJQUFJLE1BQU07RUFFVixJQUFLLElBQUksSUFBSSxHQUFHLElBQUksTUFBTSxNQUFNLEVBQUUsSUFBSztJQUNyQyxNQUFNLFVBQVUsS0FBSyxDQUFDLEVBQUU7SUFDeEIsTUFBTSxRQUFRLFNBQVM7SUFDdkIsSUFBSSxRQUFRLEtBQUs7TUFDZixNQUFNO01BQ04sYUFBYTtJQUNmO0VBQ0Y7RUFFQSxPQUFPO0FBQ1QifQ==
// denoCacheMetadata=13428197575719491744,17986252187360938357