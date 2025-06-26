/**
 * Checks if `value` is an integer.
 *
 * This function can also serve as a type predicate in TypeScript, narrowing the type of the argument to `number`.
 *
 * @param {unknown} value - The value to check
 * @returns {boolean} `true` if `value` is integer, otherwise `false`.
 *
 * @example
 * isInteger(3); // Returns: true
 * isInteger(Infinity); // Returns: false
 * isInteger('3'); // Returns: false
 * isInteger([]); // Returns: false
 */ export function isInteger(value) {
  return Number.isInteger(value);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvcHJlZGljYXRlL2lzSW50ZWdlci50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGFuIGludGVnZXIuXG4gKlxuICogVGhpcyBmdW5jdGlvbiBjYW4gYWxzbyBzZXJ2ZSBhcyBhIHR5cGUgcHJlZGljYXRlIGluIFR5cGVTY3JpcHQsIG5hcnJvd2luZyB0aGUgdHlwZSBvZiB0aGUgYXJndW1lbnQgdG8gYG51bWJlcmAuXG4gKlxuICogQHBhcmFtIHt1bmtub3dufSB2YWx1ZSAtIFRoZSB2YWx1ZSB0byBjaGVja1xuICogQHJldHVybnMge2Jvb2xlYW59IGB0cnVlYCBpZiBgdmFsdWVgIGlzIGludGVnZXIsIG90aGVyd2lzZSBgZmFsc2VgLlxuICpcbiAqIEBleGFtcGxlXG4gKiBpc0ludGVnZXIoMyk7IC8vIFJldHVybnM6IHRydWVcbiAqIGlzSW50ZWdlcihJbmZpbml0eSk7IC8vIFJldHVybnM6IGZhbHNlXG4gKiBpc0ludGVnZXIoJzMnKTsgLy8gUmV0dXJuczogZmFsc2VcbiAqIGlzSW50ZWdlcihbXSk7IC8vIFJldHVybnM6IGZhbHNlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc0ludGVnZXIodmFsdWU/OiB1bmtub3duKTogdmFsdWUgaXMgbnVtYmVyIHtcbiAgcmV0dXJuIE51bWJlci5pc0ludGVnZXIodmFsdWUpO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7O0NBYUMsR0FDRCxPQUFPLFNBQVMsVUFBVSxLQUFlO0VBQ3ZDLE9BQU8sT0FBTyxTQUFTLENBQUM7QUFDMUIifQ==
// denoCacheMetadata=11192611888752629700,14003303501244721493