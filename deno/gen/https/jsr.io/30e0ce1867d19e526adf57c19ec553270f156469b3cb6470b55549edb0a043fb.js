/**
 * Converts a deep key string into an array of path segments.
 *
 * This function takes a string representing a deep key (e.g., 'a.b.c' or 'a[b][c]') and breaks it down into an array of strings, each representing a segment of the path.
 *
 * @param {string} deepKey - The deep key string to convert.
 * @returns {string[]} An array of strings, each representing a segment of the path.
 *
 * Examples:
 *
 * toPath('a.b.c') // Returns ['a', 'b', 'c']
 * toPath('a[b][c]') // Returns ['a', 'b', 'c']
 * toPath('.a.b.c') // Returns ['', 'a', 'b', 'c']
 * toPath('a["b.c"].d') // Returns ['a', 'b.c', 'd']
 * toPath('') // Returns []
 * toPath('.a[b].c.d[e]["f.g"].h') // Returns ['', 'a', 'b', 'c', 'd', 'e', 'f.g', 'h']
 */ export function toPath(deepKey) {
  const result = [];
  const length = deepKey.length;
  if (length === 0) {
    return result;
  }
  let index = 0;
  let key = '';
  let quoteChar = '';
  let bracket = false;
  // Leading dot
  if (deepKey.charCodeAt(0) === 46) {
    result.push('');
    index++;
  }
  while(index < length){
    const char = deepKey[index];
    if (quoteChar) {
      if (char === '\\' && index + 1 < length) {
        // Escape character
        index++;
        key += deepKey[index];
      } else if (char === quoteChar) {
        // End of quote
        quoteChar = '';
      } else {
        key += char;
      }
    } else if (bracket) {
      if (char === '"' || char === "'") {
        // Start of quoted string inside brackets
        quoteChar = char;
      } else if (char === ']') {
        // End of bracketed segment
        bracket = false;
        result.push(key);
        key = '';
      } else {
        key += char;
      }
    } else {
      if (char === '[') {
        // Start of bracketed segment
        bracket = true;
        if (key) {
          result.push(key);
          key = '';
        }
      } else if (char === '.') {
        if (key) {
          result.push(key);
          key = '';
        }
      } else {
        key += char;
      }
    }
    index++;
  }
  if (key) {
    result.push(key);
  }
  return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvdXRpbC90b1BhdGgudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBDb252ZXJ0cyBhIGRlZXAga2V5IHN0cmluZyBpbnRvIGFuIGFycmF5IG9mIHBhdGggc2VnbWVudHMuXG4gKlxuICogVGhpcyBmdW5jdGlvbiB0YWtlcyBhIHN0cmluZyByZXByZXNlbnRpbmcgYSBkZWVwIGtleSAoZS5nLiwgJ2EuYi5jJyBvciAnYVtiXVtjXScpIGFuZCBicmVha3MgaXQgZG93biBpbnRvIGFuIGFycmF5IG9mIHN0cmluZ3MsIGVhY2ggcmVwcmVzZW50aW5nIGEgc2VnbWVudCBvZiB0aGUgcGF0aC5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gZGVlcEtleSAtIFRoZSBkZWVwIGtleSBzdHJpbmcgdG8gY29udmVydC5cbiAqIEByZXR1cm5zIHtzdHJpbmdbXX0gQW4gYXJyYXkgb2Ygc3RyaW5ncywgZWFjaCByZXByZXNlbnRpbmcgYSBzZWdtZW50IG9mIHRoZSBwYXRoLlxuICpcbiAqIEV4YW1wbGVzOlxuICpcbiAqIHRvUGF0aCgnYS5iLmMnKSAvLyBSZXR1cm5zIFsnYScsICdiJywgJ2MnXVxuICogdG9QYXRoKCdhW2JdW2NdJykgLy8gUmV0dXJucyBbJ2EnLCAnYicsICdjJ11cbiAqIHRvUGF0aCgnLmEuYi5jJykgLy8gUmV0dXJucyBbJycsICdhJywgJ2InLCAnYyddXG4gKiB0b1BhdGgoJ2FbXCJiLmNcIl0uZCcpIC8vIFJldHVybnMgWydhJywgJ2IuYycsICdkJ11cbiAqIHRvUGF0aCgnJykgLy8gUmV0dXJucyBbXVxuICogdG9QYXRoKCcuYVtiXS5jLmRbZV1bXCJmLmdcIl0uaCcpIC8vIFJldHVybnMgWycnLCAnYScsICdiJywgJ2MnLCAnZCcsICdlJywgJ2YuZycsICdoJ11cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRvUGF0aChkZWVwS2V5OiBzdHJpbmcpOiBzdHJpbmdbXSB7XG4gIGNvbnN0IHJlc3VsdDogc3RyaW5nW10gPSBbXTtcbiAgY29uc3QgbGVuZ3RoID0gZGVlcEtleS5sZW5ndGg7XG5cbiAgaWYgKGxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBsZXQgaW5kZXggPSAwO1xuICBsZXQga2V5ID0gJyc7XG4gIGxldCBxdW90ZUNoYXIgPSAnJztcbiAgbGV0IGJyYWNrZXQgPSBmYWxzZTtcblxuICAvLyBMZWFkaW5nIGRvdFxuICBpZiAoZGVlcEtleS5jaGFyQ29kZUF0KDApID09PSA0Nikge1xuICAgIHJlc3VsdC5wdXNoKCcnKTtcbiAgICBpbmRleCsrO1xuICB9XG5cbiAgd2hpbGUgKGluZGV4IDwgbGVuZ3RoKSB7XG4gICAgY29uc3QgY2hhciA9IGRlZXBLZXlbaW5kZXhdO1xuXG4gICAgaWYgKHF1b3RlQ2hhcikge1xuICAgICAgaWYgKGNoYXIgPT09ICdcXFxcJyAmJiBpbmRleCArIDEgPCBsZW5ndGgpIHtcbiAgICAgICAgLy8gRXNjYXBlIGNoYXJhY3RlclxuICAgICAgICBpbmRleCsrO1xuICAgICAgICBrZXkgKz0gZGVlcEtleVtpbmRleF07XG4gICAgICB9IGVsc2UgaWYgKGNoYXIgPT09IHF1b3RlQ2hhcikge1xuICAgICAgICAvLyBFbmQgb2YgcXVvdGVcbiAgICAgICAgcXVvdGVDaGFyID0gJyc7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBrZXkgKz0gY2hhcjtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGJyYWNrZXQpIHtcbiAgICAgIGlmIChjaGFyID09PSAnXCInIHx8IGNoYXIgPT09IFwiJ1wiKSB7XG4gICAgICAgIC8vIFN0YXJ0IG9mIHF1b3RlZCBzdHJpbmcgaW5zaWRlIGJyYWNrZXRzXG4gICAgICAgIHF1b3RlQ2hhciA9IGNoYXI7XG4gICAgICB9IGVsc2UgaWYgKGNoYXIgPT09ICddJykge1xuICAgICAgICAvLyBFbmQgb2YgYnJhY2tldGVkIHNlZ21lbnRcbiAgICAgICAgYnJhY2tldCA9IGZhbHNlO1xuICAgICAgICByZXN1bHQucHVzaChrZXkpO1xuICAgICAgICBrZXkgPSAnJztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGtleSArPSBjaGFyO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoY2hhciA9PT0gJ1snKSB7XG4gICAgICAgIC8vIFN0YXJ0IG9mIGJyYWNrZXRlZCBzZWdtZW50XG4gICAgICAgIGJyYWNrZXQgPSB0cnVlO1xuICAgICAgICBpZiAoa2V5KSB7XG4gICAgICAgICAgcmVzdWx0LnB1c2goa2V5KTtcbiAgICAgICAgICBrZXkgPSAnJztcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChjaGFyID09PSAnLicpIHtcbiAgICAgICAgaWYgKGtleSkge1xuICAgICAgICAgIHJlc3VsdC5wdXNoKGtleSk7XG4gICAgICAgICAga2V5ID0gJyc7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGtleSArPSBjaGFyO1xuICAgICAgfVxuICAgIH1cblxuICAgIGluZGV4Kys7XG4gIH1cblxuICBpZiAoa2V5KSB7XG4gICAgcmVzdWx0LnB1c2goa2V5KTtcbiAgfVxuXG4gIHJldHVybiByZXN1bHQ7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FnQkMsR0FDRCxPQUFPLFNBQVMsT0FBTyxPQUFlO0VBQ3BDLE1BQU0sU0FBbUIsRUFBRTtFQUMzQixNQUFNLFNBQVMsUUFBUSxNQUFNO0VBRTdCLElBQUksV0FBVyxHQUFHO0lBQ2hCLE9BQU87RUFDVDtFQUVBLElBQUksUUFBUTtFQUNaLElBQUksTUFBTTtFQUNWLElBQUksWUFBWTtFQUNoQixJQUFJLFVBQVU7RUFFZCxjQUFjO0VBQ2QsSUFBSSxRQUFRLFVBQVUsQ0FBQyxPQUFPLElBQUk7SUFDaEMsT0FBTyxJQUFJLENBQUM7SUFDWjtFQUNGO0VBRUEsTUFBTyxRQUFRLE9BQVE7SUFDckIsTUFBTSxPQUFPLE9BQU8sQ0FBQyxNQUFNO0lBRTNCLElBQUksV0FBVztNQUNiLElBQUksU0FBUyxRQUFRLFFBQVEsSUFBSSxRQUFRO1FBQ3ZDLG1CQUFtQjtRQUNuQjtRQUNBLE9BQU8sT0FBTyxDQUFDLE1BQU07TUFDdkIsT0FBTyxJQUFJLFNBQVMsV0FBVztRQUM3QixlQUFlO1FBQ2YsWUFBWTtNQUNkLE9BQU87UUFDTCxPQUFPO01BQ1Q7SUFDRixPQUFPLElBQUksU0FBUztNQUNsQixJQUFJLFNBQVMsT0FBTyxTQUFTLEtBQUs7UUFDaEMseUNBQXlDO1FBQ3pDLFlBQVk7TUFDZCxPQUFPLElBQUksU0FBUyxLQUFLO1FBQ3ZCLDJCQUEyQjtRQUMzQixVQUFVO1FBQ1YsT0FBTyxJQUFJLENBQUM7UUFDWixNQUFNO01BQ1IsT0FBTztRQUNMLE9BQU87TUFDVDtJQUNGLE9BQU87TUFDTCxJQUFJLFNBQVMsS0FBSztRQUNoQiw2QkFBNkI7UUFDN0IsVUFBVTtRQUNWLElBQUksS0FBSztVQUNQLE9BQU8sSUFBSSxDQUFDO1VBQ1osTUFBTTtRQUNSO01BQ0YsT0FBTyxJQUFJLFNBQVMsS0FBSztRQUN2QixJQUFJLEtBQUs7VUFDUCxPQUFPLElBQUksQ0FBQztVQUNaLE1BQU07UUFDUjtNQUNGLE9BQU87UUFDTCxPQUFPO01BQ1Q7SUFDRjtJQUVBO0VBQ0Y7RUFFQSxJQUFJLEtBQUs7SUFDUCxPQUFPLElBQUksQ0FBQztFQUNkO0VBRUEsT0FBTztBQUNUIn0=
// denoCacheMetadata=8939847855861890974,6464224746690550277