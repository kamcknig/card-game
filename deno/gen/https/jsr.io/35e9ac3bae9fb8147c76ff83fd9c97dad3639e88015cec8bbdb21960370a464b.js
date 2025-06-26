import { compareValues } from '../_internal/compareValues.ts';
import { isKey } from '../_internal/isKey.ts';
import { toPath } from '../util/toPath.ts';
/**
 * Sorts an array of objects based on multiple properties and their corresponding order directions.
 *
 * This function takes an array of objects, an array of criteria to sort by, and an array of order directions.
 * It returns the sorted array, ordering by each key according to its corresponding direction ('asc' for ascending or 'desc' for descending).
 * If values for a key are equal, it moves to the next key to determine the order.
 *
 * @template T - The type of elements in the array.
 * @param {ArrayLike<T> | object | null | undefined} collection - The array of objects to be sorted.
 * @param {Criterion<T> | Array<Criterion<T>>} criteria - An array of criteria (property names or property paths or custom key functions) to sort by.
 * @param {unknown | unknown[]} orders - An array of order directions ('asc' for ascending or 'desc' for descending).
 * @param {unknown} [guard] Enables use as an iteratee for methods like `_.reduce`.
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
 * const result = orderBy(users, ['user', (item) => item.age], ['asc', 'desc']);
 * // result will be:
 * // [
 * //   { user: 'barney', age: 36 },
 * //   { user: 'barney', age: 34 },
 * //   { user: 'fred', age: 48 },
 * //   { user: 'fred', age: 40 },
 * // ]
 */ export function orderBy(collection, criteria, orders, guard) {
  if (collection == null) {
    return [];
  }
  orders = guard ? undefined : orders;
  if (!Array.isArray(collection)) {
    collection = Object.values(collection);
  }
  if (!Array.isArray(criteria)) {
    criteria = criteria == null ? [
      null
    ] : [
      criteria
    ];
  }
  if (criteria.length === 0) {
    criteria = [
      null
    ];
  }
  if (!Array.isArray(orders)) {
    orders = orders == null ? [] : [
      orders
    ];
  }
  // For Object('desc') case
  orders = orders.map((order)=>String(order));
  const getValueByNestedPath = (object, path)=>{
    let target = object;
    for(let i = 0; i < path.length && target != null; ++i){
      target = target[path[i]];
    }
    return target;
  };
  const getValueByCriterion = (criterion, object)=>{
    if (object == null || criterion == null) {
      return object;
    }
    if (typeof criterion === 'object' && 'key' in criterion) {
      if (Object.hasOwn(object, criterion.key)) {
        return object[criterion.key];
      }
      return getValueByNestedPath(object, criterion.path);
    }
    if (typeof criterion === 'function') {
      return criterion(object);
    }
    if (Array.isArray(criterion)) {
      return getValueByNestedPath(object, criterion);
    }
    if (typeof object === 'object') {
      return object[criterion];
    }
    return object;
  };
  // Prepare all cases for criteria
  const preparedCriteria = criteria.map((criterion)=>{
    // lodash handles a array with one element as a single criterion
    if (Array.isArray(criterion) && criterion.length === 1) {
      criterion = criterion[0];
    }
    if (criterion == null || typeof criterion === 'function' || Array.isArray(criterion) || isKey(criterion)) {
      return criterion;
    }
    // If criterion is not key, it has possibility to be a deep path. So we have to prepare both cases.
    return {
      key: criterion,
      path: toPath(criterion)
    };
  });
  // Array.prototype.sort() always shifts the `undefined` values to the end of the array. So we have to prevent it by using a wrapper object.
  const preparedCollection = collection.map((item)=>({
      original: item,
      criteria: preparedCriteria.map((criterion)=>getValueByCriterion(criterion, item))
    }));
  return preparedCollection.slice().sort((a, b)=>{
    for(let i = 0; i < preparedCriteria.length; i++){
      const comparedResult = compareValues(a.criteria[i], b.criteria[i], orders[i]);
      if (comparedResult !== 0) {
        return comparedResult;
      }
    }
    return 0;
  }).map((item)=>item.original);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvYXJyYXkvb3JkZXJCeS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBjb21wYXJlVmFsdWVzIH0gZnJvbSAnLi4vX2ludGVybmFsL2NvbXBhcmVWYWx1ZXMudHMnO1xuaW1wb3J0IHsgaXNLZXkgfSBmcm9tICcuLi9faW50ZXJuYWwvaXNLZXkudHMnO1xuaW1wb3J0IHsgdG9QYXRoIH0gZnJvbSAnLi4vdXRpbC90b1BhdGgudHMnO1xuXG5leHBvcnQgdHlwZSBDcml0ZXJpb248VD4gPSAoKGl0ZW06IFQpID0+IHVua25vd24pIHwgUHJvcGVydHlLZXkgfCBQcm9wZXJ0eUtleVtdIHwgbnVsbCB8IHVuZGVmaW5lZDtcbi8qKlxuICogU29ydHMgYW4gYXJyYXkgb2Ygb2JqZWN0cyBiYXNlZCBvbiBtdWx0aXBsZSBwcm9wZXJ0aWVzIGFuZCB0aGVpciBjb3JyZXNwb25kaW5nIG9yZGVyIGRpcmVjdGlvbnMuXG4gKlxuICogVGhpcyBmdW5jdGlvbiB0YWtlcyBhbiBhcnJheSBvZiBvYmplY3RzLCBhbiBhcnJheSBvZiBjcml0ZXJpYSB0byBzb3J0IGJ5LCBhbmQgYW4gYXJyYXkgb2Ygb3JkZXIgZGlyZWN0aW9ucy5cbiAqIEl0IHJldHVybnMgdGhlIHNvcnRlZCBhcnJheSwgb3JkZXJpbmcgYnkgZWFjaCBrZXkgYWNjb3JkaW5nIHRvIGl0cyBjb3JyZXNwb25kaW5nIGRpcmVjdGlvbiAoJ2FzYycgZm9yIGFzY2VuZGluZyBvciAnZGVzYycgZm9yIGRlc2NlbmRpbmcpLlxuICogSWYgdmFsdWVzIGZvciBhIGtleSBhcmUgZXF1YWwsIGl0IG1vdmVzIHRvIHRoZSBuZXh0IGtleSB0byBkZXRlcm1pbmUgdGhlIG9yZGVyLlxuICpcbiAqIEB0ZW1wbGF0ZSBUIC0gVGhlIHR5cGUgb2YgZWxlbWVudHMgaW4gdGhlIGFycmF5LlxuICogQHBhcmFtIHtBcnJheUxpa2U8VD4gfCBvYmplY3QgfCBudWxsIHwgdW5kZWZpbmVkfSBjb2xsZWN0aW9uIC0gVGhlIGFycmF5IG9mIG9iamVjdHMgdG8gYmUgc29ydGVkLlxuICogQHBhcmFtIHtDcml0ZXJpb248VD4gfCBBcnJheTxDcml0ZXJpb248VD4+fSBjcml0ZXJpYSAtIEFuIGFycmF5IG9mIGNyaXRlcmlhIChwcm9wZXJ0eSBuYW1lcyBvciBwcm9wZXJ0eSBwYXRocyBvciBjdXN0b20ga2V5IGZ1bmN0aW9ucykgdG8gc29ydCBieS5cbiAqIEBwYXJhbSB7dW5rbm93biB8IHVua25vd25bXX0gb3JkZXJzIC0gQW4gYXJyYXkgb2Ygb3JkZXIgZGlyZWN0aW9ucyAoJ2FzYycgZm9yIGFzY2VuZGluZyBvciAnZGVzYycgZm9yIGRlc2NlbmRpbmcpLlxuICogQHBhcmFtIHt1bmtub3dufSBbZ3VhcmRdIEVuYWJsZXMgdXNlIGFzIGFuIGl0ZXJhdGVlIGZvciBtZXRob2RzIGxpa2UgYF8ucmVkdWNlYC5cbiAqIEByZXR1cm5zIHtUW119IC0gVGhlIHNvcnRlZCBhcnJheS5cbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gU29ydCBhbiBhcnJheSBvZiBvYmplY3RzIGJ5ICd1c2VyJyBpbiBhc2NlbmRpbmcgb3JkZXIgYW5kICdhZ2UnIGluIGRlc2NlbmRpbmcgb3JkZXIuXG4gKiBjb25zdCB1c2VycyA9IFtcbiAqICAgeyB1c2VyOiAnZnJlZCcsIGFnZTogNDggfSxcbiAqICAgeyB1c2VyOiAnYmFybmV5JywgYWdlOiAzNCB9LFxuICogICB7IHVzZXI6ICdmcmVkJywgYWdlOiA0MCB9LFxuICogICB7IHVzZXI6ICdiYXJuZXknLCBhZ2U6IDM2IH0sXG4gKiBdO1xuICogY29uc3QgcmVzdWx0ID0gb3JkZXJCeSh1c2VycywgWyd1c2VyJywgKGl0ZW0pID0+IGl0ZW0uYWdlXSwgWydhc2MnLCAnZGVzYyddKTtcbiAqIC8vIHJlc3VsdCB3aWxsIGJlOlxuICogLy8gW1xuICogLy8gICB7IHVzZXI6ICdiYXJuZXknLCBhZ2U6IDM2IH0sXG4gKiAvLyAgIHsgdXNlcjogJ2Jhcm5leScsIGFnZTogMzQgfSxcbiAqIC8vICAgeyB1c2VyOiAnZnJlZCcsIGFnZTogNDggfSxcbiAqIC8vICAgeyB1c2VyOiAnZnJlZCcsIGFnZTogNDAgfSxcbiAqIC8vIF1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG9yZGVyQnk8VCA9IGFueT4oXG4gIGNvbGxlY3Rpb246IEFycmF5TGlrZTxUPiB8IG9iamVjdCB8IG51bGwgfCB1bmRlZmluZWQsXG4gIGNyaXRlcmlhPzogQ3JpdGVyaW9uPFQ+IHwgQXJyYXk8Q3JpdGVyaW9uPFQ+PixcbiAgb3JkZXJzPzogdW5rbm93biB8IHVua25vd25bXSxcbiAgZ3VhcmQ/OiB1bmtub3duXG4pOiBUW10ge1xuICBpZiAoY29sbGVjdGlvbiA9PSBudWxsKSB7XG4gICAgcmV0dXJuIFtdO1xuICB9XG5cbiAgb3JkZXJzID0gZ3VhcmQgPyB1bmRlZmluZWQgOiBvcmRlcnM7XG5cbiAgaWYgKCFBcnJheS5pc0FycmF5KGNvbGxlY3Rpb24pKSB7XG4gICAgY29sbGVjdGlvbiA9IE9iamVjdC52YWx1ZXMoY29sbGVjdGlvbik7XG4gIH1cblxuICBpZiAoIUFycmF5LmlzQXJyYXkoY3JpdGVyaWEpKSB7XG4gICAgY3JpdGVyaWEgPSBjcml0ZXJpYSA9PSBudWxsID8gW251bGxdIDogW2NyaXRlcmlhXTtcbiAgfVxuICBpZiAoY3JpdGVyaWEubGVuZ3RoID09PSAwKSB7XG4gICAgY3JpdGVyaWEgPSBbbnVsbF07XG4gIH1cblxuICBpZiAoIUFycmF5LmlzQXJyYXkob3JkZXJzKSkge1xuICAgIG9yZGVycyA9IG9yZGVycyA9PSBudWxsID8gW10gOiBbb3JkZXJzXTtcbiAgfVxuXG4gIC8vIEZvciBPYmplY3QoJ2Rlc2MnKSBjYXNlXG4gIG9yZGVycyA9IChvcmRlcnMgYXMgdW5rbm93bltdKS5tYXAob3JkZXIgPT4gU3RyaW5nKG9yZGVyKSk7XG5cbiAgY29uc3QgZ2V0VmFsdWVCeU5lc3RlZFBhdGggPSAob2JqZWN0OiBvYmplY3QsIHBhdGg6IFByb3BlcnR5S2V5W10pID0+IHtcbiAgICBsZXQgdGFyZ2V0OiBvYmplY3QgPSBvYmplY3Q7XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBhdGgubGVuZ3RoICYmIHRhcmdldCAhPSBudWxsOyArK2kpIHtcbiAgICAgIHRhcmdldCA9IHRhcmdldFtwYXRoW2ldIGFzIGtleW9mIHR5cGVvZiB0YXJnZXRdO1xuICAgIH1cblxuICAgIHJldHVybiB0YXJnZXQ7XG4gIH07XG5cbiAgY29uc3QgZ2V0VmFsdWVCeUNyaXRlcmlvbiA9IChjcml0ZXJpb246IENyaXRlcmlvbjxUPiB8IHsga2V5OiBQcm9wZXJ0eUtleTsgcGF0aDogc3RyaW5nW10gfSwgb2JqZWN0OiBUKSA9PiB7XG4gICAgaWYgKG9iamVjdCA9PSBudWxsIHx8IGNyaXRlcmlvbiA9PSBudWxsKSB7XG4gICAgICByZXR1cm4gb2JqZWN0O1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgY3JpdGVyaW9uID09PSAnb2JqZWN0JyAmJiAna2V5JyBpbiBjcml0ZXJpb24pIHtcbiAgICAgIGlmIChPYmplY3QuaGFzT3duKG9iamVjdCwgY3JpdGVyaW9uLmtleSkpIHtcbiAgICAgICAgcmV0dXJuIG9iamVjdFtjcml0ZXJpb24ua2V5IGFzIGtleW9mIHR5cGVvZiBvYmplY3RdO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gZ2V0VmFsdWVCeU5lc3RlZFBhdGgob2JqZWN0LCBjcml0ZXJpb24ucGF0aCk7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBjcml0ZXJpb24gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHJldHVybiBjcml0ZXJpb24ob2JqZWN0KTtcbiAgICB9XG5cbiAgICBpZiAoQXJyYXkuaXNBcnJheShjcml0ZXJpb24pKSB7XG4gICAgICByZXR1cm4gZ2V0VmFsdWVCeU5lc3RlZFBhdGgob2JqZWN0LCBjcml0ZXJpb24pO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2Ygb2JqZWN0ID09PSAnb2JqZWN0Jykge1xuICAgICAgcmV0dXJuIG9iamVjdFtjcml0ZXJpb24gYXMga2V5b2YgdHlwZW9mIG9iamVjdF07XG4gICAgfVxuXG4gICAgcmV0dXJuIG9iamVjdDtcbiAgfTtcblxuICAvLyBQcmVwYXJlIGFsbCBjYXNlcyBmb3IgY3JpdGVyaWFcbiAgY29uc3QgcHJlcGFyZWRDcml0ZXJpYSA9IGNyaXRlcmlhLm1hcChjcml0ZXJpb24gPT4ge1xuICAgIC8vIGxvZGFzaCBoYW5kbGVzIGEgYXJyYXkgd2l0aCBvbmUgZWxlbWVudCBhcyBhIHNpbmdsZSBjcml0ZXJpb25cbiAgICBpZiAoQXJyYXkuaXNBcnJheShjcml0ZXJpb24pICYmIGNyaXRlcmlvbi5sZW5ndGggPT09IDEpIHtcbiAgICAgIGNyaXRlcmlvbiA9IGNyaXRlcmlvblswXTtcbiAgICB9XG5cbiAgICBpZiAoY3JpdGVyaW9uID09IG51bGwgfHwgdHlwZW9mIGNyaXRlcmlvbiA9PT0gJ2Z1bmN0aW9uJyB8fCBBcnJheS5pc0FycmF5KGNyaXRlcmlvbikgfHwgaXNLZXkoY3JpdGVyaW9uKSkge1xuICAgICAgcmV0dXJuIGNyaXRlcmlvbjtcbiAgICB9XG5cbiAgICAvLyBJZiBjcml0ZXJpb24gaXMgbm90IGtleSwgaXQgaGFzIHBvc3NpYmlsaXR5IHRvIGJlIGEgZGVlcCBwYXRoLiBTbyB3ZSBoYXZlIHRvIHByZXBhcmUgYm90aCBjYXNlcy5cbiAgICByZXR1cm4geyBrZXk6IGNyaXRlcmlvbiwgcGF0aDogdG9QYXRoKGNyaXRlcmlvbikgfTtcbiAgfSk7XG5cbiAgLy8gQXJyYXkucHJvdG90eXBlLnNvcnQoKSBhbHdheXMgc2hpZnRzIHRoZSBgdW5kZWZpbmVkYCB2YWx1ZXMgdG8gdGhlIGVuZCBvZiB0aGUgYXJyYXkuIFNvIHdlIGhhdmUgdG8gcHJldmVudCBpdCBieSB1c2luZyBhIHdyYXBwZXIgb2JqZWN0LlxuICBjb25zdCBwcmVwYXJlZENvbGxlY3Rpb24gPSAoY29sbGVjdGlvbiBhcyBUW10pLm1hcChpdGVtID0+ICh7XG4gICAgb3JpZ2luYWw6IGl0ZW0sXG4gICAgY3JpdGVyaWE6IHByZXBhcmVkQ3JpdGVyaWEubWFwKGNyaXRlcmlvbiA9PiBnZXRWYWx1ZUJ5Q3JpdGVyaW9uKGNyaXRlcmlvbiwgaXRlbSkpLFxuICB9KSk7XG5cbiAgcmV0dXJuIHByZXBhcmVkQ29sbGVjdGlvblxuICAgIC5zbGljZSgpXG4gICAgLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcHJlcGFyZWRDcml0ZXJpYS5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBjb21wYXJlZFJlc3VsdCA9IGNvbXBhcmVWYWx1ZXMoYS5jcml0ZXJpYVtpXSwgYi5jcml0ZXJpYVtpXSwgKG9yZGVycyBhcyBzdHJpbmdbXSlbaV0pO1xuXG4gICAgICAgIGlmIChjb21wYXJlZFJlc3VsdCAhPT0gMCkge1xuICAgICAgICAgIHJldHVybiBjb21wYXJlZFJlc3VsdDtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gMDtcbiAgICB9KVxuICAgIC5tYXAoaXRlbSA9PiBpdGVtLm9yaWdpbmFsKTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLGFBQWEsUUFBUSxnQ0FBZ0M7QUFDOUQsU0FBUyxLQUFLLFFBQVEsd0JBQXdCO0FBQzlDLFNBQVMsTUFBTSxRQUFRLG9CQUFvQjtBQUczQzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBOEJDLEdBQ0QsT0FBTyxTQUFTLFFBQ2QsVUFBb0QsRUFDcEQsUUFBNkMsRUFDN0MsTUFBNEIsRUFDNUIsS0FBZTtFQUVmLElBQUksY0FBYyxNQUFNO0lBQ3RCLE9BQU8sRUFBRTtFQUNYO0VBRUEsU0FBUyxRQUFRLFlBQVk7RUFFN0IsSUFBSSxDQUFDLE1BQU0sT0FBTyxDQUFDLGFBQWE7SUFDOUIsYUFBYSxPQUFPLE1BQU0sQ0FBQztFQUM3QjtFQUVBLElBQUksQ0FBQyxNQUFNLE9BQU8sQ0FBQyxXQUFXO0lBQzVCLFdBQVcsWUFBWSxPQUFPO01BQUM7S0FBSyxHQUFHO01B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
// denoCacheMetadata=1455608283535208860,12780655140179081351