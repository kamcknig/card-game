import { trim as trimToolkit } from '../../string/trim.ts';
/**
 * Removes leading and trailing whitespace or specified characters from a string.
 *
 * @param {string} str - The string from which leading and trailing characters will be trimmed.
 * @param {string | string[]} chars - The character(s) to remove from the end of the string. Defaults to `" "`.
 * @returns {string} - The resulting string after the specified leading and trailing characters have been removed.
 *
 * @example
 * trim("  hello  "); // "hello"
 * trim("--hello--", "-"); // "hello"
 * trim("##hello##", ["#", "o"]); // "hell"
 */ export function trim(str, chars, guard) {
  if (str == null) {
    return '';
  }
  if (guard != null || chars == null) {
    return str.toString().trim();
  }
  switch(typeof chars){
    case 'string':
      {
        return trimToolkit(str, chars.toString().split(''));
      }
    case 'object':
      {
        if (Array.isArray(chars)) {
          return trimToolkit(str, chars.flatMap((x)=>x.toString().split('')));
        } else {
          return trimToolkit(str, chars.toString().split(''));
        }
      }
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvc3RyaW5nL3RyaW0udHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgdHJpbSBhcyB0cmltVG9vbGtpdCB9IGZyb20gJy4uLy4uL3N0cmluZy90cmltLnRzJztcblxuLyoqXG4gKiBSZW1vdmVzIGxlYWRpbmcgYW5kIHRyYWlsaW5nIHdoaXRlc3BhY2Ugb3Igc3BlY2lmaWVkIGNoYXJhY3RlcnMgZnJvbSBhIHN0cmluZy5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gc3RyIC0gVGhlIHN0cmluZyBmcm9tIHdoaWNoIGxlYWRpbmcgYW5kIHRyYWlsaW5nIGNoYXJhY3RlcnMgd2lsbCBiZSB0cmltbWVkLlxuICogQHBhcmFtIHtzdHJpbmcgfCBzdHJpbmdbXX0gY2hhcnMgLSBUaGUgY2hhcmFjdGVyKHMpIHRvIHJlbW92ZSBmcm9tIHRoZSBlbmQgb2YgdGhlIHN0cmluZy4gRGVmYXVsdHMgdG8gYFwiIFwiYC5cbiAqIEByZXR1cm5zIHtzdHJpbmd9IC0gVGhlIHJlc3VsdGluZyBzdHJpbmcgYWZ0ZXIgdGhlIHNwZWNpZmllZCBsZWFkaW5nIGFuZCB0cmFpbGluZyBjaGFyYWN0ZXJzIGhhdmUgYmVlbiByZW1vdmVkLlxuICpcbiAqIEBleGFtcGxlXG4gKiB0cmltKFwiICBoZWxsbyAgXCIpOyAvLyBcImhlbGxvXCJcbiAqIHRyaW0oXCItLWhlbGxvLS1cIiwgXCItXCIpOyAvLyBcImhlbGxvXCJcbiAqIHRyaW0oXCIjI2hlbGxvIyNcIiwgW1wiI1wiLCBcIm9cIl0pOyAvLyBcImhlbGxcIlxuICovXG5leHBvcnQgZnVuY3Rpb24gdHJpbShzdHI6IHN0cmluZywgY2hhcnM/OiBzdHJpbmcgfCBzdHJpbmdbXSwgZ3VhcmQ/OiB1bmtub3duKTogc3RyaW5nIHtcbiAgaWYgKHN0ciA9PSBudWxsKSB7XG4gICAgcmV0dXJuICcnO1xuICB9XG5cbiAgaWYgKGd1YXJkICE9IG51bGwgfHwgY2hhcnMgPT0gbnVsbCkge1xuICAgIHJldHVybiBzdHIudG9TdHJpbmcoKS50cmltKCk7XG4gIH1cblxuICBzd2l0Y2ggKHR5cGVvZiBjaGFycykge1xuICAgIGNhc2UgJ3N0cmluZyc6IHtcbiAgICAgIHJldHVybiB0cmltVG9vbGtpdChzdHIsIGNoYXJzLnRvU3RyaW5nKCkuc3BsaXQoJycpKTtcbiAgICB9XG4gICAgY2FzZSAnb2JqZWN0Jzoge1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkoY2hhcnMpKSB7XG4gICAgICAgIHJldHVybiB0cmltVG9vbGtpdChcbiAgICAgICAgICBzdHIsXG4gICAgICAgICAgY2hhcnMuZmxhdE1hcCh4ID0+IHgudG9TdHJpbmcoKS5zcGxpdCgnJykpXG4gICAgICAgICk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdHJpbVRvb2xraXQoc3RyLCAoY2hhcnMgYXMgYW55KS50b1N0cmluZygpLnNwbGl0KCcnKSk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxRQUFRLFdBQVcsUUFBUSx1QkFBdUI7QUFFM0Q7Ozs7Ozs7Ozs7O0NBV0MsR0FDRCxPQUFPLFNBQVMsS0FBSyxHQUFXLEVBQUUsS0FBeUIsRUFBRSxLQUFlO0VBQzFFLElBQUksT0FBTyxNQUFNO0lBQ2YsT0FBTztFQUNUO0VBRUEsSUFBSSxTQUFTLFFBQVEsU0FBUyxNQUFNO0lBQ2xDLE9BQU8sSUFBSSxRQUFRLEdBQUcsSUFBSTtFQUM1QjtFQUVBLE9BQVEsT0FBTztJQUNiLEtBQUs7TUFBVTtRQUNiLE9BQU8sWUFBWSxLQUFLLE1BQU0sUUFBUSxHQUFHLEtBQUssQ0FBQztNQUNqRDtJQUNBLEtBQUs7TUFBVTtRQUNiLElBQUksTUFBTSxPQUFPLENBQUMsUUFBUTtVQUN4QixPQUFPLFlBQ0wsS0FDQSxNQUFNLE9BQU8sQ0FBQyxDQUFBLElBQUssRUFBRSxRQUFRLEdBQUcsS0FBSyxDQUFDO1FBRTFDLE9BQU87VUFDTCxPQUFPLFlBQVksS0FBSyxBQUFDLE1BQWMsUUFBUSxHQUFHLEtBQUssQ0FBQztRQUMxRDtNQUNGO0VBQ0Y7QUFDRiJ9
// denoCacheMetadata=17312665134923550532,2924450624499911868