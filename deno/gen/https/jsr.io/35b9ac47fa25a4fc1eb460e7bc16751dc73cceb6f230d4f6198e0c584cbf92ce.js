import { escapeRegExp as escapeRegExpToolkit } from '../../string/escapeRegExp.ts';
import { toString } from '../util/toString.ts';
/**
 * Escapes the RegExp special characters "^", "$", "\\", ".", "*", "+", "?", "(", ")", "[", "]", "{", "}", and "|" in `str`.
 *
 * @param {string} str The string to escape.
 * @returns {string} Returns the escaped string.
 *
 * @example
 * import { escapeRegExp } from 'es-toolkit/string';
 *
 * escapeRegExp('[es-toolkit](https://es-toolkit.slash.page/)'); // returns '\[es-toolkit\]\(https://es-toolkit\.slash\.page/\)'
 */ export function escapeRegExp(str) {
  return escapeRegExpToolkit(toString(str));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvc3RyaW5nL2VzY2FwZVJlZ0V4cC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBlc2NhcGVSZWdFeHAgYXMgZXNjYXBlUmVnRXhwVG9vbGtpdCB9IGZyb20gJy4uLy4uL3N0cmluZy9lc2NhcGVSZWdFeHAudHMnO1xuaW1wb3J0IHsgdG9TdHJpbmcgfSBmcm9tICcuLi91dGlsL3RvU3RyaW5nLnRzJztcblxuLyoqXG4gKiBFc2NhcGVzIHRoZSBSZWdFeHAgc3BlY2lhbCBjaGFyYWN0ZXJzIFwiXlwiLCBcIiRcIiwgXCJcXFxcXCIsIFwiLlwiLCBcIipcIiwgXCIrXCIsIFwiP1wiLCBcIihcIiwgXCIpXCIsIFwiW1wiLCBcIl1cIiwgXCJ7XCIsIFwifVwiLCBhbmQgXCJ8XCIgaW4gYHN0cmAuXG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IHN0ciBUaGUgc3RyaW5nIHRvIGVzY2FwZS5cbiAqIEByZXR1cm5zIHtzdHJpbmd9IFJldHVybnMgdGhlIGVzY2FwZWQgc3RyaW5nLlxuICpcbiAqIEBleGFtcGxlXG4gKiBpbXBvcnQgeyBlc2NhcGVSZWdFeHAgfSBmcm9tICdlcy10b29sa2l0L3N0cmluZyc7XG4gKlxuICogZXNjYXBlUmVnRXhwKCdbZXMtdG9vbGtpdF0oaHR0cHM6Ly9lcy10b29sa2l0LnNsYXNoLnBhZ2UvKScpOyAvLyByZXR1cm5zICdcXFtlcy10b29sa2l0XFxdXFwoaHR0cHM6Ly9lcy10b29sa2l0XFwuc2xhc2hcXC5wYWdlL1xcKSdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGVzY2FwZVJlZ0V4cChzdHI/OiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gZXNjYXBlUmVnRXhwVG9vbGtpdCh0b1N0cmluZyhzdHIpKTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLGdCQUFnQixtQkFBbUIsUUFBUSwrQkFBK0I7QUFDbkYsU0FBUyxRQUFRLFFBQVEsc0JBQXNCO0FBRS9DOzs7Ozs7Ozs7O0NBVUMsR0FDRCxPQUFPLFNBQVMsYUFBYSxHQUFZO0VBQ3ZDLE9BQU8sb0JBQW9CLFNBQVM7QUFDdEMifQ==
// denoCacheMetadata=5232777306579470913,13337579529134815543