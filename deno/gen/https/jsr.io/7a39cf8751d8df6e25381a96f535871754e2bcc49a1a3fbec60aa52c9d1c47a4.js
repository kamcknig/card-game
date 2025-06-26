import { decimalAdjust } from '../_internal/decimalAdjust.ts';
/**
 * Computes number rounded up to precision.
 *
 * @param {number | string} number The number to round up.
 * @param {number | string} precision The precision to round up to.
 * @returns {number} Returns the rounded up number.
 *
 * @example
 * ceil(4.006); // => 5
 * ceil(6.004, 2); // => 6.01
 * ceil(6040, -2); // => 6100
 */ export function ceil(number, precision = 0) {
  return decimalAdjust('ceil', number, precision);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvbWF0aC9jZWlsLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGRlY2ltYWxBZGp1c3QgfSBmcm9tICcuLi9faW50ZXJuYWwvZGVjaW1hbEFkanVzdC50cyc7XG5cbi8qKlxuICogQ29tcHV0ZXMgbnVtYmVyIHJvdW5kZWQgdXAgdG8gcHJlY2lzaW9uLlxuICpcbiAqIEBwYXJhbSB7bnVtYmVyIHwgc3RyaW5nfSBudW1iZXIgVGhlIG51bWJlciB0byByb3VuZCB1cC5cbiAqIEBwYXJhbSB7bnVtYmVyIHwgc3RyaW5nfSBwcmVjaXNpb24gVGhlIHByZWNpc2lvbiB0byByb3VuZCB1cCB0by5cbiAqIEByZXR1cm5zIHtudW1iZXJ9IFJldHVybnMgdGhlIHJvdW5kZWQgdXAgbnVtYmVyLlxuICpcbiAqIEBleGFtcGxlXG4gKiBjZWlsKDQuMDA2KTsgLy8gPT4gNVxuICogY2VpbCg2LjAwNCwgMik7IC8vID0+IDYuMDFcbiAqIGNlaWwoNjA0MCwgLTIpOyAvLyA9PiA2MTAwXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjZWlsKG51bWJlcjogbnVtYmVyIHwgc3RyaW5nLCBwcmVjaXNpb246IG51bWJlciB8IHN0cmluZyA9IDApOiBudW1iZXIge1xuICByZXR1cm4gZGVjaW1hbEFkanVzdCgnY2VpbCcsIG51bWJlciwgcHJlY2lzaW9uKTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLGFBQWEsUUFBUSxnQ0FBZ0M7QUFFOUQ7Ozs7Ozs7Ozs7O0NBV0MsR0FDRCxPQUFPLFNBQVMsS0FBSyxNQUF1QixFQUFFLFlBQTZCLENBQUM7RUFDMUUsT0FBTyxjQUFjLFFBQVEsUUFBUTtBQUN2QyJ9
// denoCacheMetadata=6767714452912182786,9034980965419532468