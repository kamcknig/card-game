/**
 * Gets the `toStringTag` of `value`.
 *
 * @private
 * @param {T} value The value to query.
 * @returns {string} Returns the `Object.prototype.toString.call` result.
 */ export function getTag(value) {
  if (value == null) {
    return value === undefined ? '[object Undefined]' : '[object Null]';
  }
  return Object.prototype.toString.call(value);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvX2ludGVybmFsL2dldFRhZy50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEdldHMgdGhlIGB0b1N0cmluZ1RhZ2Agb2YgYHZhbHVlYC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtUfSB2YWx1ZSBUaGUgdmFsdWUgdG8gcXVlcnkuXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBSZXR1cm5zIHRoZSBgT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsYCByZXN1bHQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRUYWc8VD4odmFsdWU6IFQpIHtcbiAgaWYgKHZhbHVlID09IG51bGwpIHtcbiAgICByZXR1cm4gdmFsdWUgPT09IHVuZGVmaW5lZCA/ICdbb2JqZWN0IFVuZGVmaW5lZF0nIDogJ1tvYmplY3QgTnVsbF0nO1xuICB9XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Q0FNQyxHQUNELE9BQU8sU0FBUyxPQUFVLEtBQVE7RUFDaEMsSUFBSSxTQUFTLE1BQU07SUFDakIsT0FBTyxVQUFVLFlBQVksdUJBQXVCO0VBQ3REO0VBQ0EsT0FBTyxPQUFPLFNBQVMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDO0FBQ3hDIn0=
// denoCacheMetadata=4125940849601166467,4450948379997681053