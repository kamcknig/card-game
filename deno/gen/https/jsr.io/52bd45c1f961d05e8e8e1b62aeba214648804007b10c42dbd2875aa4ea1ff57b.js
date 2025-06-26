import { trimEnd as trimEndToolkit } from '../../string/trimEnd.ts';
/**
 * Removes trailing whitespace or specified characters from a string.
 *
 * @param {string} str - The string from which trailing characters will be trimmed.
 * @param {string | string[]} chars - The character(s) to remove from the end of the string. Defaults to `" "`.
 * @returns {string} - The resulting string after the specified trailing character has been removed.
 *
 * @example
 * const trimmedStr1 = trimEnd('hello---', '-') // returns 'hello'
 * const trimmedStr2 = trimEnd('123000', '0') // returns '123'
 * const trimmedStr3 = trimEnd('abcabcabc', 'c') // returns 'abcabcab'
 * const trimmedStr4 = trimEnd('trimmedxxx', 'x') // returns 'trimmed'
 */ export function trimEnd(str, chars, guard) {
  if (str == null) {
    return '';
  }
  if (guard != null || chars == null) {
    return str.toString().trimEnd();
  }
  switch(typeof chars){
    case 'string':
      {
        return trimEndToolkit(str, chars.toString().split(''));
      }
    case 'object':
      {
        if (Array.isArray(chars)) {
          return trimEndToolkit(str, chars.flatMap((x)=>x.toString().split('')));
        } else {
          return trimEndToolkit(str, chars.toString().split(''));
        }
      }
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvc3RyaW5nL3RyaW1FbmQudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgdHJpbUVuZCBhcyB0cmltRW5kVG9vbGtpdCB9IGZyb20gJy4uLy4uL3N0cmluZy90cmltRW5kLnRzJztcblxuLyoqXG4gKiBSZW1vdmVzIHRyYWlsaW5nIHdoaXRlc3BhY2Ugb3Igc3BlY2lmaWVkIGNoYXJhY3RlcnMgZnJvbSBhIHN0cmluZy5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gc3RyIC0gVGhlIHN0cmluZyBmcm9tIHdoaWNoIHRyYWlsaW5nIGNoYXJhY3RlcnMgd2lsbCBiZSB0cmltbWVkLlxuICogQHBhcmFtIHtzdHJpbmcgfCBzdHJpbmdbXX0gY2hhcnMgLSBUaGUgY2hhcmFjdGVyKHMpIHRvIHJlbW92ZSBmcm9tIHRoZSBlbmQgb2YgdGhlIHN0cmluZy4gRGVmYXVsdHMgdG8gYFwiIFwiYC5cbiAqIEByZXR1cm5zIHtzdHJpbmd9IC0gVGhlIHJlc3VsdGluZyBzdHJpbmcgYWZ0ZXIgdGhlIHNwZWNpZmllZCB0cmFpbGluZyBjaGFyYWN0ZXIgaGFzIGJlZW4gcmVtb3ZlZC5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgdHJpbW1lZFN0cjEgPSB0cmltRW5kKCdoZWxsby0tLScsICctJykgLy8gcmV0dXJucyAnaGVsbG8nXG4gKiBjb25zdCB0cmltbWVkU3RyMiA9IHRyaW1FbmQoJzEyMzAwMCcsICcwJykgLy8gcmV0dXJucyAnMTIzJ1xuICogY29uc3QgdHJpbW1lZFN0cjMgPSB0cmltRW5kKCdhYmNhYmNhYmMnLCAnYycpIC8vIHJldHVybnMgJ2FiY2FiY2FiJ1xuICogY29uc3QgdHJpbW1lZFN0cjQgPSB0cmltRW5kKCd0cmltbWVkeHh4JywgJ3gnKSAvLyByZXR1cm5zICd0cmltbWVkJ1xuICovXG5leHBvcnQgZnVuY3Rpb24gdHJpbUVuZChzdHI6IHN0cmluZywgY2hhcnM/OiBzdHJpbmcgfCBzdHJpbmdbXSwgZ3VhcmQ/OiB1bmtub3duKTogc3RyaW5nIHtcbiAgaWYgKHN0ciA9PSBudWxsKSB7XG4gICAgcmV0dXJuICcnO1xuICB9XG5cbiAgaWYgKGd1YXJkICE9IG51bGwgfHwgY2hhcnMgPT0gbnVsbCkge1xuICAgIHJldHVybiBzdHIudG9TdHJpbmcoKS50cmltRW5kKCk7XG4gIH1cblxuICBzd2l0Y2ggKHR5cGVvZiBjaGFycykge1xuICAgIGNhc2UgJ3N0cmluZyc6IHtcbiAgICAgIHJldHVybiB0cmltRW5kVG9vbGtpdChzdHIsIGNoYXJzLnRvU3RyaW5nKCkuc3BsaXQoJycpKTtcbiAgICB9XG4gICAgY2FzZSAnb2JqZWN0Jzoge1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkoY2hhcnMpKSB7XG4gICAgICAgIHJldHVybiB0cmltRW5kVG9vbGtpdChcbiAgICAgICAgICBzdHIsXG4gICAgICAgICAgY2hhcnMuZmxhdE1hcCh4ID0+IHgudG9TdHJpbmcoKS5zcGxpdCgnJykpXG4gICAgICAgICk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdHJpbUVuZFRvb2xraXQoc3RyLCAoY2hhcnMgYXMgYW55KS50b1N0cmluZygpLnNwbGl0KCcnKSk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxXQUFXLGNBQWMsUUFBUSwwQkFBMEI7QUFFcEU7Ozs7Ozs7Ozs7OztDQVlDLEdBQ0QsT0FBTyxTQUFTLFFBQVEsR0FBVyxFQUFFLEtBQXlCLEVBQUUsS0FBZTtFQUM3RSxJQUFJLE9BQU8sTUFBTTtJQUNmLE9BQU87RUFDVDtFQUVBLElBQUksU0FBUyxRQUFRLFNBQVMsTUFBTTtJQUNsQyxPQUFPLElBQUksUUFBUSxHQUFHLE9BQU87RUFDL0I7RUFFQSxPQUFRLE9BQU87SUFDYixLQUFLO01BQVU7UUFDYixPQUFPLGVBQWUsS0FBSyxNQUFNLFFBQVEsR0FBRyxLQUFLLENBQUM7TUFDcEQ7SUFDQSxLQUFLO01BQVU7UUFDYixJQUFJLE1BQU0sT0FBTyxDQUFDLFFBQVE7VUFDeEIsT0FBTyxlQUNMLEtBQ0EsTUFBTSxPQUFPLENBQUMsQ0FBQSxJQUFLLEVBQUUsUUFBUSxHQUFHLEtBQUssQ0FBQztRQUUxQyxPQUFPO1VBQ0wsT0FBTyxlQUFlLEtBQUssQUFBQyxNQUFjLFFBQVEsR0FBRyxLQUFLLENBQUM7UUFDN0Q7TUFDRjtFQUNGO0FBQ0YifQ==
// denoCacheMetadata=882839542087626668,10755149364254106914