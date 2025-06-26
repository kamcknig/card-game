import { words as getWords } from './words.ts';
/**
 * Converts the first character of each word in a string to uppercase and the remaining characters to lowercase.
 *
 * Start case is the naming convention in which each word is written with an initial capital letter.
 * @param {string} str - The string to convert.
 * @returns {string} The converted string.
 *
 * @example
 * const result1 = startCase('hello world');  // result will be 'Hello World'
 * const result2 = startCase('HELLO WORLD');  // result will be 'Hello World'
 * const result3 = startCase('hello-world');  // result will be 'Hello World'
 * const result4 = startCase('hello_world');  // result will be 'Hello World'
 */ export function startCase(str) {
  const words = getWords(str.trim());
  let result = '';
  for(let i = 0; i < words.length; i++){
    const word = words[i];
    if (result) {
      result += ' ';
    }
    result += word[0].toUpperCase() + word.slice(1).toLowerCase();
  }
  return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9zdHJpbmcvc3RhcnRDYXNlLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHdvcmRzIGFzIGdldFdvcmRzIH0gZnJvbSAnLi93b3Jkcy50cyc7XG5cbi8qKlxuICogQ29udmVydHMgdGhlIGZpcnN0IGNoYXJhY3RlciBvZiBlYWNoIHdvcmQgaW4gYSBzdHJpbmcgdG8gdXBwZXJjYXNlIGFuZCB0aGUgcmVtYWluaW5nIGNoYXJhY3RlcnMgdG8gbG93ZXJjYXNlLlxuICpcbiAqIFN0YXJ0IGNhc2UgaXMgdGhlIG5hbWluZyBjb252ZW50aW9uIGluIHdoaWNoIGVhY2ggd29yZCBpcyB3cml0dGVuIHdpdGggYW4gaW5pdGlhbCBjYXBpdGFsIGxldHRlci5cbiAqIEBwYXJhbSB7c3RyaW5nfSBzdHIgLSBUaGUgc3RyaW5nIHRvIGNvbnZlcnQuXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBUaGUgY29udmVydGVkIHN0cmluZy5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgcmVzdWx0MSA9IHN0YXJ0Q2FzZSgnaGVsbG8gd29ybGQnKTsgIC8vIHJlc3VsdCB3aWxsIGJlICdIZWxsbyBXb3JsZCdcbiAqIGNvbnN0IHJlc3VsdDIgPSBzdGFydENhc2UoJ0hFTExPIFdPUkxEJyk7ICAvLyByZXN1bHQgd2lsbCBiZSAnSGVsbG8gV29ybGQnXG4gKiBjb25zdCByZXN1bHQzID0gc3RhcnRDYXNlKCdoZWxsby13b3JsZCcpOyAgLy8gcmVzdWx0IHdpbGwgYmUgJ0hlbGxvIFdvcmxkJ1xuICogY29uc3QgcmVzdWx0NCA9IHN0YXJ0Q2FzZSgnaGVsbG9fd29ybGQnKTsgIC8vIHJlc3VsdCB3aWxsIGJlICdIZWxsbyBXb3JsZCdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHN0YXJ0Q2FzZShzdHI6IHN0cmluZyk6IHN0cmluZyB7XG4gIGNvbnN0IHdvcmRzID0gZ2V0V29yZHMoc3RyLnRyaW0oKSk7XG4gIGxldCByZXN1bHQgPSAnJztcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCB3b3Jkcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IHdvcmQgPSB3b3Jkc1tpXTtcbiAgICBpZiAocmVzdWx0KSB7XG4gICAgICByZXN1bHQgKz0gJyAnO1xuICAgIH1cblxuICAgIHJlc3VsdCArPSB3b3JkWzBdLnRvVXBwZXJDYXNlKCkgKyB3b3JkLnNsaWNlKDEpLnRvTG93ZXJDYXNlKCk7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLFNBQVMsUUFBUSxRQUFRLGFBQWE7QUFFL0M7Ozs7Ozs7Ozs7OztDQVlDLEdBQ0QsT0FBTyxTQUFTLFVBQVUsR0FBVztFQUNuQyxNQUFNLFFBQVEsU0FBUyxJQUFJLElBQUk7RUFDL0IsSUFBSSxTQUFTO0VBQ2IsSUFBSyxJQUFJLElBQUksR0FBRyxJQUFJLE1BQU0sTUFBTSxFQUFFLElBQUs7SUFDckMsTUFBTSxPQUFPLEtBQUssQ0FBQyxFQUFFO0lBQ3JCLElBQUksUUFBUTtNQUNWLFVBQVU7SUFDWjtJQUVBLFVBQVUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxXQUFXLEtBQUssS0FBSyxLQUFLLENBQUMsR0FBRyxXQUFXO0VBQzdEO0VBQ0EsT0FBTztBQUNUIn0=
// denoCacheMetadata=6827886876045986109,12888097994300311499