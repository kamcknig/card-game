import { maxBy as maxByToolkit } from '../../array/maxBy.ts';
import { iteratee as iterateeToolkit } from '../util/iteratee.ts';
/**
 * Finds the element in an array that has the maximum value when applying
 * the `iteratee` to each element.
 *
 * @template T - The type of elements in the array.
 * @param {T[]} items The array of elements to search.
 * @param {((element: T) => number) | keyof T | [keyof T, unknown] | Partial<T>} iteratee
 * The criteria used to determine the maximum value.
 *  - If a **function** is provided, it extracts a numeric value from each element.
 *  - If a **string** is provided, it is treated as a key to extract values from the objects.
 *  - If a **[key, value]** pair is provided, it matches elements with the specified key-value pair.
 *  - If an **object** is provided, it matches elements that contain the specified properties.
 * @returns {T | undefined} The element with the maximum value as determined by the `iteratee`.
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
 * maxBy([{ a: 1 }, { a: 2 }], 'a'); // Returns: { a: 2 }
 * maxBy([{ a: 1 }, { a: 2 }], ['a', 1]); // Returns: { a: 1 }
 * maxBy([{ a: 1 }, { a: 2 }], { a: 1 }); // Returns: { a: 1 }
 */ export function maxBy(items, iteratee) {
  if (items == null) {
    return undefined;
  }
  return maxByToolkit(Array.from(items), iterateeToolkit(iteratee));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvbWF0aC9tYXhCeS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBtYXhCeSBhcyBtYXhCeVRvb2xraXQgfSBmcm9tICcuLi8uLi9hcnJheS9tYXhCeS50cyc7XG5pbXBvcnQgeyBpdGVyYXRlZSBhcyBpdGVyYXRlZVRvb2xraXQgfSBmcm9tICcuLi91dGlsL2l0ZXJhdGVlLnRzJztcblxuLyoqXG4gKiBGaW5kcyB0aGUgZWxlbWVudCBpbiBhbiBhcnJheSB0aGF0IGhhcyB0aGUgbWF4aW11bSB2YWx1ZSB3aGVuIGFwcGx5aW5nXG4gKiB0aGUgYGl0ZXJhdGVlYCB0byBlYWNoIGVsZW1lbnQuXG4gKlxuICogQHRlbXBsYXRlIFQgLSBUaGUgdHlwZSBvZiBlbGVtZW50cyBpbiB0aGUgYXJyYXkuXG4gKiBAcGFyYW0ge1RbXX0gaXRlbXMgVGhlIGFycmF5IG9mIGVsZW1lbnRzIHRvIHNlYXJjaC5cbiAqIEBwYXJhbSB7KChlbGVtZW50OiBUKSA9PiBudW1iZXIpIHwga2V5b2YgVCB8IFtrZXlvZiBULCB1bmtub3duXSB8IFBhcnRpYWw8VD59IGl0ZXJhdGVlXG4gKiBUaGUgY3JpdGVyaWEgdXNlZCB0byBkZXRlcm1pbmUgdGhlIG1heGltdW0gdmFsdWUuXG4gKiAgLSBJZiBhICoqZnVuY3Rpb24qKiBpcyBwcm92aWRlZCwgaXQgZXh0cmFjdHMgYSBudW1lcmljIHZhbHVlIGZyb20gZWFjaCBlbGVtZW50LlxuICogIC0gSWYgYSAqKnN0cmluZyoqIGlzIHByb3ZpZGVkLCBpdCBpcyB0cmVhdGVkIGFzIGEga2V5IHRvIGV4dHJhY3QgdmFsdWVzIGZyb20gdGhlIG9iamVjdHMuXG4gKiAgLSBJZiBhICoqW2tleSwgdmFsdWVdKiogcGFpciBpcyBwcm92aWRlZCwgaXQgbWF0Y2hlcyBlbGVtZW50cyB3aXRoIHRoZSBzcGVjaWZpZWQga2V5LXZhbHVlIHBhaXIuXG4gKiAgLSBJZiBhbiAqKm9iamVjdCoqIGlzIHByb3ZpZGVkLCBpdCBtYXRjaGVzIGVsZW1lbnRzIHRoYXQgY29udGFpbiB0aGUgc3BlY2lmaWVkIHByb3BlcnRpZXMuXG4gKiBAcmV0dXJucyB7VCB8IHVuZGVmaW5lZH0gVGhlIGVsZW1lbnQgd2l0aCB0aGUgbWF4aW11bSB2YWx1ZSBhcyBkZXRlcm1pbmVkIGJ5IHRoZSBgaXRlcmF0ZWVgLlxuICogQGV4YW1wbGVcbiAqIG1heEJ5KFt7IGE6IDEgfSwgeyBhOiAyIH0sIHsgYTogMyB9XSwgeCA9PiB4LmEpOyAvLyBSZXR1cm5zOiB7IGE6IDMgfVxuICogbWF4QnkoW10sIHggPT4geC5hKTsgLy8gUmV0dXJuczogdW5kZWZpbmVkXG4gKiBtYXhCeShcbiAqICAgW1xuICogICAgIHsgbmFtZTogJ2pvaG4nLCBhZ2U6IDMwIH0sXG4gKiAgICAgeyBuYW1lOiAnamFuZScsIGFnZTogMjggfSxcbiAqICAgICB7IG5hbWU6ICdqb2UnLCBhZ2U6IDI2IH0sXG4gKiAgIF0sXG4gKiAgIHggPT4geC5hZ2VcbiAqICk7IC8vIFJldHVybnM6IHsgbmFtZTogJ2pvaG4nLCBhZ2U6IDMwIH1cbiAqIG1heEJ5KFt7IGE6IDEgfSwgeyBhOiAyIH1dLCAnYScpOyAvLyBSZXR1cm5zOiB7IGE6IDIgfVxuICogbWF4QnkoW3sgYTogMSB9LCB7IGE6IDIgfV0sIFsnYScsIDFdKTsgLy8gUmV0dXJuczogeyBhOiAxIH1cbiAqIG1heEJ5KFt7IGE6IDEgfSwgeyBhOiAyIH1dLCB7IGE6IDEgfSk7IC8vIFJldHVybnM6IHsgYTogMSB9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBtYXhCeTxUPihcbiAgaXRlbXM6IEFycmF5TGlrZTxUPiB8IG51bGwgfCB1bmRlZmluZWQsXG4gIGl0ZXJhdGVlOiAoKGVsZW1lbnQ6IFQpID0+IG51bWJlcikgfCBrZXlvZiBUIHwgW2tleW9mIFQsIHVua25vd25dIHwgUGFydGlhbDxUPlxuKTogVCB8IHVuZGVmaW5lZCB7XG4gIGlmIChpdGVtcyA9PSBudWxsKSB7XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxuXG4gIHJldHVybiBtYXhCeVRvb2xraXQoQXJyYXkuZnJvbShpdGVtcyksIGl0ZXJhdGVlVG9vbGtpdChpdGVyYXRlZSkpO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsU0FBUyxZQUFZLFFBQVEsdUJBQXVCO0FBQzdELFNBQVMsWUFBWSxlQUFlLFFBQVEsc0JBQXNCO0FBRWxFOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0EyQkMsR0FDRCxPQUFPLFNBQVMsTUFDZCxLQUFzQyxFQUN0QyxRQUE4RTtFQUU5RSxJQUFJLFNBQVMsTUFBTTtJQUNqQixPQUFPO0VBQ1Q7RUFFQSxPQUFPLGFBQWEsTUFBTSxJQUFJLENBQUMsUUFBUSxnQkFBZ0I7QUFDekQifQ==
// denoCacheMetadata=12134673950161812108,934507000478316646