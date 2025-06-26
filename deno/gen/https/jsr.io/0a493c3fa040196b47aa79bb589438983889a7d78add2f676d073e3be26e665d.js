import { trimEnd } from './trimEnd.ts';
import { trimStart } from './trimStart.ts';
/**
 * Removes leading and trailing whitespace or specified characters from a string.
 *
 * @param {string} str - The string from which characters will be trimmed.
 * @param {string | string[]} chars - The character(s) to remove from the string. Can be a single character or an array of characters.
 * @returns {string} - The resulting string after the specified characters have been removed.
 *
 * @example
 * trim("  hello  "); // "hello"
 * trim("--hello--", "-"); // "hello"
 * trim("##hello##", ["#", "o"]); // "hell"
 */ export function trim(str, chars) {
  if (chars === undefined) {
    return str.trim();
  }
  return trimStart(trimEnd(str, chars), chars);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9zdHJpbmcvdHJpbS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyB0cmltRW5kIH0gZnJvbSAnLi90cmltRW5kLnRzJztcbmltcG9ydCB7IHRyaW1TdGFydCB9IGZyb20gJy4vdHJpbVN0YXJ0LnRzJztcblxuLyoqXG4gKiBSZW1vdmVzIGxlYWRpbmcgYW5kIHRyYWlsaW5nIHdoaXRlc3BhY2Ugb3Igc3BlY2lmaWVkIGNoYXJhY3RlcnMgZnJvbSBhIHN0cmluZy5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gc3RyIC0gVGhlIHN0cmluZyBmcm9tIHdoaWNoIGNoYXJhY3RlcnMgd2lsbCBiZSB0cmltbWVkLlxuICogQHBhcmFtIHtzdHJpbmcgfCBzdHJpbmdbXX0gY2hhcnMgLSBUaGUgY2hhcmFjdGVyKHMpIHRvIHJlbW92ZSBmcm9tIHRoZSBzdHJpbmcuIENhbiBiZSBhIHNpbmdsZSBjaGFyYWN0ZXIgb3IgYW4gYXJyYXkgb2YgY2hhcmFjdGVycy5cbiAqIEByZXR1cm5zIHtzdHJpbmd9IC0gVGhlIHJlc3VsdGluZyBzdHJpbmcgYWZ0ZXIgdGhlIHNwZWNpZmllZCBjaGFyYWN0ZXJzIGhhdmUgYmVlbiByZW1vdmVkLlxuICpcbiAqIEBleGFtcGxlXG4gKiB0cmltKFwiICBoZWxsbyAgXCIpOyAvLyBcImhlbGxvXCJcbiAqIHRyaW0oXCItLWhlbGxvLS1cIiwgXCItXCIpOyAvLyBcImhlbGxvXCJcbiAqIHRyaW0oXCIjI2hlbGxvIyNcIiwgW1wiI1wiLCBcIm9cIl0pOyAvLyBcImhlbGxcIlxuICovXG5leHBvcnQgZnVuY3Rpb24gdHJpbShzdHI6IHN0cmluZywgY2hhcnM/OiBzdHJpbmcgfCBzdHJpbmdbXSk6IHN0cmluZyB7XG4gIGlmIChjaGFycyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIHN0ci50cmltKCk7XG4gIH1cblxuICByZXR1cm4gdHJpbVN0YXJ0KHRyaW1FbmQoc3RyLCBjaGFycyksIGNoYXJzKTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLE9BQU8sUUFBUSxlQUFlO0FBQ3ZDLFNBQVMsU0FBUyxRQUFRLGlCQUFpQjtBQUUzQzs7Ozs7Ozs7Ozs7Q0FXQyxHQUNELE9BQU8sU0FBUyxLQUFLLEdBQVcsRUFBRSxLQUF5QjtFQUN6RCxJQUFJLFVBQVUsV0FBVztJQUN2QixPQUFPLElBQUksSUFBSTtFQUNqQjtFQUVBLE9BQU8sVUFBVSxRQUFRLEtBQUssUUFBUTtBQUN4QyJ9
// denoCacheMetadata=11049103531577432756,4755304493641271096