const htmlEscapes = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};
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
 */ export function escape(str) {
  return str.replace(/[&<>"']/g, (match)=>htmlEscapes[match]);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9zdHJpbmcvZXNjYXBlLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImNvbnN0IGh0bWxFc2NhcGVzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICAnJic6ICcmYW1wOycsXG4gICc8JzogJyZsdDsnLFxuICAnPic6ICcmZ3Q7JyxcbiAgJ1wiJzogJyZxdW90OycsXG4gIFwiJ1wiOiAnJiMzOTsnLFxufTtcblxuLyoqXG4gKiBDb252ZXJ0cyB0aGUgY2hhcmFjdGVycyBcIiZcIiwgXCI8XCIsIFwiPlwiLCAnXCInLCBhbmQgXCInXCIgaW4gYHN0cmAgdG8gdGhlaXIgY29ycmVzcG9uZGluZyBIVE1MIGVudGl0aWVzLlxuICogRm9yIGV4YW1wbGUsIFwiPFwiIGJlY29tZXMgXCImbHQ7XCIuXG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IHN0ciAgVGhlIHN0cmluZyB0byBlc2NhcGUuXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBSZXR1cm5zIHRoZSBlc2NhcGVkIHN0cmluZy5cbiAqXG4gKiBAZXhhbXBsZVxuICogZXNjYXBlKCdUaGlzIGlzIGEgPGRpdj4gZWxlbWVudC4nKTsgLy8gcmV0dXJucyAnVGhpcyBpcyBhICZsdDtkaXYmZ3Q7IGVsZW1lbnQuJ1xuICogZXNjYXBlKCdUaGlzIGlzIGEgXCJxdW90ZVwiJyk7IC8vIHJldHVybnMgJ1RoaXMgaXMgYSAmcXVvdDtxdW90ZSZxdW90OydcbiAqIGVzY2FwZShcIlRoaXMgaXMgYSAncXVvdGUnXCIpOyAvLyByZXR1cm5zICdUaGlzIGlzIGEgJiMzOTtxdW90ZSYjMzk7J1xuICogZXNjYXBlKCdUaGlzIGlzIGEgJiBzeW1ib2wnKTsgLy8gcmV0dXJucyAnVGhpcyBpcyBhICZhbXA7IHN5bWJvbCdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGVzY2FwZShzdHI6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBzdHIucmVwbGFjZSgvWyY8PlwiJ10vZywgbWF0Y2ggPT4gaHRtbEVzY2FwZXNbbWF0Y2hdKTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxNQUFNLGNBQXNDO0VBQzFDLEtBQUs7RUFDTCxLQUFLO0VBQ0wsS0FBSztFQUNMLEtBQUs7RUFDTCxLQUFLO0FBQ1A7QUFFQTs7Ozs7Ozs7Ozs7O0NBWUMsR0FDRCxPQUFPLFNBQVMsT0FBTyxHQUFXO0VBQ2hDLE9BQU8sSUFBSSxPQUFPLENBQUMsWUFBWSxDQUFBLFFBQVMsV0FBVyxDQUFDLE1BQU07QUFDNUQifQ==
// denoCacheMetadata=9092971855470042395,15821279832492655693