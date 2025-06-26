import { words as getWords } from './words.ts';
/**
 * Converts a string to snake case.
 *
 * Snake case is the naming convention in which each word is written in lowercase and separated by an underscore (_) character.
 *
 * @param {string} str - The string that is to be changed to snake case.
 * @returns {string} - The converted string to snake case.
 *
 * @example
 * const convertedStr1 = snakeCase('camelCase') // returns 'camel_case'
 * const convertedStr2 = snakeCase('some whitespace') // returns 'some_whitespace'
 * const convertedStr3 = snakeCase('hyphen-text') // returns 'hyphen_text'
 * const convertedStr4 = snakeCase('HTTPRequest') // returns 'http_request'
 */ export function snakeCase(str) {
  const words = getWords(str);
  return words.map((word)=>word.toLowerCase()).join('_');
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9zdHJpbmcvc25ha2VDYXNlLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHdvcmRzIGFzIGdldFdvcmRzIH0gZnJvbSAnLi93b3Jkcy50cyc7XG5cbi8qKlxuICogQ29udmVydHMgYSBzdHJpbmcgdG8gc25ha2UgY2FzZS5cbiAqXG4gKiBTbmFrZSBjYXNlIGlzIHRoZSBuYW1pbmcgY29udmVudGlvbiBpbiB3aGljaCBlYWNoIHdvcmQgaXMgd3JpdHRlbiBpbiBsb3dlcmNhc2UgYW5kIHNlcGFyYXRlZCBieSBhbiB1bmRlcnNjb3JlIChfKSBjaGFyYWN0ZXIuXG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IHN0ciAtIFRoZSBzdHJpbmcgdGhhdCBpcyB0byBiZSBjaGFuZ2VkIHRvIHNuYWtlIGNhc2UuXG4gKiBAcmV0dXJucyB7c3RyaW5nfSAtIFRoZSBjb252ZXJ0ZWQgc3RyaW5nIHRvIHNuYWtlIGNhc2UuXG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IGNvbnZlcnRlZFN0cjEgPSBzbmFrZUNhc2UoJ2NhbWVsQ2FzZScpIC8vIHJldHVybnMgJ2NhbWVsX2Nhc2UnXG4gKiBjb25zdCBjb252ZXJ0ZWRTdHIyID0gc25ha2VDYXNlKCdzb21lIHdoaXRlc3BhY2UnKSAvLyByZXR1cm5zICdzb21lX3doaXRlc3BhY2UnXG4gKiBjb25zdCBjb252ZXJ0ZWRTdHIzID0gc25ha2VDYXNlKCdoeXBoZW4tdGV4dCcpIC8vIHJldHVybnMgJ2h5cGhlbl90ZXh0J1xuICogY29uc3QgY29udmVydGVkU3RyNCA9IHNuYWtlQ2FzZSgnSFRUUFJlcXVlc3QnKSAvLyByZXR1cm5zICdodHRwX3JlcXVlc3QnXG4gKi9cblxuZXhwb3J0IGZ1bmN0aW9uIHNuYWtlQ2FzZShzdHI6IHN0cmluZyk6IHN0cmluZyB7XG4gIGNvbnN0IHdvcmRzID0gZ2V0V29yZHMoc3RyKTtcbiAgcmV0dXJuIHdvcmRzLm1hcCh3b3JkID0+IHdvcmQudG9Mb3dlckNhc2UoKSkuam9pbignXycpO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsU0FBUyxRQUFRLFFBQVEsYUFBYTtBQUUvQzs7Ozs7Ozs7Ozs7OztDQWFDLEdBRUQsT0FBTyxTQUFTLFVBQVUsR0FBVztFQUNuQyxNQUFNLFFBQVEsU0FBUztFQUN2QixPQUFPLE1BQU0sR0FBRyxDQUFDLENBQUEsT0FBUSxLQUFLLFdBQVcsSUFBSSxJQUFJLENBQUM7QUFDcEQifQ==
// denoCacheMetadata=2041817833782327694,335432149720974821