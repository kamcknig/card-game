/**
 * Reverses a given string.
 *
 * This function takes a string as input and returns a new string that is the reverse of the input.
 *
 * @param {string} value - The string that is to be reversed.
 * @returns {string} - The reversed string.
 *
 * @example
 * const reversedStr1 = reverseString('hello') // returns 'olleh'
 * const reversedStr2 = reverseString('PascalCase') // returns 'esaClacsaP'
 * const reversedStr3 = reverseString('foo 😄 bar') // returns 'rab 😄 oof'
 */ export function reverseString(value) {
  return [
    ...value
  ].reverse().join('');
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9zdHJpbmcvcmV2ZXJzZVN0cmluZy50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFJldmVyc2VzIGEgZ2l2ZW4gc3RyaW5nLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gdGFrZXMgYSBzdHJpbmcgYXMgaW5wdXQgYW5kIHJldHVybnMgYSBuZXcgc3RyaW5nIHRoYXQgaXMgdGhlIHJldmVyc2Ugb2YgdGhlIGlucHV0LlxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSB2YWx1ZSAtIFRoZSBzdHJpbmcgdGhhdCBpcyB0byBiZSByZXZlcnNlZC5cbiAqIEByZXR1cm5zIHtzdHJpbmd9IC0gVGhlIHJldmVyc2VkIHN0cmluZy5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgcmV2ZXJzZWRTdHIxID0gcmV2ZXJzZVN0cmluZygnaGVsbG8nKSAvLyByZXR1cm5zICdvbGxlaCdcbiAqIGNvbnN0IHJldmVyc2VkU3RyMiA9IHJldmVyc2VTdHJpbmcoJ1Bhc2NhbENhc2UnKSAvLyByZXR1cm5zICdlc2FDbGFjc2FQJ1xuICogY29uc3QgcmV2ZXJzZWRTdHIzID0gcmV2ZXJzZVN0cmluZygnZm9vIPCfmIQgYmFyJykgLy8gcmV0dXJucyAncmFiIPCfmIQgb29mJ1xuICovXG5leHBvcnQgZnVuY3Rpb24gcmV2ZXJzZVN0cmluZyh2YWx1ZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIFsuLi52YWx1ZV0ucmV2ZXJzZSgpLmpvaW4oJycpO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7Q0FZQyxHQUNELE9BQU8sU0FBUyxjQUFjLEtBQWE7RUFDekMsT0FBTztPQUFJO0dBQU0sQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDO0FBQ25DIn0=
// denoCacheMetadata=1682611552360703000,17580146932947290272