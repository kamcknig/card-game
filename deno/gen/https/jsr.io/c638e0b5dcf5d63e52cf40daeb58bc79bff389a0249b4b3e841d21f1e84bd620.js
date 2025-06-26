/**
 * Checks if a given key is a deep key.
 *
 * A deep key is a string that contains a dot (.) or square brackets with a property accessor.
 *
 * @param {PropertyKey} key - The key to check.
 * @returns {boolean} - Returns true if the key is a deep key, otherwise false.
 *
 * Examples:
 *
 * isDeepKey('a.b') // true
 * isDeepKey('a[b]') // true
 * isDeepKey('a') // false
 * isDeepKey(123) // false
 * isDeepKey('a.b.c') // true
 * isDeepKey('a[b][c]') // true
 */ export function isDeepKey(key) {
  switch(typeof key){
    case 'number':
    case 'symbol':
      {
        return false;
      }
    case 'string':
      {
        return key.includes('.') || key.includes('[') || key.includes(']');
      }
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvX2ludGVybmFsL2lzRGVlcEtleS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIENoZWNrcyBpZiBhIGdpdmVuIGtleSBpcyBhIGRlZXAga2V5LlxuICpcbiAqIEEgZGVlcCBrZXkgaXMgYSBzdHJpbmcgdGhhdCBjb250YWlucyBhIGRvdCAoLikgb3Igc3F1YXJlIGJyYWNrZXRzIHdpdGggYSBwcm9wZXJ0eSBhY2Nlc3Nvci5cbiAqXG4gKiBAcGFyYW0ge1Byb3BlcnR5S2V5fSBrZXkgLSBUaGUga2V5IHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IC0gUmV0dXJucyB0cnVlIGlmIHRoZSBrZXkgaXMgYSBkZWVwIGtleSwgb3RoZXJ3aXNlIGZhbHNlLlxuICpcbiAqIEV4YW1wbGVzOlxuICpcbiAqIGlzRGVlcEtleSgnYS5iJykgLy8gdHJ1ZVxuICogaXNEZWVwS2V5KCdhW2JdJykgLy8gdHJ1ZVxuICogaXNEZWVwS2V5KCdhJykgLy8gZmFsc2VcbiAqIGlzRGVlcEtleSgxMjMpIC8vIGZhbHNlXG4gKiBpc0RlZXBLZXkoJ2EuYi5jJykgLy8gdHJ1ZVxuICogaXNEZWVwS2V5KCdhW2JdW2NdJykgLy8gdHJ1ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNEZWVwS2V5KGtleTogUHJvcGVydHlLZXkpOiBib29sZWFuIHtcbiAgc3dpdGNoICh0eXBlb2Yga2V5KSB7XG4gICAgY2FzZSAnbnVtYmVyJzpcbiAgICBjYXNlICdzeW1ib2wnOiB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGNhc2UgJ3N0cmluZyc6IHtcbiAgICAgIHJldHVybiBrZXkuaW5jbHVkZXMoJy4nKSB8fCBrZXkuaW5jbHVkZXMoJ1snKSB8fCBrZXkuaW5jbHVkZXMoJ10nKTtcbiAgICB9XG4gIH1cbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7Ozs7OztDQWdCQyxHQUNELE9BQU8sU0FBUyxVQUFVLEdBQWdCO0VBQ3hDLE9BQVEsT0FBTztJQUNiLEtBQUs7SUFDTCxLQUFLO01BQVU7UUFDYixPQUFPO01BQ1Q7SUFDQSxLQUFLO01BQVU7UUFDYixPQUFPLElBQUksUUFBUSxDQUFDLFFBQVEsSUFBSSxRQUFRLENBQUMsUUFBUSxJQUFJLFFBQVEsQ0FBQztNQUNoRTtFQUNGO0FBQ0YifQ==
// denoCacheMetadata=11714733363399912073,6283491096613654931