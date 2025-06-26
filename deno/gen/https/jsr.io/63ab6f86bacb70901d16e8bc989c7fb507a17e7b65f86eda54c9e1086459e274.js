import { escape as escapeToolkit } from '../../string/escape.ts';
import { toString } from '../util/toString.ts';
/**
 * Converts the characters "&", "<", ">", '"', and "'" in `str` to their corresponding HTML entities.
 * For example, "<" becomes "&lt;".
 *
 * @param {string} str  The string to escape.
 * @returns {string} Returns the escaped string.
 *
 * @example
 * escape('This is a <div> element.'); // returns 'This is a &lt;div&gt; element.'
 * escape('This is a "quote"'); // returns 'This is a &quot;quote&quot;'
 * escape("This is a 'quote'"); // returns 'This is a &#39;quote&#39;'
 * escape('This is a & symbol'); // returns 'This is a &amp; symbol'
 */ export function escape(string) {
  return escapeToolkit(toString(string));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvc3RyaW5nL2VzY2FwZS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBlc2NhcGUgYXMgZXNjYXBlVG9vbGtpdCB9IGZyb20gJy4uLy4uL3N0cmluZy9lc2NhcGUudHMnO1xuaW1wb3J0IHsgdG9TdHJpbmcgfSBmcm9tICcuLi91dGlsL3RvU3RyaW5nLnRzJztcblxuLyoqXG4gKiBDb252ZXJ0cyB0aGUgY2hhcmFjdGVycyBcIiZcIiwgXCI8XCIsIFwiPlwiLCAnXCInLCBhbmQgXCInXCIgaW4gYHN0cmAgdG8gdGhlaXIgY29ycmVzcG9uZGluZyBIVE1MIGVudGl0aWVzLlxuICogRm9yIGV4YW1wbGUsIFwiPFwiIGJlY29tZXMgXCImbHQ7XCIuXG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IHN0ciAgVGhlIHN0cmluZyB0byBlc2NhcGUuXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBSZXR1cm5zIHRoZSBlc2NhcGVkIHN0cmluZy5cbiAqXG4gKiBAZXhhbXBsZVxuICogZXNjYXBlKCdUaGlzIGlzIGEgPGRpdj4gZWxlbWVudC4nKTsgLy8gcmV0dXJucyAnVGhpcyBpcyBhICZsdDtkaXYmZ3Q7IGVsZW1lbnQuJ1xuICogZXNjYXBlKCdUaGlzIGlzIGEgXCJxdW90ZVwiJyk7IC8vIHJldHVybnMgJ1RoaXMgaXMgYSAmcXVvdDtxdW90ZSZxdW90OydcbiAqIGVzY2FwZShcIlRoaXMgaXMgYSAncXVvdGUnXCIpOyAvLyByZXR1cm5zICdUaGlzIGlzIGEgJiMzOTtxdW90ZSYjMzk7J1xuICogZXNjYXBlKCdUaGlzIGlzIGEgJiBzeW1ib2wnKTsgLy8gcmV0dXJucyAnVGhpcyBpcyBhICZhbXA7IHN5bWJvbCdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGVzY2FwZShzdHJpbmc/OiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gZXNjYXBlVG9vbGtpdCh0b1N0cmluZyhzdHJpbmcpKTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLFVBQVUsYUFBYSxRQUFRLHlCQUF5QjtBQUNqRSxTQUFTLFFBQVEsUUFBUSxzQkFBc0I7QUFFL0M7Ozs7Ozs7Ozs7OztDQVlDLEdBQ0QsT0FBTyxTQUFTLE9BQU8sTUFBZTtFQUNwQyxPQUFPLGNBQWMsU0FBUztBQUNoQyJ9
// denoCacheMetadata=5520341719692679247,12590065936576812146