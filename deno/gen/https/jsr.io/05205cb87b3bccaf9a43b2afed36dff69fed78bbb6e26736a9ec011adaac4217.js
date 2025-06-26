import { trimStart as trimStartToolkit } from '../../string/trimStart.ts';
/**
 * Removes leading whitespace or specified characters from a string.
 *
 * @param {string} str - The string from which leading characters will be trimmed.
 * @param {string | string[]} chars - The character(s) to remove from the end of the string. Defaults to `" "`.
 * @returns {string} - The resulting string after the specified leading character has been removed.
 *
 * @example
 * const trimmedStr1 = ltrim('---hello', '-') // returns 'hello'
 * const trimmedStr2 = ltrim('000123', '0') // returns '123'
 * const trimmedStr3 = ltrim('abcabcabc', 'a') // returns 'bcabcabc'
 * const trimmedStr4 = ltrim('xxxtrimmed', 'x') // returns 'trimmed'
 */ export function trimStart(str, chars, guard) {
  if (str == null) {
    return '';
  }
  if (guard != null || chars == null) {
    return str.toString().trimStart();
  }
  switch(typeof chars){
    case 'string':
      {
        return trimStartToolkit(str, chars.toString().split(''));
      }
    case 'object':
      {
        if (Array.isArray(chars)) {
          return trimStartToolkit(str, chars.flatMap((x)=>x.toString().split('')));
        } else {
          return trimStartToolkit(str, chars.toString().split(''));
        }
      }
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvc3RyaW5nL3RyaW1TdGFydC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyB0cmltU3RhcnQgYXMgdHJpbVN0YXJ0VG9vbGtpdCB9IGZyb20gJy4uLy4uL3N0cmluZy90cmltU3RhcnQudHMnO1xuXG4vKipcbiAqIFJlbW92ZXMgbGVhZGluZyB3aGl0ZXNwYWNlIG9yIHNwZWNpZmllZCBjaGFyYWN0ZXJzIGZyb20gYSBzdHJpbmcuXG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IHN0ciAtIFRoZSBzdHJpbmcgZnJvbSB3aGljaCBsZWFkaW5nIGNoYXJhY3RlcnMgd2lsbCBiZSB0cmltbWVkLlxuICogQHBhcmFtIHtzdHJpbmcgfCBzdHJpbmdbXX0gY2hhcnMgLSBUaGUgY2hhcmFjdGVyKHMpIHRvIHJlbW92ZSBmcm9tIHRoZSBlbmQgb2YgdGhlIHN0cmluZy4gRGVmYXVsdHMgdG8gYFwiIFwiYC5cbiAqIEByZXR1cm5zIHtzdHJpbmd9IC0gVGhlIHJlc3VsdGluZyBzdHJpbmcgYWZ0ZXIgdGhlIHNwZWNpZmllZCBsZWFkaW5nIGNoYXJhY3RlciBoYXMgYmVlbiByZW1vdmVkLlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCB0cmltbWVkU3RyMSA9IGx0cmltKCctLS1oZWxsbycsICctJykgLy8gcmV0dXJucyAnaGVsbG8nXG4gKiBjb25zdCB0cmltbWVkU3RyMiA9IGx0cmltKCcwMDAxMjMnLCAnMCcpIC8vIHJldHVybnMgJzEyMydcbiAqIGNvbnN0IHRyaW1tZWRTdHIzID0gbHRyaW0oJ2FiY2FiY2FiYycsICdhJykgLy8gcmV0dXJucyAnYmNhYmNhYmMnXG4gKiBjb25zdCB0cmltbWVkU3RyNCA9IGx0cmltKCd4eHh0cmltbWVkJywgJ3gnKSAvLyByZXR1cm5zICd0cmltbWVkJ1xuICovXG5leHBvcnQgZnVuY3Rpb24gdHJpbVN0YXJ0KHN0cjogc3RyaW5nLCBjaGFycz86IHN0cmluZyB8IHN0cmluZ1tdLCBndWFyZD86IHVua25vd24pOiBzdHJpbmcge1xuICBpZiAoc3RyID09IG51bGwpIHtcbiAgICByZXR1cm4gJyc7XG4gIH1cblxuICBpZiAoZ3VhcmQgIT0gbnVsbCB8fCBjaGFycyA9PSBudWxsKSB7XG4gICAgcmV0dXJuIHN0ci50b1N0cmluZygpLnRyaW1TdGFydCgpO1xuICB9XG5cbiAgc3dpdGNoICh0eXBlb2YgY2hhcnMpIHtcbiAgICBjYXNlICdzdHJpbmcnOiB7XG4gICAgICByZXR1cm4gdHJpbVN0YXJ0VG9vbGtpdChzdHIsIGNoYXJzLnRvU3RyaW5nKCkuc3BsaXQoJycpKTtcbiAgICB9XG4gICAgY2FzZSAnb2JqZWN0Jzoge1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkoY2hhcnMpKSB7XG4gICAgICAgIHJldHVybiB0cmltU3RhcnRUb29sa2l0KFxuICAgICAgICAgIHN0cixcbiAgICAgICAgICBjaGFycy5mbGF0TWFwKHggPT4geC50b1N0cmluZygpLnNwbGl0KCcnKSlcbiAgICAgICAgKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB0cmltU3RhcnRUb29sa2l0KHN0ciwgKGNoYXJzIGFzIGFueSkudG9TdHJpbmcoKS5zcGxpdCgnJykpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsYUFBYSxnQkFBZ0IsUUFBUSw0QkFBNEI7QUFFMUU7Ozs7Ozs7Ozs7OztDQVlDLEdBQ0QsT0FBTyxTQUFTLFVBQVUsR0FBVyxFQUFFLEtBQXlCLEVBQUUsS0FBZTtFQUMvRSxJQUFJLE9BQU8sTUFBTTtJQUNmLE9BQU87RUFDVDtFQUVBLElBQUksU0FBUyxRQUFRLFNBQVMsTUFBTTtJQUNsQyxPQUFPLElBQUksUUFBUSxHQUFHLFNBQVM7RUFDakM7RUFFQSxPQUFRLE9BQU87SUFDYixLQUFLO01BQVU7UUFDYixPQUFPLGlCQUFpQixLQUFLLE1BQU0sUUFBUSxHQUFHLEtBQUssQ0FBQztNQUN0RDtJQUNBLEtBQUs7TUFBVTtRQUNiLElBQUksTUFBTSxPQUFPLENBQUMsUUFBUTtVQUN4QixPQUFPLGlCQUNMLEtBQ0EsTUFBTSxPQUFPLENBQUMsQ0FBQSxJQUFLLEVBQUUsUUFBUSxHQUFHLEtBQUssQ0FBQztRQUUxQyxPQUFPO1VBQ0wsT0FBTyxpQkFBaUIsS0FBSyxBQUFDLE1BQWMsUUFBUSxHQUFHLEtBQUssQ0FBQztRQUMvRDtNQUNGO0VBQ0Y7QUFDRiJ9
// denoCacheMetadata=7031034675942136707,12991632378168865438