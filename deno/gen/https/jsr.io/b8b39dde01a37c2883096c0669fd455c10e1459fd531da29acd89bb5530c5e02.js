import { compareValues } from '../_internal/compareValues.ts';
/**
 * Sorts an array of objects based on the given `criteria` and their corresponding order directions.
 *
 * - If you provide keys, it sorts the objects by the values of those keys.
 * - If you provide functions, it sorts based on the values returned by those functions.
 *
 * The function returns the array of objects sorted in corresponding order directions.
 * If two objects have the same value for the current criterion, it uses the next criterion to determine their order.
 * If the number of orders is less than the number of criteria, it uses the last order for the rest of the criteria.
 *
 * @template T - The type of elements in the array.
 * @param {T[]} arr - The array of objects to be sorted.
 * @param {Array<((item: T) => unknown) | keyof T>} criteria  - The criteria for sorting. This can be an array of object keys or functions that return values used for sorting.
 * @param {Array<'asc' | 'desc'>} orders - An array of order directions ('asc' for ascending or 'desc' for descending).
 * @returns {T[]} - The sorted array.
 *
 * @example
 * // Sort an array of objects by 'user' in ascending order and 'age' in descending order.
 * const users = [
 *   { user: 'fred', age: 48 },
 *   { user: 'barney', age: 34 },
 *   { user: 'fred', age: 40 },
 *   { user: 'barney', age: 36 },
 * ];
 *
 * const result = orderBy(users, [obj => obj.user, 'age'], ['asc', 'desc']);
 * // result will be:
 * // [
 * //   { user: 'barney', age: 36 },
 * //   { user: 'barney', age: 34 },
 * //   { user: 'fred', age: 48 },
 * //   { user: 'fred', age: 40 },
 * // ]
 */ export function orderBy(arr, criteria, orders) {
  return arr.slice().sort((a, b)=>{
    const ordersLength = orders.length;
    for(let i = 0; i < criteria.length; i++){
      const order = ordersLength > i ? orders[i] : orders[ordersLength - 1];
      const criterion = criteria[i];
      const criterionIsFunction = typeof criterion === 'function';
      const valueA = criterionIsFunction ? criterion(a) : a[criterion];
      const valueB = criterionIsFunction ? criterion(b) : b[criterion];
      const result = compareValues(valueA, valueB, order);
      if (result !== 0) {
        return result;
      }
    }
    return 0;
  });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9hcnJheS9vcmRlckJ5LnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGNvbXBhcmVWYWx1ZXMgfSBmcm9tICcuLi9faW50ZXJuYWwvY29tcGFyZVZhbHVlcy50cyc7XG5cbi8qKlxuICogU29ydHMgYW4gYXJyYXkgb2Ygb2JqZWN0cyBiYXNlZCBvbiB0aGUgZ2l2ZW4gYGNyaXRlcmlhYCBhbmQgdGhlaXIgY29ycmVzcG9uZGluZyBvcmRlciBkaXJlY3Rpb25zLlxuICpcbiAqIC0gSWYgeW91IHByb3ZpZGUga2V5cywgaXQgc29ydHMgdGhlIG9iamVjdHMgYnkgdGhlIHZhbHVlcyBvZiB0aG9zZSBrZXlzLlxuICogLSBJZiB5b3UgcHJvdmlkZSBmdW5jdGlvbnMsIGl0IHNvcnRzIGJhc2VkIG9uIHRoZSB2YWx1ZXMgcmV0dXJuZWQgYnkgdGhvc2UgZnVuY3Rpb25zLlxuICpcbiAqIFRoZSBmdW5jdGlvbiByZXR1cm5zIHRoZSBhcnJheSBvZiBvYmplY3RzIHNvcnRlZCBpbiBjb3JyZXNwb25kaW5nIG9yZGVyIGRpcmVjdGlvbnMuXG4gKiBJZiB0d28gb2JqZWN0cyBoYXZlIHRoZSBzYW1lIHZhbHVlIGZvciB0aGUgY3VycmVudCBjcml0ZXJpb24sIGl0IHVzZXMgdGhlIG5leHQgY3JpdGVyaW9uIHRvIGRldGVybWluZSB0aGVpciBvcmRlci5cbiAqIElmIHRoZSBudW1iZXIgb2Ygb3JkZXJzIGlzIGxlc3MgdGhhbiB0aGUgbnVtYmVyIG9mIGNyaXRlcmlhLCBpdCB1c2VzIHRoZSBsYXN0IG9yZGVyIGZvciB0aGUgcmVzdCBvZiB0aGUgY3JpdGVyaWEuXG4gKlxuICogQHRlbXBsYXRlIFQgLSBUaGUgdHlwZSBvZiBlbGVtZW50cyBpbiB0aGUgYXJyYXkuXG4gKiBAcGFyYW0ge1RbXX0gYXJyIC0gVGhlIGFycmF5IG9mIG9iamVjdHMgdG8gYmUgc29ydGVkLlxuICogQHBhcmFtIHtBcnJheTwoKGl0ZW06IFQpID0+IHVua25vd24pIHwga2V5b2YgVD59IGNyaXRlcmlhICAtIFRoZSBjcml0ZXJpYSBmb3Igc29ydGluZy4gVGhpcyBjYW4gYmUgYW4gYXJyYXkgb2Ygb2JqZWN0IGtleXMgb3IgZnVuY3Rpb25zIHRoYXQgcmV0dXJuIHZhbHVlcyB1c2VkIGZvciBzb3J0aW5nLlxuICogQHBhcmFtIHtBcnJheTwnYXNjJyB8ICdkZXNjJz59IG9yZGVycyAtIEFuIGFycmF5IG9mIG9yZGVyIGRpcmVjdGlvbnMgKCdhc2MnIGZvciBhc2NlbmRpbmcgb3IgJ2Rlc2MnIGZvciBkZXNjZW5kaW5nKS5cbiAqIEByZXR1cm5zIHtUW119IC0gVGhlIHNvcnRlZCBhcnJheS5cbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gU29ydCBhbiBhcnJheSBvZiBvYmplY3RzIGJ5ICd1c2VyJyBpbiBhc2NlbmRpbmcgb3JkZXIgYW5kICdhZ2UnIGluIGRlc2NlbmRpbmcgb3JkZXIuXG4gKiBjb25zdCB1c2VycyA9IFtcbiAqICAgeyB1c2VyOiAnZnJlZCcsIGFnZTogNDggfSxcbiAqICAgeyB1c2VyOiAnYmFybmV5JywgYWdlOiAzNCB9LFxuICogICB7IHVzZXI6ICdmcmVkJywgYWdlOiA0MCB9LFxuICogICB7IHVzZXI6ICdiYXJuZXknLCBhZ2U6IDM2IH0sXG4gKiBdO1xuICpcbiAqIGNvbnN0IHJlc3VsdCA9IG9yZGVyQnkodXNlcnMsIFtvYmogPT4gb2JqLnVzZXIsICdhZ2UnXSwgWydhc2MnLCAnZGVzYyddKTtcbiAqIC8vIHJlc3VsdCB3aWxsIGJlOlxuICogLy8gW1xuICogLy8gICB7IHVzZXI6ICdiYXJuZXknLCBhZ2U6IDM2IH0sXG4gKiAvLyAgIHsgdXNlcjogJ2Jhcm5leScsIGFnZTogMzQgfSxcbiAqIC8vICAgeyB1c2VyOiAnZnJlZCcsIGFnZTogNDggfSxcbiAqIC8vICAgeyB1c2VyOiAnZnJlZCcsIGFnZTogNDAgfSxcbiAqIC8vIF1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG9yZGVyQnk8VCBleHRlbmRzIG9iamVjdD4oXG4gIGFycjogcmVhZG9ubHkgVFtdLFxuICBjcml0ZXJpYTogQXJyYXk8KChpdGVtOiBUKSA9PiB1bmtub3duKSB8IGtleW9mIFQ+LFxuICBvcmRlcnM6IEFycmF5PCdhc2MnIHwgJ2Rlc2MnPlxuKTogVFtdIHtcbiAgcmV0dXJuIGFyci5zbGljZSgpLnNvcnQoKGEsIGIpID0+IHtcbiAgICBjb25zdCBvcmRlcnNMZW5ndGggPSBvcmRlcnMubGVuZ3RoO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjcml0ZXJpYS5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3Qgb3JkZXIgPSBvcmRlcnNMZW5ndGggPiBpID8gb3JkZXJzW2ldIDogb3JkZXJzW29yZGVyc0xlbmd0aCAtIDFdO1xuICAgICAgY29uc3QgY3JpdGVyaW9uID0gY3JpdGVyaWFbaV07XG4gICAgICBjb25zdCBjcml0ZXJpb25Jc0Z1bmN0aW9uID0gdHlwZW9mIGNyaXRlcmlvbiA9PT0gJ2Z1bmN0aW9uJztcblxuICAgICAgY29uc3QgdmFsdWVBID0gY3JpdGVyaW9uSXNGdW5jdGlvbiA/IGNyaXRlcmlvbihhKSA6IGFbY3JpdGVyaW9uXTtcbiAgICAgIGNvbnN0IHZhbHVlQiA9IGNyaXRlcmlvbklzRnVuY3Rpb24gPyBjcml0ZXJpb24oYikgOiBiW2NyaXRlcmlvbl07XG5cbiAgICAgIGNvbnN0IHJlc3VsdCA9IGNvbXBhcmVWYWx1ZXModmFsdWVBLCB2YWx1ZUIsIG9yZGVyKTtcblxuICAgICAgaWYgKHJlc3VsdCAhPT0gMCkge1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiAwO1xuICB9KTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLGFBQWEsUUFBUSxnQ0FBZ0M7QUFFOUQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQWlDQyxHQUNELE9BQU8sU0FBUyxRQUNkLEdBQWlCLEVBQ2pCLFFBQWlELEVBQ2pELE1BQTZCO0VBRTdCLE9BQU8sSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLENBQUMsR0FBRztJQUMxQixNQUFNLGVBQWUsT0FBTyxNQUFNO0lBRWxDLElBQUssSUFBSSxJQUFJLEdBQUcsSUFBSSxTQUFTLE1BQU0sRUFBRSxJQUFLO01BQ3hDLE1BQU0sUUFBUSxlQUFlLElBQUksTUFBTSxDQUFDLEVBQUUsR0FBRyxNQUFNLENBQUMsZUFBZSxFQUFFO01BQ3JFLE1BQU0sWUFBWSxRQUFRLENBQUMsRUFBRTtNQUM3QixNQUFNLHNCQUFzQixPQUFPLGNBQWM7TUFFakQsTUFBTSxTQUFTLHNCQUFzQixVQUFVLEtBQUssQ0FBQyxDQUFDLFVBQVU7TUFDaEUsTUFBTSxTQUFTLHNCQUFzQixVQUFVLEtBQUssQ0FBQyxDQUFDLFVBQVU7TUFFaEUsTUFBTSxTQUFTLGNBQWMsUUFBUSxRQUFRO01BRTdDLElBQUksV0FBVyxHQUFHO1FBQ2hCLE9BQU87TUFDVDtJQUNGO0lBRUEsT0FBTztFQUNUO0FBQ0YifQ==
// denoCacheMetadata=8201523008449808107,659195978358745104