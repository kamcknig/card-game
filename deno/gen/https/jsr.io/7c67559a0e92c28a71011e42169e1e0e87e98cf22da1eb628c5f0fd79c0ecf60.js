/**
 * Finds the key of the first element in the object that satisfies the provided testing function.
 *
 * @param {T} obj - The object to search.
 * @param {(value: T[keyof T], key: keyof T, obj: T) => boolean} predicate - The function to execute on each value in the object. It takes three arguments:
 *   - value: The current value being processed in the object.
 *   - key: The key of the current value being processed in the object.
 *   - obj: The object that findKey was called upon.
 * @returns {keyof T | undefined} The key of the first element in the object that passes the test, or undefined if no element passes.
 *
 * @example
 * const users = {
 *   'barney':  { 'age': 36, 'active': true },
 *   'fred':    { 'age': 40, 'active': false },
 *   'pebbles': { 'age': 1,  'active': true }
 * };
 * findKey(users, function(o) { return o.age < 40; }); => 'barney'
 */ export function findKey(obj, predicate) {
  const keys = Object.keys(obj);
  return keys.find((key)=>predicate(obj[key], key, obj));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9vYmplY3QvZmluZEtleS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEZpbmRzIHRoZSBrZXkgb2YgdGhlIGZpcnN0IGVsZW1lbnQgaW4gdGhlIG9iamVjdCB0aGF0IHNhdGlzZmllcyB0aGUgcHJvdmlkZWQgdGVzdGluZyBmdW5jdGlvbi5cbiAqXG4gKiBAcGFyYW0ge1R9IG9iaiAtIFRoZSBvYmplY3QgdG8gc2VhcmNoLlxuICogQHBhcmFtIHsodmFsdWU6IFRba2V5b2YgVF0sIGtleToga2V5b2YgVCwgb2JqOiBUKSA9PiBib29sZWFufSBwcmVkaWNhdGUgLSBUaGUgZnVuY3Rpb24gdG8gZXhlY3V0ZSBvbiBlYWNoIHZhbHVlIGluIHRoZSBvYmplY3QuIEl0IHRha2VzIHRocmVlIGFyZ3VtZW50czpcbiAqICAgLSB2YWx1ZTogVGhlIGN1cnJlbnQgdmFsdWUgYmVpbmcgcHJvY2Vzc2VkIGluIHRoZSBvYmplY3QuXG4gKiAgIC0ga2V5OiBUaGUga2V5IG9mIHRoZSBjdXJyZW50IHZhbHVlIGJlaW5nIHByb2Nlc3NlZCBpbiB0aGUgb2JqZWN0LlxuICogICAtIG9iajogVGhlIG9iamVjdCB0aGF0IGZpbmRLZXkgd2FzIGNhbGxlZCB1cG9uLlxuICogQHJldHVybnMge2tleW9mIFQgfCB1bmRlZmluZWR9IFRoZSBrZXkgb2YgdGhlIGZpcnN0IGVsZW1lbnQgaW4gdGhlIG9iamVjdCB0aGF0IHBhc3NlcyB0aGUgdGVzdCwgb3IgdW5kZWZpbmVkIGlmIG5vIGVsZW1lbnQgcGFzc2VzLlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCB1c2VycyA9IHtcbiAqICAgJ2Jhcm5leSc6ICB7ICdhZ2UnOiAzNiwgJ2FjdGl2ZSc6IHRydWUgfSxcbiAqICAgJ2ZyZWQnOiAgICB7ICdhZ2UnOiA0MCwgJ2FjdGl2ZSc6IGZhbHNlIH0sXG4gKiAgICdwZWJibGVzJzogeyAnYWdlJzogMSwgICdhY3RpdmUnOiB0cnVlIH1cbiAqIH07XG4gKiBmaW5kS2V5KHVzZXJzLCBmdW5jdGlvbihvKSB7IHJldHVybiBvLmFnZSA8IDQwOyB9KTsgPT4gJ2Jhcm5leSdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGZpbmRLZXk8VCBleHRlbmRzIFJlY29yZDxhbnksIGFueT4+KFxuICBvYmo6IFQsXG4gIHByZWRpY2F0ZTogKHZhbHVlOiBUW2tleW9mIFRdLCBrZXk6IGtleW9mIFQsIG9iajogVCkgPT4gYm9vbGVhblxuKToga2V5b2YgVCB8IHVuZGVmaW5lZCB7XG4gIGNvbnN0IGtleXMgPSBPYmplY3Qua2V5cyhvYmopIGFzIEFycmF5PGtleW9mIFQ+O1xuXG4gIHJldHVybiBrZXlzLmZpbmQoa2V5ID0+IHByZWRpY2F0ZShvYmpba2V5XSwga2V5LCBvYmopKTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FpQkMsR0FDRCxPQUFPLFNBQVMsUUFDZCxHQUFNLEVBQ04sU0FBK0Q7RUFFL0QsTUFBTSxPQUFPLE9BQU8sSUFBSSxDQUFDO0VBRXpCLE9BQU8sS0FBSyxJQUFJLENBQUMsQ0FBQSxNQUFPLFVBQVUsR0FBRyxDQUFDLElBQUksRUFBRSxLQUFLO0FBQ25EIn0=
// denoCacheMetadata=7866788081870854260,16122014130281158376