/** Counter used to generate unique numeric identifiers. */ let idCounter = 0;
/**
 * Generates a unique identifier, optionally prefixed with a given string.
 *
 * @param {string} [prefix] - An optional string to prefix the unique identifier.
 *                            If not provided or not a string, only the unique
 *                            numeric identifier is returned.
 * @returns {string} A string containing the unique identifier, with the optional
 *                   prefix if provided.
 *
 * @example
 * // Generate a unique ID with a prefix
 * uniqueId('user_');  // => 'user_1'
 *
 * @example
 * // Generate a unique ID without a prefix
 * uniqueId();  // => '2'
 *
 * @example
 * // Subsequent calls increment the internal counter
 * uniqueId('item_');  // => 'item_3'
 * uniqueId();         // => '4'
 */ export function uniqueId(prefix = '') {
  const id = ++idCounter;
  return `${prefix}${id}`;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvdXRpbC91bmlxdWVJZC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKiogQ291bnRlciB1c2VkIHRvIGdlbmVyYXRlIHVuaXF1ZSBudW1lcmljIGlkZW50aWZpZXJzLiAqL1xubGV0IGlkQ291bnRlciA9IDA7XG5cbi8qKlxuICogR2VuZXJhdGVzIGEgdW5pcXVlIGlkZW50aWZpZXIsIG9wdGlvbmFsbHkgcHJlZml4ZWQgd2l0aCBhIGdpdmVuIHN0cmluZy5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gW3ByZWZpeF0gLSBBbiBvcHRpb25hbCBzdHJpbmcgdG8gcHJlZml4IHRoZSB1bmlxdWUgaWRlbnRpZmllci5cbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgIElmIG5vdCBwcm92aWRlZCBvciBub3QgYSBzdHJpbmcsIG9ubHkgdGhlIHVuaXF1ZVxuICogICAgICAgICAgICAgICAgICAgICAgICAgICAgbnVtZXJpYyBpZGVudGlmaWVyIGlzIHJldHVybmVkLlxuICogQHJldHVybnMge3N0cmluZ30gQSBzdHJpbmcgY29udGFpbmluZyB0aGUgdW5pcXVlIGlkZW50aWZpZXIsIHdpdGggdGhlIG9wdGlvbmFsXG4gKiAgICAgICAgICAgICAgICAgICBwcmVmaXggaWYgcHJvdmlkZWQuXG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIEdlbmVyYXRlIGEgdW5pcXVlIElEIHdpdGggYSBwcmVmaXhcbiAqIHVuaXF1ZUlkKCd1c2VyXycpOyAgLy8gPT4gJ3VzZXJfMSdcbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gR2VuZXJhdGUgYSB1bmlxdWUgSUQgd2l0aG91dCBhIHByZWZpeFxuICogdW5pcXVlSWQoKTsgIC8vID0+ICcyJ1xuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBTdWJzZXF1ZW50IGNhbGxzIGluY3JlbWVudCB0aGUgaW50ZXJuYWwgY291bnRlclxuICogdW5pcXVlSWQoJ2l0ZW1fJyk7ICAvLyA9PiAnaXRlbV8zJ1xuICogdW5pcXVlSWQoKTsgICAgICAgICAvLyA9PiAnNCdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHVuaXF1ZUlkKHByZWZpeCA9ICcnKTogc3RyaW5nIHtcbiAgY29uc3QgaWQgPSArK2lkQ291bnRlcjtcblxuICByZXR1cm4gYCR7cHJlZml4fSR7aWR9YDtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSx5REFBeUQsR0FDekQsSUFBSSxZQUFZO0FBRWhCOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FxQkMsR0FDRCxPQUFPLFNBQVMsU0FBUyxTQUFTLEVBQUU7RUFDbEMsTUFBTSxLQUFLLEVBQUU7RUFFYixPQUFPLEdBQUcsU0FBUyxJQUFJO0FBQ3pCIn0=
// denoCacheMetadata=16586665377267153107,14120496489802947067