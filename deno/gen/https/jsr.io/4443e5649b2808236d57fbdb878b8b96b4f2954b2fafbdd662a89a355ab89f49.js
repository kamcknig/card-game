/**
 * Checks if a string contains another string at the beginning of the string.
 *
 * Checks if one string startsWith another string. Optional position parameter to start searching from a certain index.
 *
 * @param {string} str - The string that might contain the target string.
 * @param {string} target - The string to search for.
 * @param {number} position - An optional offset to start searching in the str string
 * @returns {boolean} - True if the str string starts with the target string.
 *
 * @example
 * const isPrefix = startsWith('fooBar', 'foo') // returns true
 * const isPrefix = startsWith('fooBar', 'bar') // returns false
 * const isPrefix = startsWith('fooBar', 'abc') // returns false
 * const isPrefix = startsWith('fooBar', 'Bar', 2) // returns true
 * const isPrefix = startsWith('fooBar', 'Bar', 5) // returns false
 */ export function startsWith(str, target, position = 0) {
  return str.startsWith(target, position);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvc3RyaW5nL3N0YXJ0c1dpdGgudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBDaGVja3MgaWYgYSBzdHJpbmcgY29udGFpbnMgYW5vdGhlciBzdHJpbmcgYXQgdGhlIGJlZ2lubmluZyBvZiB0aGUgc3RyaW5nLlxuICpcbiAqIENoZWNrcyBpZiBvbmUgc3RyaW5nIHN0YXJ0c1dpdGggYW5vdGhlciBzdHJpbmcuIE9wdGlvbmFsIHBvc2l0aW9uIHBhcmFtZXRlciB0byBzdGFydCBzZWFyY2hpbmcgZnJvbSBhIGNlcnRhaW4gaW5kZXguXG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IHN0ciAtIFRoZSBzdHJpbmcgdGhhdCBtaWdodCBjb250YWluIHRoZSB0YXJnZXQgc3RyaW5nLlxuICogQHBhcmFtIHtzdHJpbmd9IHRhcmdldCAtIFRoZSBzdHJpbmcgdG8gc2VhcmNoIGZvci5cbiAqIEBwYXJhbSB7bnVtYmVyfSBwb3NpdGlvbiAtIEFuIG9wdGlvbmFsIG9mZnNldCB0byBzdGFydCBzZWFyY2hpbmcgaW4gdGhlIHN0ciBzdHJpbmdcbiAqIEByZXR1cm5zIHtib29sZWFufSAtIFRydWUgaWYgdGhlIHN0ciBzdHJpbmcgc3RhcnRzIHdpdGggdGhlIHRhcmdldCBzdHJpbmcuXG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IGlzUHJlZml4ID0gc3RhcnRzV2l0aCgnZm9vQmFyJywgJ2ZvbycpIC8vIHJldHVybnMgdHJ1ZVxuICogY29uc3QgaXNQcmVmaXggPSBzdGFydHNXaXRoKCdmb29CYXInLCAnYmFyJykgLy8gcmV0dXJucyBmYWxzZVxuICogY29uc3QgaXNQcmVmaXggPSBzdGFydHNXaXRoKCdmb29CYXInLCAnYWJjJykgLy8gcmV0dXJucyBmYWxzZVxuICogY29uc3QgaXNQcmVmaXggPSBzdGFydHNXaXRoKCdmb29CYXInLCAnQmFyJywgMikgLy8gcmV0dXJucyB0cnVlXG4gKiBjb25zdCBpc1ByZWZpeCA9IHN0YXJ0c1dpdGgoJ2Zvb0JhcicsICdCYXInLCA1KSAvLyByZXR1cm5zIGZhbHNlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzdGFydHNXaXRoKHN0cjogc3RyaW5nLCB0YXJnZXQ6IHN0cmluZywgcG9zaXRpb24gPSAwKTogYm9vbGVhbiB7XG4gIHJldHVybiBzdHIuc3RhcnRzV2l0aCh0YXJnZXQsIHBvc2l0aW9uKTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7Ozs7OztDQWdCQyxHQUNELE9BQU8sU0FBUyxXQUFXLEdBQVcsRUFBRSxNQUFjLEVBQUUsV0FBVyxDQUFDO0VBQ2xFLE9BQU8sSUFBSSxVQUFVLENBQUMsUUFBUTtBQUNoQyJ9
// denoCacheMetadata=17133347540704804636,1636790703173495739