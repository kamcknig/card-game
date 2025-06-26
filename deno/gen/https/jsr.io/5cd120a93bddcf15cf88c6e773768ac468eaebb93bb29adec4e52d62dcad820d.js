/**
 * Groups the elements of an array based on a provided key-generating function.
 *
 * This function takes an array and a function that generates a key from each element. It returns
 * an object where the keys are the generated keys and the values are arrays of elements that share
 * the same key.
 *
 * @template T - The type of elements in the array.
 * @template K - The type of keys.
 * @param {T[]} arr - The array to group.
 * @param {(item: T) => K} getKeyFromItem - A function that generates a key from an element.
 * @returns {Record<K, T[]>} An object where each key is associated with an array of elements that
 * share that key.
 *
 * @example
 * const array = [
 *   { category: 'fruit', name: 'apple' },
 *   { category: 'fruit', name: 'banana' },
 *   { category: 'vegetable', name: 'carrot' }
 * ];
 * const result = groupBy(array, item => item.category);
 * // result will be:
 * // {
 * //   fruit: [
 * //     { category: 'fruit', name: 'apple' },
 * //     { category: 'fruit', name: 'banana' }
 * //   ],
 * //   vegetable: [
 * //     { category: 'vegetable', name: 'carrot' }
 * //   ]
 * // }
 */ export function groupBy(arr, getKeyFromItem) {
  const result = {};
  for(let i = 0; i < arr.length; i++){
    const item = arr[i];
    const key = getKeyFromItem(item);
    if (!Object.hasOwn(result, key)) {
      result[key] = [];
    }
    result[key].push(item);
  }
  return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9hcnJheS9ncm91cEJ5LnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogR3JvdXBzIHRoZSBlbGVtZW50cyBvZiBhbiBhcnJheSBiYXNlZCBvbiBhIHByb3ZpZGVkIGtleS1nZW5lcmF0aW5nIGZ1bmN0aW9uLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gdGFrZXMgYW4gYXJyYXkgYW5kIGEgZnVuY3Rpb24gdGhhdCBnZW5lcmF0ZXMgYSBrZXkgZnJvbSBlYWNoIGVsZW1lbnQuIEl0IHJldHVybnNcbiAqIGFuIG9iamVjdCB3aGVyZSB0aGUga2V5cyBhcmUgdGhlIGdlbmVyYXRlZCBrZXlzIGFuZCB0aGUgdmFsdWVzIGFyZSBhcnJheXMgb2YgZWxlbWVudHMgdGhhdCBzaGFyZVxuICogdGhlIHNhbWUga2V5LlxuICpcbiAqIEB0ZW1wbGF0ZSBUIC0gVGhlIHR5cGUgb2YgZWxlbWVudHMgaW4gdGhlIGFycmF5LlxuICogQHRlbXBsYXRlIEsgLSBUaGUgdHlwZSBvZiBrZXlzLlxuICogQHBhcmFtIHtUW119IGFyciAtIFRoZSBhcnJheSB0byBncm91cC5cbiAqIEBwYXJhbSB7KGl0ZW06IFQpID0+IEt9IGdldEtleUZyb21JdGVtIC0gQSBmdW5jdGlvbiB0aGF0IGdlbmVyYXRlcyBhIGtleSBmcm9tIGFuIGVsZW1lbnQuXG4gKiBAcmV0dXJucyB7UmVjb3JkPEssIFRbXT59IEFuIG9iamVjdCB3aGVyZSBlYWNoIGtleSBpcyBhc3NvY2lhdGVkIHdpdGggYW4gYXJyYXkgb2YgZWxlbWVudHMgdGhhdFxuICogc2hhcmUgdGhhdCBrZXkuXG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IGFycmF5ID0gW1xuICogICB7IGNhdGVnb3J5OiAnZnJ1aXQnLCBuYW1lOiAnYXBwbGUnIH0sXG4gKiAgIHsgY2F0ZWdvcnk6ICdmcnVpdCcsIG5hbWU6ICdiYW5hbmEnIH0sXG4gKiAgIHsgY2F0ZWdvcnk6ICd2ZWdldGFibGUnLCBuYW1lOiAnY2Fycm90JyB9XG4gKiBdO1xuICogY29uc3QgcmVzdWx0ID0gZ3JvdXBCeShhcnJheSwgaXRlbSA9PiBpdGVtLmNhdGVnb3J5KTtcbiAqIC8vIHJlc3VsdCB3aWxsIGJlOlxuICogLy8ge1xuICogLy8gICBmcnVpdDogW1xuICogLy8gICAgIHsgY2F0ZWdvcnk6ICdmcnVpdCcsIG5hbWU6ICdhcHBsZScgfSxcbiAqIC8vICAgICB7IGNhdGVnb3J5OiAnZnJ1aXQnLCBuYW1lOiAnYmFuYW5hJyB9XG4gKiAvLyAgIF0sXG4gKiAvLyAgIHZlZ2V0YWJsZTogW1xuICogLy8gICAgIHsgY2F0ZWdvcnk6ICd2ZWdldGFibGUnLCBuYW1lOiAnY2Fycm90JyB9XG4gKiAvLyAgIF1cbiAqIC8vIH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdyb3VwQnk8VCwgSyBleHRlbmRzIFByb3BlcnR5S2V5PihhcnI6IHJlYWRvbmx5IFRbXSwgZ2V0S2V5RnJvbUl0ZW06IChpdGVtOiBUKSA9PiBLKTogUmVjb3JkPEssIFRbXT4ge1xuICBjb25zdCByZXN1bHQgPSB7fSBhcyBSZWNvcmQ8SywgVFtdPjtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IGFyci5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGl0ZW0gPSBhcnJbaV07XG4gICAgY29uc3Qga2V5ID0gZ2V0S2V5RnJvbUl0ZW0oaXRlbSk7XG5cbiAgICBpZiAoIU9iamVjdC5oYXNPd24ocmVzdWx0LCBrZXkpKSB7XG4gICAgICByZXN1bHRba2V5XSA9IFtdO1xuICAgIH1cblxuICAgIHJlc3VsdFtrZXldLnB1c2goaXRlbSk7XG4gIH1cblxuICByZXR1cm4gcmVzdWx0O1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBK0JDLEdBQ0QsT0FBTyxTQUFTLFFBQWtDLEdBQWlCLEVBQUUsY0FBOEI7RUFDakcsTUFBTSxTQUFTLENBQUM7RUFFaEIsSUFBSyxJQUFJLElBQUksR0FBRyxJQUFJLElBQUksTUFBTSxFQUFFLElBQUs7SUFDbkMsTUFBTSxPQUFPLEdBQUcsQ0FBQyxFQUFFO0lBQ25CLE1BQU0sTUFBTSxlQUFlO0lBRTNCLElBQUksQ0FBQyxPQUFPLE1BQU0sQ0FBQyxRQUFRLE1BQU07TUFDL0IsTUFBTSxDQUFDLElBQUksR0FBRyxFQUFFO0lBQ2xCO0lBRUEsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7RUFDbkI7RUFFQSxPQUFPO0FBQ1QifQ==
// denoCacheMetadata=4235826299345604254,8949882878211620766