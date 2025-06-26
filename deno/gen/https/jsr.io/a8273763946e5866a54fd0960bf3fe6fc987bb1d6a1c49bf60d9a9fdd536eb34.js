/**
 * Creates a new object composed of the properties that satisfy the predicate function.
 *
 * This function takes an object and a predicate function, and returns a new object that
 * includes only the properties for which the predicate function returns true.
 *
 * @template T - The type of object.
 * @param {T} obj - The object to pick properties from.
 * @param {(value: T[keyof T], key: keyof T) => boolean} shouldPick - A predicate function that determines
 * whether a property should be picked. It takes the property's key and value as arguments and returns `true`
 * if the property should be picked, and `false` otherwise.
 * @returns {Partial<T>} A new object with the properties that satisfy the predicate function.
 *
 * @example
 * const obj = { a: 1, b: 'pick', c: 3 };
 * const shouldPick = (value) => typeof value === 'string';
 * const result = pickBy(obj, shouldPick);
 * // result will be { b: 'pick' }
 */ export function pickBy(obj, shouldPick) {
  const result = {};
  const keys = Object.keys(obj);
  for(let i = 0; i < keys.length; i++){
    const key = keys[i];
    const value = obj[key];
    if (shouldPick(value, key)) {
      result[key] = value;
    }
  }
  return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9vYmplY3QvcGlja0J5LnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQ3JlYXRlcyBhIG5ldyBvYmplY3QgY29tcG9zZWQgb2YgdGhlIHByb3BlcnRpZXMgdGhhdCBzYXRpc2Z5IHRoZSBwcmVkaWNhdGUgZnVuY3Rpb24uXG4gKlxuICogVGhpcyBmdW5jdGlvbiB0YWtlcyBhbiBvYmplY3QgYW5kIGEgcHJlZGljYXRlIGZ1bmN0aW9uLCBhbmQgcmV0dXJucyBhIG5ldyBvYmplY3QgdGhhdFxuICogaW5jbHVkZXMgb25seSB0aGUgcHJvcGVydGllcyBmb3Igd2hpY2ggdGhlIHByZWRpY2F0ZSBmdW5jdGlvbiByZXR1cm5zIHRydWUuXG4gKlxuICogQHRlbXBsYXRlIFQgLSBUaGUgdHlwZSBvZiBvYmplY3QuXG4gKiBAcGFyYW0ge1R9IG9iaiAtIFRoZSBvYmplY3QgdG8gcGljayBwcm9wZXJ0aWVzIGZyb20uXG4gKiBAcGFyYW0geyh2YWx1ZTogVFtrZXlvZiBUXSwga2V5OiBrZXlvZiBUKSA9PiBib29sZWFufSBzaG91bGRQaWNrIC0gQSBwcmVkaWNhdGUgZnVuY3Rpb24gdGhhdCBkZXRlcm1pbmVzXG4gKiB3aGV0aGVyIGEgcHJvcGVydHkgc2hvdWxkIGJlIHBpY2tlZC4gSXQgdGFrZXMgdGhlIHByb3BlcnR5J3Mga2V5IGFuZCB2YWx1ZSBhcyBhcmd1bWVudHMgYW5kIHJldHVybnMgYHRydWVgXG4gKiBpZiB0aGUgcHJvcGVydHkgc2hvdWxkIGJlIHBpY2tlZCwgYW5kIGBmYWxzZWAgb3RoZXJ3aXNlLlxuICogQHJldHVybnMge1BhcnRpYWw8VD59IEEgbmV3IG9iamVjdCB3aXRoIHRoZSBwcm9wZXJ0aWVzIHRoYXQgc2F0aXNmeSB0aGUgcHJlZGljYXRlIGZ1bmN0aW9uLlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCBvYmogPSB7IGE6IDEsIGI6ICdwaWNrJywgYzogMyB9O1xuICogY29uc3Qgc2hvdWxkUGljayA9ICh2YWx1ZSkgPT4gdHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJztcbiAqIGNvbnN0IHJlc3VsdCA9IHBpY2tCeShvYmosIHNob3VsZFBpY2spO1xuICogLy8gcmVzdWx0IHdpbGwgYmUgeyBiOiAncGljaycgfVxuICovXG5leHBvcnQgZnVuY3Rpb24gcGlja0J5PFQgZXh0ZW5kcyBSZWNvcmQ8c3RyaW5nLCBhbnk+PihcbiAgb2JqOiBULFxuICBzaG91bGRQaWNrOiAodmFsdWU6IFRba2V5b2YgVF0sIGtleToga2V5b2YgVCkgPT4gYm9vbGVhblxuKTogUGFydGlhbDxUPiB7XG4gIGNvbnN0IHJlc3VsdDogUGFydGlhbDxUPiA9IHt9O1xuXG4gIGNvbnN0IGtleXMgPSBPYmplY3Qua2V5cyhvYmopIGFzIEFycmF5PGtleW9mIFQ+O1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGtleXMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBrZXkgPSBrZXlzW2ldO1xuICAgIGNvbnN0IHZhbHVlID0gb2JqW2tleV07XG5cbiAgICBpZiAoc2hvdWxkUGljayh2YWx1ZSwga2V5KSkge1xuICAgICAgcmVzdWx0W2tleV0gPSB2YWx1ZTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmVzdWx0O1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FrQkMsR0FDRCxPQUFPLFNBQVMsT0FDZCxHQUFNLEVBQ04sVUFBd0Q7RUFFeEQsTUFBTSxTQUFxQixDQUFDO0VBRTVCLE1BQU0sT0FBTyxPQUFPLElBQUksQ0FBQztFQUN6QixJQUFLLElBQUksSUFBSSxHQUFHLElBQUksS0FBSyxNQUFNLEVBQUUsSUFBSztJQUNwQyxNQUFNLE1BQU0sSUFBSSxDQUFDLEVBQUU7SUFDbkIsTUFBTSxRQUFRLEdBQUcsQ0FBQyxJQUFJO0lBRXRCLElBQUksV0FBVyxPQUFPLE1BQU07TUFDMUIsTUFBTSxDQUFDLElBQUksR0FBRztJQUNoQjtFQUNGO0VBRUEsT0FBTztBQUNUIn0=
// denoCacheMetadata=2347742525592473068,18153560031824381370