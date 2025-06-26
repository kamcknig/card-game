import { deburr as deburrToolkit } from '../../string/deburr.ts';
import { toString } from '../util/toString.ts';
/**
 * Converts a string by replacing special characters and diacritical marks with their ASCII equivalents.
 * For example, "Crème brûlée" becomes "Creme brulee".
 *
 * @param {string} str - The input string to be deburred.
 * @returns {string} - The deburred string with special characters replaced by their ASCII equivalents.
 *
 * @example
 * // Basic usage:
 * deburr('Æthelred') // returns 'Aethelred'
 *
 * @example
 * // Handling diacritical marks:
 * deburr('München') // returns 'Munchen'
 *
 * @example
 * // Special characters:
 * deburr('Crème brûlée') // returns 'Creme brulee'
 */ export function deburr(str) {
  return deburrToolkit(toString(str));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvc3RyaW5nL2RlYnVyci50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBkZWJ1cnIgYXMgZGVidXJyVG9vbGtpdCB9IGZyb20gJy4uLy4uL3N0cmluZy9kZWJ1cnIudHMnO1xuaW1wb3J0IHsgdG9TdHJpbmcgfSBmcm9tICcuLi91dGlsL3RvU3RyaW5nLnRzJztcblxuLyoqXG4gKiBDb252ZXJ0cyBhIHN0cmluZyBieSByZXBsYWNpbmcgc3BlY2lhbCBjaGFyYWN0ZXJzIGFuZCBkaWFjcml0aWNhbCBtYXJrcyB3aXRoIHRoZWlyIEFTQ0lJIGVxdWl2YWxlbnRzLlxuICogRm9yIGV4YW1wbGUsIFwiQ3LDqG1lIGJyw7tsw6llXCIgYmVjb21lcyBcIkNyZW1lIGJydWxlZVwiLlxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSBzdHIgLSBUaGUgaW5wdXQgc3RyaW5nIHRvIGJlIGRlYnVycmVkLlxuICogQHJldHVybnMge3N0cmluZ30gLSBUaGUgZGVidXJyZWQgc3RyaW5nIHdpdGggc3BlY2lhbCBjaGFyYWN0ZXJzIHJlcGxhY2VkIGJ5IHRoZWlyIEFTQ0lJIGVxdWl2YWxlbnRzLlxuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBCYXNpYyB1c2FnZTpcbiAqIGRlYnVycignw4Z0aGVscmVkJykgLy8gcmV0dXJucyAnQWV0aGVscmVkJ1xuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBIYW5kbGluZyBkaWFjcml0aWNhbCBtYXJrczpcbiAqIGRlYnVycignTcO8bmNoZW4nKSAvLyByZXR1cm5zICdNdW5jaGVuJ1xuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBTcGVjaWFsIGNoYXJhY3RlcnM6XG4gKiBkZWJ1cnIoJ0Nyw6htZSBicsO7bMOpZScpIC8vIHJldHVybnMgJ0NyZW1lIGJydWxlZSdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRlYnVycihzdHI/OiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gZGVidXJyVG9vbGtpdCh0b1N0cmluZyhzdHIpKTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLFVBQVUsYUFBYSxRQUFRLHlCQUF5QjtBQUNqRSxTQUFTLFFBQVEsUUFBUSxzQkFBc0I7QUFFL0M7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQWtCQyxHQUNELE9BQU8sU0FBUyxPQUFPLEdBQVk7RUFDakMsT0FBTyxjQUFjLFNBQVM7QUFDaEMifQ==
// denoCacheMetadata=17812213179188434659,4386875732108743942