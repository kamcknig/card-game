/**
 * The functions isJSONValue, isJSONArray, and isJSONObject are grouped in this file
 * to prevent any circular dependency issues.
 */ import { isPlainObject } from './isPlainObject.ts';
/**
 * Checks if a given value is a valid JSON value.
 *
 * A valid JSON value can be:
 * - null
 * - a JSON object (an object with string keys and valid JSON values)
 * - a JSON array (an array of valid JSON values)
 * - a string
 * - a number
 * - a boolean
 *
 * @param {unknown} value - The value to check.
 * @returns {boolean} - True if the value is a valid JSON value, otherwise false.
 *
 * @example
 * console.log(isJSONValue(null)); // true
 * console.log(isJSONValue({ key: "value" })); // true
 * console.log(isJSONValue([1, 2, 3])); // true
 * console.log(isJSONValue("Hello")); // true
 * console.log(isJSONValue(42)); // true
 * console.log(isJSONValue(true)); // true
 * console.log(isJSONValue(undefined)); // false
 * console.log(isJSONValue(() => {})); // false
 */ export function isJSONValue(value) {
  switch(typeof value){
    case 'object':
      {
        return value === null || isJSONArray(value) || isJSONObject(value);
      }
    case 'string':
    case 'number':
    case 'boolean':
      {
        return true;
      }
    default:
      {
        return false;
      }
  }
}
/**
 * Checks if a given value is a valid JSON array.
 *
 * A valid JSON array is defined as an array where all items are valid JSON values.
 *
 * @param {unknown} value - The value to check.
 * @returns {value is any[]} - True if the value is a valid JSON array, otherwise false.
 *
 * @example
 * console.log(isJSONArray([1, 2, 3])); // true
 * console.log(isJSONArray(["string", null, true])); // true
 * console.log(isJSONArray([1, 2, () => {}])); // false
 * console.log(isJSONArray("not an array")); // false
 */ export function isJSONArray(value) {
  if (!Array.isArray(value)) {
    return false;
  }
  return value.every((item)=>isJSONValue(item));
}
/**
 * Checks if a value is a JSON object.
 *
 * A valid JSON object is defined as an object with string keys and valid JSON values.
 *
 * @param {unknown} obj The value to check.
 * @returns {obj is Record<string, any>} True if `obj` is a JSON object, false otherwise.
 *
 * @example
 * isJSONObject({ nested: { boolean: true, array: [1, 2, 3], string: 'test', null: null } }); // true
 * isJSONObject({ regexp: /test/ }); // false
 * isJSONObject(123); // false
 */ export function isJSONObject(obj) {
  if (!isPlainObject(obj)) {
    return false;
  }
  const keys = Reflect.ownKeys(obj);
  for(let i = 0; i < keys.length; i++){
    const key = keys[i];
    const value = obj[key];
    if (typeof key !== 'string') {
      return false;
    }
    if (!isJSONValue(value)) {
      return false;
    }
  }
  return true;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9wcmVkaWNhdGUvaXNKU09OVmFsdWUudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBUaGUgZnVuY3Rpb25zIGlzSlNPTlZhbHVlLCBpc0pTT05BcnJheSwgYW5kIGlzSlNPTk9iamVjdCBhcmUgZ3JvdXBlZCBpbiB0aGlzIGZpbGVcbiAqIHRvIHByZXZlbnQgYW55IGNpcmN1bGFyIGRlcGVuZGVuY3kgaXNzdWVzLlxuICovXG5pbXBvcnQgeyBpc1BsYWluT2JqZWN0IH0gZnJvbSAnLi9pc1BsYWluT2JqZWN0LnRzJztcblxuLyoqXG4gKiBDaGVja3MgaWYgYSBnaXZlbiB2YWx1ZSBpcyBhIHZhbGlkIEpTT04gdmFsdWUuXG4gKlxuICogQSB2YWxpZCBKU09OIHZhbHVlIGNhbiBiZTpcbiAqIC0gbnVsbFxuICogLSBhIEpTT04gb2JqZWN0IChhbiBvYmplY3Qgd2l0aCBzdHJpbmcga2V5cyBhbmQgdmFsaWQgSlNPTiB2YWx1ZXMpXG4gKiAtIGEgSlNPTiBhcnJheSAoYW4gYXJyYXkgb2YgdmFsaWQgSlNPTiB2YWx1ZXMpXG4gKiAtIGEgc3RyaW5nXG4gKiAtIGEgbnVtYmVyXG4gKiAtIGEgYm9vbGVhblxuICpcbiAqIEBwYXJhbSB7dW5rbm93bn0gdmFsdWUgLSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gLSBUcnVlIGlmIHRoZSB2YWx1ZSBpcyBhIHZhbGlkIEpTT04gdmFsdWUsIG90aGVyd2lzZSBmYWxzZS5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc29sZS5sb2coaXNKU09OVmFsdWUobnVsbCkpOyAvLyB0cnVlXG4gKiBjb25zb2xlLmxvZyhpc0pTT05WYWx1ZSh7IGtleTogXCJ2YWx1ZVwiIH0pKTsgLy8gdHJ1ZVxuICogY29uc29sZS5sb2coaXNKU09OVmFsdWUoWzEsIDIsIDNdKSk7IC8vIHRydWVcbiAqIGNvbnNvbGUubG9nKGlzSlNPTlZhbHVlKFwiSGVsbG9cIikpOyAvLyB0cnVlXG4gKiBjb25zb2xlLmxvZyhpc0pTT05WYWx1ZSg0MikpOyAvLyB0cnVlXG4gKiBjb25zb2xlLmxvZyhpc0pTT05WYWx1ZSh0cnVlKSk7IC8vIHRydWVcbiAqIGNvbnNvbGUubG9nKGlzSlNPTlZhbHVlKHVuZGVmaW5lZCkpOyAvLyBmYWxzZVxuICogY29uc29sZS5sb2coaXNKU09OVmFsdWUoKCkgPT4ge30pKTsgLy8gZmFsc2VcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzSlNPTlZhbHVlKHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgUmVjb3JkPHN0cmluZywgYW55PiB8IGFueVtdIHwgc3RyaW5nIHwgbnVtYmVyIHwgYm9vbGVhbiB8IG51bGwge1xuICBzd2l0Y2ggKHR5cGVvZiB2YWx1ZSkge1xuICAgIGNhc2UgJ29iamVjdCc6IHtcbiAgICAgIHJldHVybiB2YWx1ZSA9PT0gbnVsbCB8fCBpc0pTT05BcnJheSh2YWx1ZSkgfHwgaXNKU09OT2JqZWN0KHZhbHVlKTtcbiAgICB9XG4gICAgY2FzZSAnc3RyaW5nJzpcbiAgICBjYXNlICdudW1iZXInOlxuICAgIGNhc2UgJ2Jvb2xlYW4nOiB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgZGVmYXVsdDoge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIENoZWNrcyBpZiBhIGdpdmVuIHZhbHVlIGlzIGEgdmFsaWQgSlNPTiBhcnJheS5cbiAqXG4gKiBBIHZhbGlkIEpTT04gYXJyYXkgaXMgZGVmaW5lZCBhcyBhbiBhcnJheSB3aGVyZSBhbGwgaXRlbXMgYXJlIHZhbGlkIEpTT04gdmFsdWVzLlxuICpcbiAqIEBwYXJhbSB7dW5rbm93bn0gdmFsdWUgLSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7dmFsdWUgaXMgYW55W119IC0gVHJ1ZSBpZiB0aGUgdmFsdWUgaXMgYSB2YWxpZCBKU09OIGFycmF5LCBvdGhlcndpc2UgZmFsc2UuXG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnNvbGUubG9nKGlzSlNPTkFycmF5KFsxLCAyLCAzXSkpOyAvLyB0cnVlXG4gKiBjb25zb2xlLmxvZyhpc0pTT05BcnJheShbXCJzdHJpbmdcIiwgbnVsbCwgdHJ1ZV0pKTsgLy8gdHJ1ZVxuICogY29uc29sZS5sb2coaXNKU09OQXJyYXkoWzEsIDIsICgpID0+IHt9XSkpOyAvLyBmYWxzZVxuICogY29uc29sZS5sb2coaXNKU09OQXJyYXkoXCJub3QgYW4gYXJyYXlcIikpOyAvLyBmYWxzZVxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNKU09OQXJyYXkodmFsdWU6IHVua25vd24pOiB2YWx1ZSBpcyBhbnlbXSB7XG4gIGlmICghQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICByZXR1cm4gdmFsdWUuZXZlcnkoaXRlbSA9PiBpc0pTT05WYWx1ZShpdGVtKSk7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGEgdmFsdWUgaXMgYSBKU09OIG9iamVjdC5cbiAqXG4gKiBBIHZhbGlkIEpTT04gb2JqZWN0IGlzIGRlZmluZWQgYXMgYW4gb2JqZWN0IHdpdGggc3RyaW5nIGtleXMgYW5kIHZhbGlkIEpTT04gdmFsdWVzLlxuICpcbiAqIEBwYXJhbSB7dW5rbm93bn0gb2JqIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtvYmogaXMgUmVjb3JkPHN0cmluZywgYW55Pn0gVHJ1ZSBpZiBgb2JqYCBpcyBhIEpTT04gb2JqZWN0LCBmYWxzZSBvdGhlcndpc2UuXG4gKlxuICogQGV4YW1wbGVcbiAqIGlzSlNPTk9iamVjdCh7IG5lc3RlZDogeyBib29sZWFuOiB0cnVlLCBhcnJheTogWzEsIDIsIDNdLCBzdHJpbmc6ICd0ZXN0JywgbnVsbDogbnVsbCB9IH0pOyAvLyB0cnVlXG4gKiBpc0pTT05PYmplY3QoeyByZWdleHA6IC90ZXN0LyB9KTsgLy8gZmFsc2VcbiAqIGlzSlNPTk9iamVjdCgxMjMpOyAvLyBmYWxzZVxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNKU09OT2JqZWN0KG9iajogdW5rbm93bik6IG9iaiBpcyBSZWNvcmQ8c3RyaW5nLCBhbnk+IHtcbiAgaWYgKCFpc1BsYWluT2JqZWN0KG9iaikpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBjb25zdCBrZXlzID0gUmVmbGVjdC5vd25LZXlzKG9iaik7XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBrZXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3Qga2V5ID0ga2V5c1tpXTtcbiAgICBjb25zdCB2YWx1ZSA9IG9ialtrZXldO1xuXG4gICAgaWYgKHR5cGVvZiBrZXkgIT09ICdzdHJpbmcnKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgaWYgKCFpc0pTT05WYWx1ZSh2YWx1ZSkpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O0NBR0MsR0FDRCxTQUFTLGFBQWEsUUFBUSxxQkFBcUI7QUFFbkQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBdUJDLEdBQ0QsT0FBTyxTQUFTLFlBQVksS0FBYztFQUN4QyxPQUFRLE9BQU87SUFDYixLQUFLO01BQVU7UUFDYixPQUFPLFVBQVUsUUFBUSxZQUFZLFVBQVUsYUFBYTtNQUM5RDtJQUNBLEtBQUs7SUFDTCxLQUFLO0lBQ0wsS0FBSztNQUFXO1FBQ2QsT0FBTztNQUNUO0lBQ0E7TUFBUztRQUNQLE9BQU87TUFDVDtFQUNGO0FBQ0Y7QUFFQTs7Ozs7Ozs7Ozs7OztDQWFDLEdBQ0QsT0FBTyxTQUFTLFlBQVksS0FBYztFQUN4QyxJQUFJLENBQUMsTUFBTSxPQUFPLENBQUMsUUFBUTtJQUN6QixPQUFPO0VBQ1Q7RUFFQSxPQUFPLE1BQU0sS0FBSyxDQUFDLENBQUEsT0FBUSxZQUFZO0FBQ3pDO0FBRUE7Ozs7Ozs7Ozs7OztDQVlDLEdBQ0QsT0FBTyxTQUFTLGFBQWEsR0FBWTtFQUN2QyxJQUFJLENBQUMsY0FBYyxNQUFNO0lBQ3ZCLE9BQU87RUFDVDtFQUVBLE1BQU0sT0FBTyxRQUFRLE9BQU8sQ0FBQztFQUU3QixJQUFLLElBQUksSUFBSSxHQUFHLElBQUksS0FBSyxNQUFNLEVBQUUsSUFBSztJQUNwQyxNQUFNLE1BQU0sSUFBSSxDQUFDLEVBQUU7SUFDbkIsTUFBTSxRQUFRLEdBQUcsQ0FBQyxJQUFJO0lBRXRCLElBQUksT0FBTyxRQUFRLFVBQVU7TUFDM0IsT0FBTztJQUNUO0lBRUEsSUFBSSxDQUFDLFlBQVksUUFBUTtNQUN2QixPQUFPO0lBQ1Q7RUFDRjtFQUVBLE9BQU87QUFDVCJ9
// denoCacheMetadata=14449814745625793655,11811960404936898937