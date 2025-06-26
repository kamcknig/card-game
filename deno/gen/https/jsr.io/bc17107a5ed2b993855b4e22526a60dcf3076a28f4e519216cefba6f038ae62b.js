const htmlUnescapes = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'"
};
/**
 * Converts the HTML entities `&amp;`, `&lt;`, `&gt;`, `&quot;`, and `&#39;` in `str` to their corresponding characters.
 * It is the inverse of `escape`.
 *
 * @param {string} str The string to unescape.
 * @returns {string} Returns the unescaped string.
 *
 * @example
 * unescape('This is a &lt;div&gt; element.'); // returns 'This is a <div> element.'
 * unescape('This is a &quot;quote&quot;'); // returns 'This is a "quote"'
 * unescape('This is a &#39;quote&#39;'); // returns 'This is a 'quote''
 * unescape('This is a &amp; symbol'); // returns 'This is a & symbol'
 */ export function unescape(str) {
  return str.replace(/&(?:amp|lt|gt|quot|#(0+)?39);/g, (match)=>htmlUnescapes[match] || "'");
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9zdHJpbmcvdW5lc2NhcGUudHMiXSwic291cmNlc0NvbnRlbnQiOlsiY29uc3QgaHRtbFVuZXNjYXBlczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgJyZhbXA7JzogJyYnLFxuICAnJmx0Oyc6ICc8JyxcbiAgJyZndDsnOiAnPicsXG4gICcmcXVvdDsnOiAnXCInLFxuICAnJiMzOTsnOiBcIidcIixcbn07XG5cbi8qKlxuICogQ29udmVydHMgdGhlIEhUTUwgZW50aXRpZXMgYCZhbXA7YCwgYCZsdDtgLCBgJmd0O2AsIGAmcXVvdDtgLCBhbmQgYCYjMzk7YCBpbiBgc3RyYCB0byB0aGVpciBjb3JyZXNwb25kaW5nIGNoYXJhY3RlcnMuXG4gKiBJdCBpcyB0aGUgaW52ZXJzZSBvZiBgZXNjYXBlYC5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gc3RyIFRoZSBzdHJpbmcgdG8gdW5lc2NhcGUuXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBSZXR1cm5zIHRoZSB1bmVzY2FwZWQgc3RyaW5nLlxuICpcbiAqIEBleGFtcGxlXG4gKiB1bmVzY2FwZSgnVGhpcyBpcyBhICZsdDtkaXYmZ3Q7IGVsZW1lbnQuJyk7IC8vIHJldHVybnMgJ1RoaXMgaXMgYSA8ZGl2PiBlbGVtZW50LidcbiAqIHVuZXNjYXBlKCdUaGlzIGlzIGEgJnF1b3Q7cXVvdGUmcXVvdDsnKTsgLy8gcmV0dXJucyAnVGhpcyBpcyBhIFwicXVvdGVcIidcbiAqIHVuZXNjYXBlKCdUaGlzIGlzIGEgJiMzOTtxdW90ZSYjMzk7Jyk7IC8vIHJldHVybnMgJ1RoaXMgaXMgYSAncXVvdGUnJ1xuICogdW5lc2NhcGUoJ1RoaXMgaXMgYSAmYW1wOyBzeW1ib2wnKTsgLy8gcmV0dXJucyAnVGhpcyBpcyBhICYgc3ltYm9sJ1xuICovXG5leHBvcnQgZnVuY3Rpb24gdW5lc2NhcGUoc3RyOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gc3RyLnJlcGxhY2UoLyYoPzphbXB8bHR8Z3R8cXVvdHwjKDArKT8zOSk7L2csIG1hdGNoID0+IGh0bWxVbmVzY2FwZXNbbWF0Y2hdIHx8IFwiJ1wiKTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxNQUFNLGdCQUF3QztFQUM1QyxTQUFTO0VBQ1QsUUFBUTtFQUNSLFFBQVE7RUFDUixVQUFVO0VBQ1YsU0FBUztBQUNYO0FBRUE7Ozs7Ozs7Ozs7OztDQVlDLEdBQ0QsT0FBTyxTQUFTLFNBQVMsR0FBVztFQUNsQyxPQUFPLElBQUksT0FBTyxDQUFDLGtDQUFrQyxDQUFBLFFBQVMsYUFBYSxDQUFDLE1BQU0sSUFBSTtBQUN4RiJ9
// denoCacheMetadata=11088052464730134192,7829880335020449110