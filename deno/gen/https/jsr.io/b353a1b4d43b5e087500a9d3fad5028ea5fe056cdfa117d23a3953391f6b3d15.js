import { range } from '../../math/range.ts';
import { isArrayLike } from '../predicate/isArrayLike.ts';
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
  if (obj == null) {
    return {};
  }
  const result = {};
  if (shouldPick == null) {
    return obj;
  }
  const keys = isArrayLike(obj) ? range(0, obj.length) : Object.keys(obj);
  for(let i = 0; i < keys.length; i++){
    const key = keys[i].toString();
    const value = obj[key];
    if (shouldPick(value, key, obj)) {
      result[key] = value;
    }
  }
  return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvb2JqZWN0L3BpY2tCeS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyByYW5nZSB9IGZyb20gJy4uLy4uL21hdGgvcmFuZ2UudHMnO1xuaW1wb3J0IHsgaXNBcnJheUxpa2UgfSBmcm9tICcuLi9wcmVkaWNhdGUvaXNBcnJheUxpa2UudHMnO1xuXG4vKipcbiAqIENyZWF0ZXMgYSBuZXcgb2JqZWN0IGNvbXBvc2VkIG9mIHRoZSBwcm9wZXJ0aWVzIHRoYXQgc2F0aXNmeSB0aGUgcHJlZGljYXRlIGZ1bmN0aW9uLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gdGFrZXMgYW4gb2JqZWN0IGFuZCBhIHByZWRpY2F0ZSBmdW5jdGlvbiwgYW5kIHJldHVybnMgYSBuZXcgb2JqZWN0IHRoYXRcbiAqIGluY2x1ZGVzIG9ubHkgdGhlIHByb3BlcnRpZXMgZm9yIHdoaWNoIHRoZSBwcmVkaWNhdGUgZnVuY3Rpb24gcmV0dXJucyB0cnVlLlxuICpcbiAqIEB0ZW1wbGF0ZSBUIC0gVGhlIHR5cGUgb2Ygb2JqZWN0LlxuICogQHBhcmFtIHtUfSBvYmogLSBUaGUgb2JqZWN0IHRvIHBpY2sgcHJvcGVydGllcyBmcm9tLlxuICogQHBhcmFtIHsodmFsdWU6IFRba2V5b2YgVF0sIGtleToga2V5b2YgVCkgPT4gYm9vbGVhbn0gc2hvdWxkUGljayAtIEEgcHJlZGljYXRlIGZ1bmN0aW9uIHRoYXQgZGV0ZXJtaW5lc1xuICogd2hldGhlciBhIHByb3BlcnR5IHNob3VsZCBiZSBwaWNrZWQuIEl0IHRha2VzIHRoZSBwcm9wZXJ0eSdzIGtleSBhbmQgdmFsdWUgYXMgYXJndW1lbnRzIGFuZCByZXR1cm5zIGB0cnVlYFxuICogaWYgdGhlIHByb3BlcnR5IHNob3VsZCBiZSBwaWNrZWQsIGFuZCBgZmFsc2VgIG90aGVyd2lzZS5cbiAqIEByZXR1cm5zIHtQYXJ0aWFsPFQ+fSBBIG5ldyBvYmplY3Qgd2l0aCB0aGUgcHJvcGVydGllcyB0aGF0IHNhdGlzZnkgdGhlIHByZWRpY2F0ZSBmdW5jdGlvbi5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3Qgb2JqID0geyBhOiAxLCBiOiAncGljaycsIGM6IDMgfTtcbiAqIGNvbnN0IHNob3VsZFBpY2sgPSAodmFsdWUpID0+IHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZyc7XG4gKiBjb25zdCByZXN1bHQgPSBwaWNrQnkob2JqLCBzaG91bGRQaWNrKTtcbiAqIC8vIHJlc3VsdCB3aWxsIGJlIHsgYjogJ3BpY2snIH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBpY2tCeTxUIGV4dGVuZHMgUmVjb3JkPHN0cmluZywgYW55Pj4oXG4gIG9iajogVCxcbiAgc2hvdWxkUGljaz86ICh2YWx1ZTogVFtrZXlvZiBUXSwga2V5OiBrZXlvZiBULCBvYmo6IFQpID0+IGJvb2xlYW5cbik6IFBhcnRpYWw8VD4ge1xuICBpZiAob2JqID09IG51bGwpIHtcbiAgICByZXR1cm4ge307XG4gIH1cblxuICBjb25zdCByZXN1bHQ6IFBhcnRpYWw8VD4gPSB7fTtcblxuICBpZiAoc2hvdWxkUGljayA9PSBudWxsKSB7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuXG4gIGNvbnN0IGtleXMgPSBpc0FycmF5TGlrZShvYmopID8gcmFuZ2UoMCwgb2JqLmxlbmd0aCkgOiAoT2JqZWN0LmtleXMob2JqKSBhcyBBcnJheTxrZXlvZiBUPik7XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBrZXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3Qga2V5ID0ga2V5c1tpXS50b1N0cmluZygpIGFzIGtleW9mIFQ7XG4gICAgY29uc3QgdmFsdWUgPSBvYmpba2V5XTtcblxuICAgIGlmIChzaG91bGRQaWNrKHZhbHVlLCBrZXksIG9iaikpIHtcbiAgICAgIHJlc3VsdFtrZXldID0gdmFsdWU7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLEtBQUssUUFBUSxzQkFBc0I7QUFDNUMsU0FBUyxXQUFXLFFBQVEsOEJBQThCO0FBRTFEOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FrQkMsR0FDRCxPQUFPLFNBQVMsT0FDZCxHQUFNLEVBQ04sVUFBaUU7RUFFakUsSUFBSSxPQUFPLE1BQU07SUFDZixPQUFPLENBQUM7RUFDVjtFQUVBLE1BQU0sU0FBcUIsQ0FBQztFQUU1QixJQUFJLGNBQWMsTUFBTTtJQUN0QixPQUFPO0VBQ1Q7RUFFQSxNQUFNLE9BQU8sWUFBWSxPQUFPLE1BQU0sR0FBRyxJQUFJLE1BQU0sSUFBSyxPQUFPLElBQUksQ0FBQztFQUVwRSxJQUFLLElBQUksSUFBSSxHQUFHLElBQUksS0FBSyxNQUFNLEVBQUUsSUFBSztJQUNwQyxNQUFNLE1BQU0sSUFBSSxDQUFDLEVBQUUsQ0FBQyxRQUFRO0lBQzVCLE1BQU0sUUFBUSxHQUFHLENBQUMsSUFBSTtJQUV0QixJQUFJLFdBQVcsT0FBTyxLQUFLLE1BQU07TUFDL0IsTUFBTSxDQUFDLElBQUksR0FBRztJQUNoQjtFQUNGO0VBRUEsT0FBTztBQUNUIn0=
// denoCacheMetadata=3255404700038109877,4465693027087164644