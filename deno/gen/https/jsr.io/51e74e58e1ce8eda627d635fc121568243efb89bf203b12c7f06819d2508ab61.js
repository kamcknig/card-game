/**
 * Checks if a given value is a valid JSON string.
 *
 * A valid JSON string is one that can be successfully parsed using `JSON.parse()`. According to JSON
 * specifications, valid JSON can represent:
 * - Objects (with string keys and valid JSON values)
 * - Arrays (containing valid JSON values)
 * - Strings
 * - Numbers
 * - Booleans
 * - null
 *
 * String values like `"null"`, `"true"`, `"false"`, and numeric strings (e.g., `"42"`) are considered
 * valid JSON and will return true.
 *
 * This function serves as a type guard in TypeScript, narrowing the type of the argument to `string`.
 *
 * @param {unknown} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid JSON string, else `false`.
 *
 * @example
 * isJSON('{"name":"John","age":30}'); // true
 * isJSON('[1,2,3]'); // true
 * isJSON('true'); // true
 * isJSON('invalid json'); // false
 * isJSON({ name: 'John' }); // false (not a string)
 * isJSON(null); // false (not a string)
 */ export function isJSON(value) {
  if (typeof value !== 'string') {
    return false;
  }
  try {
    JSON.parse(value);
    return true;
  } catch  {
    return false;
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9wcmVkaWNhdGUvaXNKU09OLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQ2hlY2tzIGlmIGEgZ2l2ZW4gdmFsdWUgaXMgYSB2YWxpZCBKU09OIHN0cmluZy5cbiAqXG4gKiBBIHZhbGlkIEpTT04gc3RyaW5nIGlzIG9uZSB0aGF0IGNhbiBiZSBzdWNjZXNzZnVsbHkgcGFyc2VkIHVzaW5nIGBKU09OLnBhcnNlKClgLiBBY2NvcmRpbmcgdG8gSlNPTlxuICogc3BlY2lmaWNhdGlvbnMsIHZhbGlkIEpTT04gY2FuIHJlcHJlc2VudDpcbiAqIC0gT2JqZWN0cyAod2l0aCBzdHJpbmcga2V5cyBhbmQgdmFsaWQgSlNPTiB2YWx1ZXMpXG4gKiAtIEFycmF5cyAoY29udGFpbmluZyB2YWxpZCBKU09OIHZhbHVlcylcbiAqIC0gU3RyaW5nc1xuICogLSBOdW1iZXJzXG4gKiAtIEJvb2xlYW5zXG4gKiAtIG51bGxcbiAqXG4gKiBTdHJpbmcgdmFsdWVzIGxpa2UgYFwibnVsbFwiYCwgYFwidHJ1ZVwiYCwgYFwiZmFsc2VcImAsIGFuZCBudW1lcmljIHN0cmluZ3MgKGUuZy4sIGBcIjQyXCJgKSBhcmUgY29uc2lkZXJlZFxuICogdmFsaWQgSlNPTiBhbmQgd2lsbCByZXR1cm4gdHJ1ZS5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIHNlcnZlcyBhcyBhIHR5cGUgZ3VhcmQgaW4gVHlwZVNjcmlwdCwgbmFycm93aW5nIHRoZSB0eXBlIG9mIHRoZSBhcmd1bWVudCB0byBgc3RyaW5nYC5cbiAqXG4gKiBAcGFyYW0ge3Vua25vd259IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGEgdmFsaWQgSlNPTiBzdHJpbmcsIGVsc2UgYGZhbHNlYC5cbiAqXG4gKiBAZXhhbXBsZVxuICogaXNKU09OKCd7XCJuYW1lXCI6XCJKb2huXCIsXCJhZ2VcIjozMH0nKTsgLy8gdHJ1ZVxuICogaXNKU09OKCdbMSwyLDNdJyk7IC8vIHRydWVcbiAqIGlzSlNPTigndHJ1ZScpOyAvLyB0cnVlXG4gKiBpc0pTT04oJ2ludmFsaWQganNvbicpOyAvLyBmYWxzZVxuICogaXNKU09OKHsgbmFtZTogJ0pvaG4nIH0pOyAvLyBmYWxzZSAobm90IGEgc3RyaW5nKVxuICogaXNKU09OKG51bGwpOyAvLyBmYWxzZSAobm90IGEgc3RyaW5nKVxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNKU09OKHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgc3RyaW5nIHtcbiAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ3N0cmluZycpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICB0cnkge1xuICAgIEpTT04ucGFyc2UodmFsdWUpO1xuICAgIHJldHVybiB0cnVlO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBMkJDLEdBQ0QsT0FBTyxTQUFTLE9BQU8sS0FBYztFQUNuQyxJQUFJLE9BQU8sVUFBVSxVQUFVO0lBQzdCLE9BQU87RUFDVDtFQUVBLElBQUk7SUFDRixLQUFLLEtBQUssQ0FBQztJQUNYLE9BQU87RUFDVCxFQUFFLE9BQU07SUFDTixPQUFPO0VBQ1Q7QUFDRiJ9
// denoCacheMetadata=17751897553741620648,11142131196201342738