import { words as getWords } from '../../string/words.ts';
import { normalizeForCase } from '../_internal/normalizeForCase.ts';
/**
 * Converts the first character of each word in a string to uppercase and the remaining characters to lowercase.
 *
 * Start case is the naming convention in which each word is written with an initial capital letter.
 * @param {string | object} str - The string to convert.
 * @returns {string} The converted string.
 *
 * @example
 * const result1 = startCase('hello world');  // result will be 'Hello World'
 * const result2 = startCase('HELLO WORLD');  // result will be 'HELLO WORLD'
 * const result3 = startCase('hello-world');  // result will be 'Hello World'
 * const result4 = startCase('hello_world');  // result will be 'Hello World'
 */ export function startCase(str) {
  const words = getWords(normalizeForCase(str).trim());
  let result = '';
  for(let i = 0; i < words.length; i++){
    const word = words[i];
    if (result) {
      result += ' ';
    }
    if (word === word.toUpperCase()) {
      result += word;
    } else {
      result += word[0].toUpperCase() + word.slice(1).toLowerCase();
    }
  }
  return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvc3RyaW5nL3N0YXJ0Q2FzZS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyB3b3JkcyBhcyBnZXRXb3JkcyB9IGZyb20gJy4uLy4uL3N0cmluZy93b3Jkcy50cyc7XG5pbXBvcnQgeyBub3JtYWxpemVGb3JDYXNlIH0gZnJvbSAnLi4vX2ludGVybmFsL25vcm1hbGl6ZUZvckNhc2UudHMnO1xuXG4vKipcbiAqIENvbnZlcnRzIHRoZSBmaXJzdCBjaGFyYWN0ZXIgb2YgZWFjaCB3b3JkIGluIGEgc3RyaW5nIHRvIHVwcGVyY2FzZSBhbmQgdGhlIHJlbWFpbmluZyBjaGFyYWN0ZXJzIHRvIGxvd2VyY2FzZS5cbiAqXG4gKiBTdGFydCBjYXNlIGlzIHRoZSBuYW1pbmcgY29udmVudGlvbiBpbiB3aGljaCBlYWNoIHdvcmQgaXMgd3JpdHRlbiB3aXRoIGFuIGluaXRpYWwgY2FwaXRhbCBsZXR0ZXIuXG4gKiBAcGFyYW0ge3N0cmluZyB8IG9iamVjdH0gc3RyIC0gVGhlIHN0cmluZyB0byBjb252ZXJ0LlxuICogQHJldHVybnMge3N0cmluZ30gVGhlIGNvbnZlcnRlZCBzdHJpbmcuXG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IHJlc3VsdDEgPSBzdGFydENhc2UoJ2hlbGxvIHdvcmxkJyk7ICAvLyByZXN1bHQgd2lsbCBiZSAnSGVsbG8gV29ybGQnXG4gKiBjb25zdCByZXN1bHQyID0gc3RhcnRDYXNlKCdIRUxMTyBXT1JMRCcpOyAgLy8gcmVzdWx0IHdpbGwgYmUgJ0hFTExPIFdPUkxEJ1xuICogY29uc3QgcmVzdWx0MyA9IHN0YXJ0Q2FzZSgnaGVsbG8td29ybGQnKTsgIC8vIHJlc3VsdCB3aWxsIGJlICdIZWxsbyBXb3JsZCdcbiAqIGNvbnN0IHJlc3VsdDQgPSBzdGFydENhc2UoJ2hlbGxvX3dvcmxkJyk7ICAvLyByZXN1bHQgd2lsbCBiZSAnSGVsbG8gV29ybGQnXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzdGFydENhc2Uoc3RyPzogc3RyaW5nIHwgb2JqZWN0KTogc3RyaW5nIHtcbiAgY29uc3Qgd29yZHMgPSBnZXRXb3Jkcyhub3JtYWxpemVGb3JDYXNlKHN0cikudHJpbSgpKTtcblxuICBsZXQgcmVzdWx0ID0gJyc7XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCB3b3Jkcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IHdvcmQgPSB3b3Jkc1tpXTtcblxuICAgIGlmIChyZXN1bHQpIHtcbiAgICAgIHJlc3VsdCArPSAnICc7XG4gICAgfVxuXG4gICAgaWYgKHdvcmQgPT09IHdvcmQudG9VcHBlckNhc2UoKSkge1xuICAgICAgcmVzdWx0ICs9IHdvcmQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlc3VsdCArPSB3b3JkWzBdLnRvVXBwZXJDYXNlKCkgKyB3b3JkLnNsaWNlKDEpLnRvTG93ZXJDYXNlKCk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLFNBQVMsUUFBUSxRQUFRLHdCQUF3QjtBQUMxRCxTQUFTLGdCQUFnQixRQUFRLG1DQUFtQztBQUVwRTs7Ozs7Ozs7Ozs7O0NBWUMsR0FDRCxPQUFPLFNBQVMsVUFBVSxHQUFxQjtFQUM3QyxNQUFNLFFBQVEsU0FBUyxpQkFBaUIsS0FBSyxJQUFJO0VBRWpELElBQUksU0FBUztFQUViLElBQUssSUFBSSxJQUFJLEdBQUcsSUFBSSxNQUFNLE1BQU0sRUFBRSxJQUFLO0lBQ3JDLE1BQU0sT0FBTyxLQUFLLENBQUMsRUFBRTtJQUVyQixJQUFJLFFBQVE7TUFDVixVQUFVO0lBQ1o7SUFFQSxJQUFJLFNBQVMsS0FBSyxXQUFXLElBQUk7TUFDL0IsVUFBVTtJQUNaLE9BQU87TUFDTCxVQUFVLElBQUksQ0FBQyxFQUFFLENBQUMsV0FBVyxLQUFLLEtBQUssS0FBSyxDQUFDLEdBQUcsV0FBVztJQUM3RDtFQUNGO0VBRUEsT0FBTztBQUNUIn0=
// denoCacheMetadata=17780150461685482599,2354244801872738938