/**
 * Finds the element in an array that has the maximum value when applying
 * the `getValue` function to each element.
 *
 * @template T - The type of elements in the array.
 * @param {[T, ...T[]]} items The nonempty array of elements to search.
 * @param {(element: T) => number} getValue A function that selects a numeric value from each element.
 * @returns {T} The element with the maximum value as determined by the `getValue` function.
 * @example
 * maxBy([{ a: 1 }, { a: 2 }, { a: 3 }], x => x.a); // Returns: { a: 3 }
 * maxBy([], x => x.a); // Returns: undefined
 * maxBy(
 *   [
 *     { name: 'john', age: 30 },
 *     { name: 'jane', age: 28 },
 *     { name: 'joe', age: 26 },
 *   ],
 *   x => x.age
 * ); // Returns: { name: 'john', age: 30 }
 */ /**
 * Finds the element in an array that has the maximum value when applying
 * the `getValue` function to each element.
 *
 * @template T - The type of elements in the array.
 * @param {T[]} items The array of elements to search.
 * @param {(element: T) => number} getValue A function that selects a numeric value from each element.
 * @returns {T | undefined} The element with the maximum value as determined by the `getValue` function.
 * @example
 * maxBy([{ a: 1 }, { a: 2 }, { a: 3 }], x => x.a); // Returns: { a: 3 }
 * maxBy([], x => x.a); // Returns: undefined
 * maxBy(
 *   [
 *     { name: 'john', age: 30 },
 *     { name: 'jane', age: 28 },
 *     { name: 'joe', age: 26 },
 *   ],
 *   x => x.age
 * ); // Returns: { name: 'john', age: 30 }
 */ export function maxBy(items, getValue) {
  let maxElement = items[0];
  let max = -Infinity;
  for(let i = 0; i < items.length; i++){
    const element = items[i];
    const value = getValue(element);
    if (value > max) {
      max = value;
      maxElement = element;
    }
  }
  return maxElement;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9hcnJheS9tYXhCeS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEZpbmRzIHRoZSBlbGVtZW50IGluIGFuIGFycmF5IHRoYXQgaGFzIHRoZSBtYXhpbXVtIHZhbHVlIHdoZW4gYXBwbHlpbmdcbiAqIHRoZSBgZ2V0VmFsdWVgIGZ1bmN0aW9uIHRvIGVhY2ggZWxlbWVudC5cbiAqXG4gKiBAdGVtcGxhdGUgVCAtIFRoZSB0eXBlIG9mIGVsZW1lbnRzIGluIHRoZSBhcnJheS5cbiAqIEBwYXJhbSB7W1QsIC4uLlRbXV19IGl0ZW1zIFRoZSBub25lbXB0eSBhcnJheSBvZiBlbGVtZW50cyB0byBzZWFyY2guXG4gKiBAcGFyYW0geyhlbGVtZW50OiBUKSA9PiBudW1iZXJ9IGdldFZhbHVlIEEgZnVuY3Rpb24gdGhhdCBzZWxlY3RzIGEgbnVtZXJpYyB2YWx1ZSBmcm9tIGVhY2ggZWxlbWVudC5cbiAqIEByZXR1cm5zIHtUfSBUaGUgZWxlbWVudCB3aXRoIHRoZSBtYXhpbXVtIHZhbHVlIGFzIGRldGVybWluZWQgYnkgdGhlIGBnZXRWYWx1ZWAgZnVuY3Rpb24uXG4gKiBAZXhhbXBsZVxuICogbWF4QnkoW3sgYTogMSB9LCB7IGE6IDIgfSwgeyBhOiAzIH1dLCB4ID0+IHguYSk7IC8vIFJldHVybnM6IHsgYTogMyB9XG4gKiBtYXhCeShbXSwgeCA9PiB4LmEpOyAvLyBSZXR1cm5zOiB1bmRlZmluZWRcbiAqIG1heEJ5KFxuICogICBbXG4gKiAgICAgeyBuYW1lOiAnam9obicsIGFnZTogMzAgfSxcbiAqICAgICB7IG5hbWU6ICdqYW5lJywgYWdlOiAyOCB9LFxuICogICAgIHsgbmFtZTogJ2pvZScsIGFnZTogMjYgfSxcbiAqICAgXSxcbiAqICAgeCA9PiB4LmFnZVxuICogKTsgLy8gUmV0dXJuczogeyBuYW1lOiAnam9obicsIGFnZTogMzAgfVxuICovXG5leHBvcnQgZnVuY3Rpb24gbWF4Qnk8VD4oaXRlbXM6IHJlYWRvbmx5IFtULCAuLi5UW11dLCBnZXRWYWx1ZTogKGVsZW1lbnQ6IFQpID0+IG51bWJlcik6IFQ7XG4vKipcbiAqIEZpbmRzIHRoZSBlbGVtZW50IGluIGFuIGFycmF5IHRoYXQgaGFzIHRoZSBtYXhpbXVtIHZhbHVlIHdoZW4gYXBwbHlpbmdcbiAqIHRoZSBgZ2V0VmFsdWVgIGZ1bmN0aW9uIHRvIGVhY2ggZWxlbWVudC5cbiAqXG4gKiBAdGVtcGxhdGUgVCAtIFRoZSB0eXBlIG9mIGVsZW1lbnRzIGluIHRoZSBhcnJheS5cbiAqIEBwYXJhbSB7VFtdfSBpdGVtcyBUaGUgYXJyYXkgb2YgZWxlbWVudHMgdG8gc2VhcmNoLlxuICogQHBhcmFtIHsoZWxlbWVudDogVCkgPT4gbnVtYmVyfSBnZXRWYWx1ZSBBIGZ1bmN0aW9uIHRoYXQgc2VsZWN0cyBhIG51bWVyaWMgdmFsdWUgZnJvbSBlYWNoIGVsZW1lbnQuXG4gKiBAcmV0dXJucyB7VCB8IHVuZGVmaW5lZH0gVGhlIGVsZW1lbnQgd2l0aCB0aGUgbWF4aW11bSB2YWx1ZSBhcyBkZXRlcm1pbmVkIGJ5IHRoZSBgZ2V0VmFsdWVgIGZ1bmN0aW9uLlxuICogQGV4YW1wbGVcbiAqIG1heEJ5KFt7IGE6IDEgfSwgeyBhOiAyIH0sIHsgYTogMyB9XSwgeCA9PiB4LmEpOyAvLyBSZXR1cm5zOiB7IGE6IDMgfVxuICogbWF4QnkoW10sIHggPT4geC5hKTsgLy8gUmV0dXJuczogdW5kZWZpbmVkXG4gKiBtYXhCeShcbiAqICAgW1xuICogICAgIHsgbmFtZTogJ2pvaG4nLCBhZ2U6IDMwIH0sXG4gKiAgICAgeyBuYW1lOiAnamFuZScsIGFnZTogMjggfSxcbiAqICAgICB7IG5hbWU6ICdqb2UnLCBhZ2U6IDI2IH0sXG4gKiAgIF0sXG4gKiAgIHggPT4geC5hZ2VcbiAqICk7IC8vIFJldHVybnM6IHsgbmFtZTogJ2pvaG4nLCBhZ2U6IDMwIH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1heEJ5PFQ+KGl0ZW1zOiByZWFkb25seSBUW10sIGdldFZhbHVlOiAoZWxlbWVudDogVCkgPT4gbnVtYmVyKTogVCB8IHVuZGVmaW5lZDtcbi8qKlxuICogRmluZHMgdGhlIGVsZW1lbnQgaW4gYW4gYXJyYXkgdGhhdCBoYXMgdGhlIG1heGltdW0gdmFsdWUgd2hlbiBhcHBseWluZ1xuICogdGhlIGBnZXRWYWx1ZWAgZnVuY3Rpb24gdG8gZWFjaCBlbGVtZW50LlxuICpcbiAqIEB0ZW1wbGF0ZSBUIC0gVGhlIHR5cGUgb2YgZWxlbWVudHMgaW4gdGhlIGFycmF5LlxuICogQHBhcmFtIHtUW119IGl0ZW1zIFRoZSBhcnJheSBvZiBlbGVtZW50cyB0byBzZWFyY2guXG4gKiBAcGFyYW0geyhlbGVtZW50OiBUKSA9PiBudW1iZXJ9IGdldFZhbHVlIEEgZnVuY3Rpb24gdGhhdCBzZWxlY3RzIGEgbnVtZXJpYyB2YWx1ZSBmcm9tIGVhY2ggZWxlbWVudC5cbiAqIEByZXR1cm5zIHtUIHwgdW5kZWZpbmVkfSBUaGUgZWxlbWVudCB3aXRoIHRoZSBtYXhpbXVtIHZhbHVlIGFzIGRldGVybWluZWQgYnkgdGhlIGBnZXRWYWx1ZWAgZnVuY3Rpb24uXG4gKiBAZXhhbXBsZVxuICogbWF4QnkoW3sgYTogMSB9LCB7IGE6IDIgfSwgeyBhOiAzIH1dLCB4ID0+IHguYSk7IC8vIFJldHVybnM6IHsgYTogMyB9XG4gKiBtYXhCeShbXSwgeCA9PiB4LmEpOyAvLyBSZXR1cm5zOiB1bmRlZmluZWRcbiAqIG1heEJ5KFxuICogICBbXG4gKiAgICAgeyBuYW1lOiAnam9obicsIGFnZTogMzAgfSxcbiAqICAgICB7IG5hbWU6ICdqYW5lJywgYWdlOiAyOCB9LFxuICogICAgIHsgbmFtZTogJ2pvZScsIGFnZTogMjYgfSxcbiAqICAgXSxcbiAqICAgeCA9PiB4LmFnZVxuICogKTsgLy8gUmV0dXJuczogeyBuYW1lOiAnam9obicsIGFnZTogMzAgfVxuICovXG5leHBvcnQgZnVuY3Rpb24gbWF4Qnk8VD4oaXRlbXM6IHJlYWRvbmx5IFRbXSwgZ2V0VmFsdWU6IChlbGVtZW50OiBUKSA9PiBudW1iZXIpOiBUIHtcbiAgbGV0IG1heEVsZW1lbnQgPSBpdGVtc1swXTtcbiAgbGV0IG1heCA9IC1JbmZpbml0eTtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IGl0ZW1zLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgZWxlbWVudCA9IGl0ZW1zW2ldO1xuICAgIGNvbnN0IHZhbHVlID0gZ2V0VmFsdWUoZWxlbWVudCk7XG4gICAgaWYgKHZhbHVlID4gbWF4KSB7XG4gICAgICBtYXggPSB2YWx1ZTtcbiAgICAgIG1heEVsZW1lbnQgPSBlbGVtZW50O1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBtYXhFbGVtZW50O1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBbUJDLEdBdUJEOzs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBbUJDLEdBQ0QsT0FBTyxTQUFTLE1BQVMsS0FBbUIsRUFBRSxRQUFnQztFQUM1RSxJQUFJLGFBQWEsS0FBSyxDQUFDLEVBQUU7RUFDekIsSUFBSSxNQUFNLENBQUM7RUFFWCxJQUFLLElBQUksSUFBSSxHQUFHLElBQUksTUFBTSxNQUFNLEVBQUUsSUFBSztJQUNyQyxNQUFNLFVBQVUsS0FBSyxDQUFDLEVBQUU7SUFDeEIsTUFBTSxRQUFRLFNBQVM7SUFDdkIsSUFBSSxRQUFRLEtBQUs7TUFDZixNQUFNO01BQ04sYUFBYTtJQUNmO0VBQ0Y7RUFFQSxPQUFPO0FBQ1QifQ==
// denoCacheMetadata=17293091512522073503,1386080023218146848