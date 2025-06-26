const deburrMap = new Map(// eslint-disable-next-line no-restricted-syntax
Object.entries({
  Æ: 'Ae',
  Ð: 'D',
  Ø: 'O',
  Þ: 'Th',
  ß: 'ss',
  æ: 'ae',
  ð: 'd',
  ø: 'o',
  þ: 'th',
  Đ: 'D',
  đ: 'd',
  Ħ: 'H',
  ħ: 'h',
  ı: 'i',
  Ĳ: 'IJ',
  ĳ: 'ij',
  ĸ: 'k',
  Ŀ: 'L',
  ŀ: 'l',
  Ł: 'L',
  ł: 'l',
  ŉ: "'n",
  Ŋ: 'N',
  ŋ: 'n',
  Œ: 'Oe',
  œ: 'oe',
  Ŧ: 'T',
  ŧ: 't',
  ſ: 's'
}));
/**
 * Converts a string by replacing special characters and diacritical marks with their ASCII equivalents.
 * For example, "Crème brûlée" becomes "Creme brulee".
 *
 * @param {string} str - The input string to be deburred.
 * @returns {string} - The deburred string with special characters replaced by their ASCII equivalents.
 *
 * @example
 * // Basic usage:
 * deburr('Æthelred') // returns 'Aethelred'
 *
 * @example
 * // Handling diacritical marks:
 * deburr('München') // returns 'Munchen'
 *
 * @example
 * // Special characters:
 * deburr('Crème brûlée') // returns 'Creme brulee'
 */ export function deburr(str) {
  str = str.normalize('NFD');
  let result = '';
  for(let i = 0; i < str.length; i++){
    const char = str[i];
    if (char >= '\u0300' && char <= '\u036f' || char >= '\ufe20' && char <= '\ufe23') {
      continue;
    }
    result += deburrMap.get(char) ?? char;
  }
  return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9zdHJpbmcvZGVidXJyLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImNvbnN0IGRlYnVyck1hcCA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KFxuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tcmVzdHJpY3RlZC1zeW50YXhcbiAgT2JqZWN0LmVudHJpZXMoe1xuICAgIMOGOiAnQWUnLFxuICAgIMOQOiAnRCcsXG4gICAgw5g6ICdPJyxcbiAgICDDnjogJ1RoJyxcbiAgICDDnzogJ3NzJyxcbiAgICDDpjogJ2FlJyxcbiAgICDDsDogJ2QnLFxuICAgIMO4OiAnbycsXG4gICAgw746ICd0aCcsXG4gICAgxJA6ICdEJyxcbiAgICDEkTogJ2QnLFxuICAgIMSmOiAnSCcsXG4gICAgxKc6ICdoJyxcbiAgICDEsTogJ2knLFxuICAgIMSyOiAnSUonLFxuICAgIMSzOiAnaWonLFxuICAgIMS4OiAnaycsXG4gICAgxL86ICdMJyxcbiAgICDFgDogJ2wnLFxuICAgIMWBOiAnTCcsXG4gICAgxYI6ICdsJyxcbiAgICDFiTogXCInblwiLFxuICAgIMWKOiAnTicsXG4gICAgxYs6ICduJyxcbiAgICDFkjogJ09lJyxcbiAgICDFkzogJ29lJyxcbiAgICDFpjogJ1QnLFxuICAgIMWnOiAndCcsXG4gICAgxb86ICdzJyxcbiAgfSlcbik7XG5cbi8qKlxuICogQ29udmVydHMgYSBzdHJpbmcgYnkgcmVwbGFjaW5nIHNwZWNpYWwgY2hhcmFjdGVycyBhbmQgZGlhY3JpdGljYWwgbWFya3Mgd2l0aCB0aGVpciBBU0NJSSBlcXVpdmFsZW50cy5cbiAqIEZvciBleGFtcGxlLCBcIkNyw6htZSBicsO7bMOpZVwiIGJlY29tZXMgXCJDcmVtZSBicnVsZWVcIi5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gc3RyIC0gVGhlIGlucHV0IHN0cmluZyB0byBiZSBkZWJ1cnJlZC5cbiAqIEByZXR1cm5zIHtzdHJpbmd9IC0gVGhlIGRlYnVycmVkIHN0cmluZyB3aXRoIHNwZWNpYWwgY2hhcmFjdGVycyByZXBsYWNlZCBieSB0aGVpciBBU0NJSSBlcXVpdmFsZW50cy5cbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gQmFzaWMgdXNhZ2U6XG4gKiBkZWJ1cnIoJ8OGdGhlbHJlZCcpIC8vIHJldHVybnMgJ0FldGhlbHJlZCdcbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gSGFuZGxpbmcgZGlhY3JpdGljYWwgbWFya3M6XG4gKiBkZWJ1cnIoJ03DvG5jaGVuJykgLy8gcmV0dXJucyAnTXVuY2hlbidcbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gU3BlY2lhbCBjaGFyYWN0ZXJzOlxuICogZGVidXJyKCdDcsOobWUgYnLDu2zDqWUnKSAvLyByZXR1cm5zICdDcmVtZSBicnVsZWUnXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkZWJ1cnIoc3RyOiBzdHJpbmcpOiBzdHJpbmcge1xuICBzdHIgPSBzdHIubm9ybWFsaXplKCdORkQnKTtcblxuICBsZXQgcmVzdWx0ID0gJyc7XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBjaGFyID0gc3RyW2ldO1xuXG4gICAgaWYgKChjaGFyID49ICdcXHUwMzAwJyAmJiBjaGFyIDw9ICdcXHUwMzZmJykgfHwgKGNoYXIgPj0gJ1xcdWZlMjAnICYmIGNoYXIgPD0gJ1xcdWZlMjMnKSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgcmVzdWx0ICs9IGRlYnVyck1hcC5nZXQoY2hhcikgPz8gY2hhcjtcbiAgfVxuXG4gIHJldHVybiByZXN1bHQ7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsTUFBTSxZQUFZLElBQUksSUFDcEIsZ0RBQWdEO0FBQ2hELE9BQU8sT0FBTyxDQUFDO0VBQ2IsR0FBRztFQUNILEdBQUc7RUFDSCxHQUFHO0VBQ0gsR0FBRztFQUNILEdBQUc7RUFDSCxHQUFHO0VBQ0gsR0FBRztFQUNILEdBQUc7RUFDSCxHQUFHO0VBQ0gsR0FBRztFQUNILEdBQUc7RUFDSCxHQUFHO0VBQ0gsR0FBRztFQUNILEdBQUc7RUFDSCxHQUFHO0VBQ0gsR0FBRztFQUNILEdBQUc7RUFDSCxHQUFHO0VBQ0gsR0FBRztFQUNILEdBQUc7RUFDSCxHQUFHO0VBQ0gsR0FBRztFQUNILEdBQUc7RUFDSCxHQUFHO0VBQ0gsR0FBRztFQUNILEdBQUc7RUFDSCxHQUFHO0VBQ0gsR0FBRztFQUNILEdBQUc7QUFDTDtBQUdGOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FrQkMsR0FDRCxPQUFPLFNBQVMsT0FBTyxHQUFXO0VBQ2hDLE1BQU0sSUFBSSxTQUFTLENBQUM7RUFFcEIsSUFBSSxTQUFTO0VBRWIsSUFBSyxJQUFJLElBQUksR0FBRyxJQUFJLElBQUksTUFBTSxFQUFFLElBQUs7SUFDbkMsTUFBTSxPQUFPLEdBQUcsQ0FBQyxFQUFFO0lBRW5CLElBQUksQUFBQyxRQUFRLFlBQVksUUFBUSxZQUFjLFFBQVEsWUFBWSxRQUFRLFVBQVc7TUFDcEY7SUFDRjtJQUVBLFVBQVUsVUFBVSxHQUFHLENBQUMsU0FBUztFQUNuQztFQUVBLE9BQU87QUFDVCJ9
// denoCacheMetadata=252767082187003842,17590175082855612345