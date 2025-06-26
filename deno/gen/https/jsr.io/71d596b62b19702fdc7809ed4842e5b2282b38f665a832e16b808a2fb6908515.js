function getPriority(a) {
  if (typeof a === 'symbol') {
    return 1;
  }
  if (a === null) {
    return 2;
  }
  if (a === undefined) {
    return 3;
  }
  if (a !== a) {
    return 4;
  }
  return 0;
}
export const compareValues = (a, b, order)=>{
  if (a !== b) {
    // If both values are strings, compare them using localeCompare.
    if (typeof a === 'string' && typeof b === 'string') {
      return order === 'desc' ? b.localeCompare(a) : a.localeCompare(b);
    }
    const aPriority = getPriority(a);
    const bPriority = getPriority(b);
    // If both values are of the same priority and are normal values, compare them.
    if (aPriority === bPriority && aPriority === 0) {
      if (a < b) {
        return order === 'desc' ? 1 : -1;
      }
      if (a > b) {
        return order === 'desc' ? -1 : 1;
      }
    }
    return order === 'desc' ? bPriority - aPriority : aPriority - bPriority;
  }
  return 0;
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvX2ludGVybmFsL2NvbXBhcmVWYWx1ZXMudHMiXSwic291cmNlc0NvbnRlbnQiOlsiZnVuY3Rpb24gZ2V0UHJpb3JpdHkoYTogdW5rbm93bik6IDAgfCAxIHwgMiB8IDMgfCA0IHtcbiAgaWYgKHR5cGVvZiBhID09PSAnc3ltYm9sJykge1xuICAgIHJldHVybiAxO1xuICB9XG5cbiAgaWYgKGEgPT09IG51bGwpIHtcbiAgICByZXR1cm4gMjtcbiAgfVxuXG4gIGlmIChhID09PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gMztcbiAgfVxuXG4gIGlmIChhICE9PSBhKSB7XG4gICAgcmV0dXJuIDQ7XG4gIH1cblxuICByZXR1cm4gMDtcbn1cblxuZXhwb3J0IGNvbnN0IGNvbXBhcmVWYWx1ZXMgPSA8Vj4oYTogViwgYjogViwgb3JkZXI6IHN0cmluZykgPT4ge1xuICBpZiAoYSAhPT0gYikge1xuICAgIC8vIElmIGJvdGggdmFsdWVzIGFyZSBzdHJpbmdzLCBjb21wYXJlIHRoZW0gdXNpbmcgbG9jYWxlQ29tcGFyZS5cbiAgICBpZiAodHlwZW9mIGEgPT09ICdzdHJpbmcnICYmIHR5cGVvZiBiID09PSAnc3RyaW5nJykge1xuICAgICAgcmV0dXJuIG9yZGVyID09PSAnZGVzYycgPyBiLmxvY2FsZUNvbXBhcmUoYSkgOiBhLmxvY2FsZUNvbXBhcmUoYik7XG4gICAgfVxuXG4gICAgY29uc3QgYVByaW9yaXR5ID0gZ2V0UHJpb3JpdHkoYSk7XG4gICAgY29uc3QgYlByaW9yaXR5ID0gZ2V0UHJpb3JpdHkoYik7XG5cbiAgICAvLyBJZiBib3RoIHZhbHVlcyBhcmUgb2YgdGhlIHNhbWUgcHJpb3JpdHkgYW5kIGFyZSBub3JtYWwgdmFsdWVzLCBjb21wYXJlIHRoZW0uXG4gICAgaWYgKGFQcmlvcml0eSA9PT0gYlByaW9yaXR5ICYmIGFQcmlvcml0eSA9PT0gMCkge1xuICAgICAgaWYgKGEgPCBiKSB7XG4gICAgICAgIHJldHVybiBvcmRlciA9PT0gJ2Rlc2MnID8gMSA6IC0xO1xuICAgICAgfVxuXG4gICAgICBpZiAoYSA+IGIpIHtcbiAgICAgICAgcmV0dXJuIG9yZGVyID09PSAnZGVzYycgPyAtMSA6IDE7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG9yZGVyID09PSAnZGVzYycgPyBiUHJpb3JpdHkgLSBhUHJpb3JpdHkgOiBhUHJpb3JpdHkgLSBiUHJpb3JpdHk7XG4gIH1cblxuICByZXR1cm4gMDtcbn07XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxZQUFZLENBQVU7RUFDN0IsSUFBSSxPQUFPLE1BQU0sVUFBVTtJQUN6QixPQUFPO0VBQ1Q7RUFFQSxJQUFJLE1BQU0sTUFBTTtJQUNkLE9BQU87RUFDVDtFQUVBLElBQUksTUFBTSxXQUFXO0lBQ25CLE9BQU87RUFDVDtFQUVBLElBQUksTUFBTSxHQUFHO0lBQ1gsT0FBTztFQUNUO0VBRUEsT0FBTztBQUNUO0FBRUEsT0FBTyxNQUFNLGdCQUFnQixDQUFJLEdBQU0sR0FBTTtFQUMzQyxJQUFJLE1BQU0sR0FBRztJQUNYLGdFQUFnRTtJQUNoRSxJQUFJLE9BQU8sTUFBTSxZQUFZLE9BQU8sTUFBTSxVQUFVO01BQ2xELE9BQU8sVUFBVSxTQUFTLEVBQUUsYUFBYSxDQUFDLEtBQUssRUFBRSxhQUFhLENBQUM7SUFDakU7SUFFQSxNQUFNLFlBQVksWUFBWTtJQUM5QixNQUFNLFlBQVksWUFBWTtJQUU5QiwrRUFBK0U7SUFDL0UsSUFBSSxjQUFjLGFBQWEsY0FBYyxHQUFHO01BQzlDLElBQUksSUFBSSxHQUFHO1FBQ1QsT0FBTyxVQUFVLFNBQVMsSUFBSSxDQUFDO01BQ2pDO01BRUEsSUFBSSxJQUFJLEdBQUc7UUFDVCxPQUFPLFVBQVUsU0FBUyxDQUFDLElBQUk7TUFDakM7SUFDRjtJQUVBLE9BQU8sVUFBVSxTQUFTLFlBQVksWUFBWSxZQUFZO0VBQ2hFO0VBRUEsT0FBTztBQUNULEVBQUUifQ==
// denoCacheMetadata=6084991676834743786,7813820579346713296