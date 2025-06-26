/**
 * Checks if a string contains another string at the end of the string.
 *
 * Checks if one string endsWith another string. Optional position parameter to offset searching before a certain index.
 *
 * @param {string} str - The string that might contain the target string.
 * @param {string} target - The string to search for.
 * @param {number} position - An optional position from the start to search up to this index
 * @returns {boolean} - True if the str string ends with the target string.
 *
 * @example
 * const isPrefix = endsWith('fooBar', 'foo') // returns true
 * const isPrefix = endsWith('fooBar', 'bar') // returns false
 * const isPrefix = endsWith('fooBar', 'abc') // returns false
 * const isPrefix = endsWith('fooBar', 'foo', 3) // returns true
 * const isPrefix = endsWith('fooBar', 'abc', 5) // returns false
 */ export function endsWith(str, target, position = str.length) {
  return str.endsWith(target, position);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvc3RyaW5nL2VuZHNXaXRoLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQ2hlY2tzIGlmIGEgc3RyaW5nIGNvbnRhaW5zIGFub3RoZXIgc3RyaW5nIGF0IHRoZSBlbmQgb2YgdGhlIHN0cmluZy5cbiAqXG4gKiBDaGVja3MgaWYgb25lIHN0cmluZyBlbmRzV2l0aCBhbm90aGVyIHN0cmluZy4gT3B0aW9uYWwgcG9zaXRpb24gcGFyYW1ldGVyIHRvIG9mZnNldCBzZWFyY2hpbmcgYmVmb3JlIGEgY2VydGFpbiBpbmRleC5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gc3RyIC0gVGhlIHN0cmluZyB0aGF0IG1pZ2h0IGNvbnRhaW4gdGhlIHRhcmdldCBzdHJpbmcuXG4gKiBAcGFyYW0ge3N0cmluZ30gdGFyZ2V0IC0gVGhlIHN0cmluZyB0byBzZWFyY2ggZm9yLlxuICogQHBhcmFtIHtudW1iZXJ9IHBvc2l0aW9uIC0gQW4gb3B0aW9uYWwgcG9zaXRpb24gZnJvbSB0aGUgc3RhcnQgdG8gc2VhcmNoIHVwIHRvIHRoaXMgaW5kZXhcbiAqIEByZXR1cm5zIHtib29sZWFufSAtIFRydWUgaWYgdGhlIHN0ciBzdHJpbmcgZW5kcyB3aXRoIHRoZSB0YXJnZXQgc3RyaW5nLlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCBpc1ByZWZpeCA9IGVuZHNXaXRoKCdmb29CYXInLCAnZm9vJykgLy8gcmV0dXJucyB0cnVlXG4gKiBjb25zdCBpc1ByZWZpeCA9IGVuZHNXaXRoKCdmb29CYXInLCAnYmFyJykgLy8gcmV0dXJucyBmYWxzZVxuICogY29uc3QgaXNQcmVmaXggPSBlbmRzV2l0aCgnZm9vQmFyJywgJ2FiYycpIC8vIHJldHVybnMgZmFsc2VcbiAqIGNvbnN0IGlzUHJlZml4ID0gZW5kc1dpdGgoJ2Zvb0JhcicsICdmb28nLCAzKSAvLyByZXR1cm5zIHRydWVcbiAqIGNvbnN0IGlzUHJlZml4ID0gZW5kc1dpdGgoJ2Zvb0JhcicsICdhYmMnLCA1KSAvLyByZXR1cm5zIGZhbHNlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBlbmRzV2l0aChzdHI6IHN0cmluZywgdGFyZ2V0OiBzdHJpbmcsIHBvc2l0aW9uOiBudW1iZXIgPSBzdHIubGVuZ3RoKTogYm9vbGVhbiB7XG4gIHJldHVybiBzdHIuZW5kc1dpdGgodGFyZ2V0LCBwb3NpdGlvbik7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FnQkMsR0FDRCxPQUFPLFNBQVMsU0FBUyxHQUFXLEVBQUUsTUFBYyxFQUFFLFdBQW1CLElBQUksTUFBTTtFQUNqRixPQUFPLElBQUksUUFBUSxDQUFDLFFBQVE7QUFDOUIifQ==
// denoCacheMetadata=2102315952686850004,7189042178289818199