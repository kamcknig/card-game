// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
export class Tokenizer {
  rules;
  constructor(rules = []){
    this.rules = rules;
  }
  addRule(test, fn) {
    this.rules.push({
      test,
      fn
    });
    return this;
  }
  tokenize(string, receiver = (token)=>token) {
    function* generator(rules) {
      let index = 0;
      for (const rule of rules){
        const result = rule.test(string);
        if (result) {
          const { value, length } = result;
          index += length;
          string = string.slice(length);
          const token = {
            ...rule.fn(value),
            index
          };
          yield receiver(token);
          yield* generator(rules);
        }
      }
    }
    const tokenGenerator = generator(this.rules);
    const tokens = [];
    for (const token of tokenGenerator){
      tokens.push(token);
    }
    if (string.length) {
      throw new Error(`parser error: string not fully parsed! ${string.slice(0, 25)}`);
    }
    return tokens;
  }
}
function digits(value, count = 2) {
  return String(value).padStart(count, "0");
}
function createLiteralTestFunction(value) {
  return (string)=>{
    return string.startsWith(value) ? {
      value,
      length: value.length
    } : undefined;
  };
}
function createMatchTestFunction(match) {
  return (string)=>{
    const result = match.exec(string);
    if (result) return {
      value: result,
      length: result[0].length
    };
  };
}
// according to unicode symbols (http://www.unicode.org/reports/tr35/tr35-dates.html#Date_Field_Symbol_Table)
const DATE_TIME_FORMATTER_DEFAULT_RULES = [
  {
    test: createLiteralTestFunction("yyyy"),
    fn: ()=>({
        type: "year",
        value: "numeric"
      })
  },
  {
    test: createLiteralTestFunction("yy"),
    fn: ()=>({
        type: "year",
        value: "2-digit"
      })
  },
  {
    test: createLiteralTestFunction("MM"),
    fn: ()=>({
        type: "month",
        value: "2-digit"
      })
  },
  {
    test: createLiteralTestFunction("M"),
    fn: ()=>({
        type: "month",
        value: "numeric"
      })
  },
  {
    test: createLiteralTestFunction("dd"),
    fn: ()=>({
        type: "day",
        value: "2-digit"
      })
  },
  {
    test: createLiteralTestFunction("d"),
    fn: ()=>({
        type: "day",
        value: "numeric"
      })
  },
  {
    test: createLiteralTestFunction("HH"),
    fn: ()=>({
        type: "hour",
        value: "2-digit"
      })
  },
  {
    test: createLiteralTestFunction("H"),
    fn: ()=>({
        type: "hour",
        value: "numeric"
      })
  },
  {
    test: createLiteralTestFunction("hh"),
    fn: ()=>({
        type: "hour",
        value: "2-digit",
        hour12: true
      })
  },
  {
    test: createLiteralTestFunction("h"),
    fn: ()=>({
        type: "hour",
        value: "numeric",
        hour12: true
      })
  },
  {
    test: createLiteralTestFunction("mm"),
    fn: ()=>({
        type: "minute",
        value: "2-digit"
      })
  },
  {
    test: createLiteralTestFunction("m"),
    fn: ()=>({
        type: "minute",
        value: "numeric"
      })
  },
  {
    test: createLiteralTestFunction("ss"),
    fn: ()=>({
        type: "second",
        value: "2-digit"
      })
  },
  {
    test: createLiteralTestFunction("s"),
    fn: ()=>({
        type: "second",
        value: "numeric"
      })
  },
  {
    test: createLiteralTestFunction("SSS"),
    fn: ()=>({
        type: "fractionalSecond",
        value: 3
      })
  },
  {
    test: createLiteralTestFunction("SS"),
    fn: ()=>({
        type: "fractionalSecond",
        value: 2
      })
  },
  {
    test: createLiteralTestFunction("S"),
    fn: ()=>({
        type: "fractionalSecond",
        value: 1
      })
  },
  {
    test: createLiteralTestFunction("a"),
    fn: (value)=>({
        type: "dayPeriod",
        value: value
      })
  },
  // quoted literal
  {
    test: createMatchTestFunction(/^(')(?<value>\\.|[^\']*)\1/),
    fn: (match)=>({
        type: "literal",
        value: match.groups.value
      })
  },
  // literal
  {
    test: createMatchTestFunction(/^.+?\s*/),
    fn: (match)=>({
        type: "literal",
        value: match[0]
      })
  }
];
export class DateTimeFormatter {
  #format;
  constructor(formatString, rules = [
    ...DATE_TIME_FORMATTER_DEFAULT_RULES
  ]){
    const tokenizer = new Tokenizer(rules);
    this.#format = tokenizer.tokenize(formatString, ({ type, value, hour12 })=>{
      const result = {
        type,
        value
      };
      if (hour12) result.hour12 = hour12;
      return result;
    });
  }
  format(date, options = {}) {
    let string = "";
    const utc = options.timeZone === "UTC";
    for (const token of this.#format){
      const type = token.type;
      switch(type){
        case "year":
          {
            const value = utc ? date.getUTCFullYear() : date.getFullYear();
            switch(token.value){
              case "numeric":
                {
                  string += value;
                  break;
                }
              case "2-digit":
                {
                  string += digits(value, 2).slice(-2);
                  break;
                }
              default:
                throw Error(`FormatterError: value "${token.value}" is not supported`);
            }
            break;
          }
        case "month":
          {
            const value = (utc ? date.getUTCMonth() : date.getMonth()) + 1;
            switch(token.value){
              case "numeric":
                {
                  string += value;
                  break;
                }
              case "2-digit":
                {
                  string += digits(value, 2);
                  break;
                }
              default:
                throw Error(`FormatterError: value "${token.value}" is not supported`);
            }
            break;
          }
        case "day":
          {
            const value = utc ? date.getUTCDate() : date.getDate();
            switch(token.value){
              case "numeric":
                {
                  string += value;
                  break;
                }
              case "2-digit":
                {
                  string += digits(value, 2);
                  break;
                }
              default:
                throw Error(`FormatterError: value "${token.value}" is not supported`);
            }
            break;
          }
        case "hour":
          {
            let value = utc ? date.getUTCHours() : date.getHours();
            if (token.hour12) {
              if (value === 0) value = 12;
              else if (value > 12) value -= 12;
            }
            switch(token.value){
              case "numeric":
                {
                  string += value;
                  break;
                }
              case "2-digit":
                {
                  string += digits(value, 2);
                  break;
                }
              default:
                throw Error(`FormatterError: value "${token.value}" is not supported`);
            }
            break;
          }
        case "minute":
          {
            const value = utc ? date.getUTCMinutes() : date.getMinutes();
            switch(token.value){
              case "numeric":
                {
                  string += value;
                  break;
                }
              case "2-digit":
                {
                  string += digits(value, 2);
                  break;
                }
              default:
                throw Error(`FormatterError: value "${token.value}" is not supported`);
            }
            break;
          }
        case "second":
          {
            const value = utc ? date.getUTCSeconds() : date.getSeconds();
            switch(token.value){
              case "numeric":
                {
                  string += value;
                  break;
                }
              case "2-digit":
                {
                  string += digits(value, 2);
                  break;
                }
              default:
                throw Error(`FormatterError: value "${token.value}" is not supported`);
            }
            break;
          }
        case "fractionalSecond":
          {
            const value = utc ? date.getUTCMilliseconds() : date.getMilliseconds();
            string += digits(value, Number(token.value));
            break;
          }
        // FIXME(bartlomieju)
        case "timeZoneName":
          {
            break;
          }
        case "dayPeriod":
          {
            string += date.getHours() >= 12 ? "PM" : "AM";
            break;
          }
        case "literal":
          {
            string += token.value;
            break;
          }
        default:
          throw Error(`FormatterError: { ${token.type} ${token.value} }`);
      }
    }
    return string;
  }
  parseToParts(string) {
    const parts = [];
    for (const token of this.#format){
      const type = token.type;
      let value = "";
      switch(token.type){
        case "year":
          {
            switch(token.value){
              case "numeric":
                {
                  value = /^\d{1,4}/.exec(string)?.[0];
                  break;
                }
              case "2-digit":
                {
                  value = /^\d{1,2}/.exec(string)?.[0];
                  break;
                }
              default:
                throw Error(`ParserError: value "${token.value}" is not supported`);
            }
            break;
          }
        case "month":
          {
            switch(token.value){
              case "numeric":
                {
                  value = /^\d{1,2}/.exec(string)?.[0];
                  break;
                }
              case "2-digit":
                {
                  value = /^\d{2}/.exec(string)?.[0];
                  break;
                }
              case "narrow":
                {
                  value = /^[a-zA-Z]+/.exec(string)?.[0];
                  break;
                }
              case "short":
                {
                  value = /^[a-zA-Z]+/.exec(string)?.[0];
                  break;
                }
              case "long":
                {
                  value = /^[a-zA-Z]+/.exec(string)?.[0];
                  break;
                }
              default:
                throw Error(`ParserError: value "${token.value}" is not supported`);
            }
            break;
          }
        case "day":
          {
            switch(token.value){
              case "numeric":
                {
                  value = /^\d{1,2}/.exec(string)?.[0];
                  break;
                }
              case "2-digit":
                {
                  value = /^\d{2}/.exec(string)?.[0];
                  break;
                }
              default:
                throw Error(`ParserError: value "${token.value}" is not supported`);
            }
            break;
          }
        case "hour":
          {
            switch(token.value){
              case "numeric":
                {
                  value = /^\d{1,2}/.exec(string)?.[0];
                  if (token.hour12 && parseInt(value) > 12) {
                    console.error(`Trying to parse hour greater than 12. Use 'H' instead of 'h'.`);
                  }
                  break;
                }
              case "2-digit":
                {
                  value = /^\d{2}/.exec(string)?.[0];
                  if (token.hour12 && parseInt(value) > 12) {
                    console.error(`Trying to parse hour greater than 12. Use 'HH' instead of 'hh'.`);
                  }
                  break;
                }
              default:
                throw Error(`ParserError: value "${token.value}" is not supported`);
            }
            break;
          }
        case "minute":
          {
            switch(token.value){
              case "numeric":
                {
                  value = /^\d{1,2}/.exec(string)?.[0];
                  break;
                }
              case "2-digit":
                {
                  value = /^\d{2}/.exec(string)?.[0];
                  break;
                }
              default:
                throw Error(`ParserError: value "${token.value}" is not supported`);
            }
            break;
          }
        case "second":
          {
            switch(token.value){
              case "numeric":
                {
                  value = /^\d{1,2}/.exec(string)?.[0];
                  break;
                }
              case "2-digit":
                {
                  value = /^\d{2}/.exec(string)?.[0];
                  break;
                }
              default:
                throw Error(`ParserError: value "${token.value}" is not supported`);
            }
            break;
          }
        case "fractionalSecond":
          {
            value = new RegExp(`^\\d{${token.value}}`).exec(string)?.[0];
            break;
          }
        case "timeZoneName":
          {
            value = token.value;
            break;
          }
        case "dayPeriod":
          {
            value = /^(A|P)M/.exec(string)?.[0];
            break;
          }
        case "literal":
          {
            if (!string.startsWith(token.value)) {
              throw Error(`Literal "${token.value}" not found "${string.slice(0, 25)}"`);
            }
            value = token.value;
            break;
          }
        default:
          throw Error(`${token.type} ${token.value}`);
      }
      if (!value) {
        throw Error(`value not valid for token { ${type} ${value} } ${string.slice(0, 25)}`);
      }
      parts.push({
        type,
        value
      });
      string = string.slice(value.length);
    }
    if (string.length) {
      throw Error(`datetime string was not fully parsed! ${string.slice(0, 25)}`);
    }
    return parts;
  }
  /** sort & filter dateTimeFormatPart */ sortDateTimeFormatPart(parts) {
    let result = [];
    const typeArray = [
      "year",
      "month",
      "day",
      "hour",
      "minute",
      "second",
      "fractionalSecond"
    ];
    for (const type of typeArray){
      const current = parts.findIndex((el)=>el.type === type);
      if (current !== -1) {
        result = result.concat(parts.splice(current, 1));
      }
    }
    result = result.concat(parts);
    return result;
  }
  partsToDate(parts) {
    const date = new Date();
    const utc = parts.find((part)=>part.type === "timeZoneName" && part.value === "UTC");
    const dayPart = parts.find((part)=>part.type === "day");
    utc ? date.setUTCHours(0, 0, 0, 0) : date.setHours(0, 0, 0, 0);
    for (const part of parts){
      switch(part.type){
        case "year":
          {
            const value = Number(part.value.padStart(4, "20"));
            utc ? date.setUTCFullYear(value) : date.setFullYear(value);
            break;
          }
        case "month":
          {
            const value = Number(part.value) - 1;
            if (dayPart) {
              utc ? date.setUTCMonth(value, Number(dayPart.value)) : date.setMonth(value, Number(dayPart.value));
            } else {
              utc ? date.setUTCMonth(value) : date.setMonth(value);
            }
            break;
          }
        case "day":
          {
            const value = Number(part.value);
            utc ? date.setUTCDate(value) : date.setDate(value);
            break;
          }
        case "hour":
          {
            let value = Number(part.value);
            const dayPeriod = parts.find((part)=>part.type === "dayPeriod");
            if (dayPeriod?.value === "PM") value += 12;
            utc ? date.setUTCHours(value) : date.setHours(value);
            break;
          }
        case "minute":
          {
            const value = Number(part.value);
            utc ? date.setUTCMinutes(value) : date.setMinutes(value);
            break;
          }
        case "second":
          {
            const value = Number(part.value);
            utc ? date.setUTCSeconds(value) : date.setSeconds(value);
            break;
          }
        case "fractionalSecond":
          {
            const value = Number(part.value);
            utc ? date.setUTCMilliseconds(value) : date.setMilliseconds(value);
            break;
          }
      }
    }
    return date;
  }
  parse(string) {
    const parts = this.parseToParts(string);
    const sortParts = this.sortDateTimeFormatPart(parts);
    return this.partsToDate(sortParts);
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0BzdGQvZGF0ZXRpbWUvMC4yMjQuMy9fZGF0ZV90aW1lX2Zvcm1hdHRlci50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDI0IHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuLy8gVGhpcyBtb2R1bGUgaXMgYnJvd3NlciBjb21wYXRpYmxlLlxuXG50eXBlIFRva2VuID0ge1xuICB0eXBlOiBzdHJpbmc7XG4gIHZhbHVlOiBzdHJpbmcgfCBudW1iZXI7XG4gIGluZGV4OiBudW1iZXI7XG4gIFtrZXk6IHN0cmluZ106IHVua25vd247XG59O1xuXG5pbnRlcmZhY2UgUmVjZWl2ZXJSZXN1bHQge1xuICBbbmFtZTogc3RyaW5nXTogc3RyaW5nIHwgbnVtYmVyIHwgdW5rbm93bjtcbn1cbnR5cGUgQ2FsbGJhY2tSZXN1bHQgPSB7XG4gIHR5cGU6IHN0cmluZztcbiAgdmFsdWU6IHN0cmluZyB8IG51bWJlcjtcbiAgW2tleTogc3RyaW5nXTogdW5rbm93bjtcbn07XG50eXBlIENhbGxiYWNrRnVuY3Rpb24gPSAodmFsdWU6IHVua25vd24pID0+IENhbGxiYWNrUmVzdWx0O1xuXG50eXBlIFRlc3RSZXN1bHQgPSB7IHZhbHVlOiB1bmtub3duOyBsZW5ndGg6IG51bWJlciB9IHwgdW5kZWZpbmVkO1xudHlwZSBUZXN0RnVuY3Rpb24gPSAoXG4gIHN0cmluZzogc3RyaW5nLFxuKSA9PiBUZXN0UmVzdWx0IHwgdW5kZWZpbmVkO1xuXG5pbnRlcmZhY2UgUnVsZSB7XG4gIHRlc3Q6IFRlc3RGdW5jdGlvbjtcbiAgZm46IENhbGxiYWNrRnVuY3Rpb247XG59XG5cbmV4cG9ydCBjbGFzcyBUb2tlbml6ZXIge1xuICBydWxlczogUnVsZVtdO1xuXG4gIGNvbnN0cnVjdG9yKHJ1bGVzOiBSdWxlW10gPSBbXSkge1xuICAgIHRoaXMucnVsZXMgPSBydWxlcztcbiAgfVxuXG4gIGFkZFJ1bGUodGVzdDogVGVzdEZ1bmN0aW9uLCBmbjogQ2FsbGJhY2tGdW5jdGlvbik6IFRva2VuaXplciB7XG4gICAgdGhpcy5ydWxlcy5wdXNoKHsgdGVzdCwgZm4gfSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICB0b2tlbml6ZShcbiAgICBzdHJpbmc6IHN0cmluZyxcbiAgICByZWNlaXZlciA9ICh0b2tlbjogVG9rZW4pOiBSZWNlaXZlclJlc3VsdCA9PiB0b2tlbixcbiAgKTogUmVjZWl2ZXJSZXN1bHRbXSB7XG4gICAgZnVuY3Rpb24qIGdlbmVyYXRvcihydWxlczogUnVsZVtdKTogSXRlcmFibGVJdGVyYXRvcjxSZWNlaXZlclJlc3VsdD4ge1xuICAgICAgbGV0IGluZGV4ID0gMDtcbiAgICAgIGZvciAoY29uc3QgcnVsZSBvZiBydWxlcykge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBydWxlLnRlc3Qoc3RyaW5nKTtcbiAgICAgICAgaWYgKHJlc3VsdCkge1xuICAgICAgICAgIGNvbnN0IHsgdmFsdWUsIGxlbmd0aCB9ID0gcmVzdWx0O1xuICAgICAgICAgIGluZGV4ICs9IGxlbmd0aDtcbiAgICAgICAgICBzdHJpbmcgPSBzdHJpbmcuc2xpY2UobGVuZ3RoKTtcbiAgICAgICAgICBjb25zdCB0b2tlbiA9IHsgLi4ucnVsZS5mbih2YWx1ZSksIGluZGV4IH07XG4gICAgICAgICAgeWllbGQgcmVjZWl2ZXIodG9rZW4pO1xuICAgICAgICAgIHlpZWxkKiBnZW5lcmF0b3IocnVsZXMpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGNvbnN0IHRva2VuR2VuZXJhdG9yID0gZ2VuZXJhdG9yKHRoaXMucnVsZXMpO1xuXG4gICAgY29uc3QgdG9rZW5zOiBSZWNlaXZlclJlc3VsdFtdID0gW107XG5cbiAgICBmb3IgKGNvbnN0IHRva2VuIG9mIHRva2VuR2VuZXJhdG9yKSB7XG4gICAgICB0b2tlbnMucHVzaCh0b2tlbik7XG4gICAgfVxuXG4gICAgaWYgKHN0cmluZy5sZW5ndGgpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgYHBhcnNlciBlcnJvcjogc3RyaW5nIG5vdCBmdWxseSBwYXJzZWQhICR7c3RyaW5nLnNsaWNlKDAsIDI1KX1gLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdG9rZW5zO1xuICB9XG59XG5cbmZ1bmN0aW9uIGRpZ2l0cyh2YWx1ZTogc3RyaW5nIHwgbnVtYmVyLCBjb3VudCA9IDIpOiBzdHJpbmcge1xuICByZXR1cm4gU3RyaW5nKHZhbHVlKS5wYWRTdGFydChjb3VudCwgXCIwXCIpO1xufVxuXG4vLyBhcyBkZWNsYXJlZCBhcyBpbiBuYW1lc3BhY2UgSW50bFxudHlwZSBEYXRlVGltZUZvcm1hdFBhcnRUeXBlcyA9XG4gIHwgXCJkYXlcIlxuICB8IFwiZGF5UGVyaW9kXCJcbiAgLy8gfCBcImVyYVwiXG4gIHwgXCJob3VyXCJcbiAgfCBcImxpdGVyYWxcIlxuICB8IFwibWludXRlXCJcbiAgfCBcIm1vbnRoXCJcbiAgfCBcInNlY29uZFwiXG4gIHwgXCJ0aW1lWm9uZU5hbWVcIlxuICAvLyB8IFwid2Vla2RheVwiXG4gIHwgXCJ5ZWFyXCJcbiAgfCBcImZyYWN0aW9uYWxTZWNvbmRcIjtcblxuaW50ZXJmYWNlIERhdGVUaW1lRm9ybWF0UGFydCB7XG4gIHR5cGU6IERhdGVUaW1lRm9ybWF0UGFydFR5cGVzO1xuICB2YWx1ZTogc3RyaW5nO1xufVxuXG50eXBlIFRpbWVab25lID0gXCJVVENcIjtcblxuaW50ZXJmYWNlIE9wdGlvbnMge1xuICB0aW1lWm9uZT86IFRpbWVab25lO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVMaXRlcmFsVGVzdEZ1bmN0aW9uKHZhbHVlOiBzdHJpbmcpOiBUZXN0RnVuY3Rpb24ge1xuICByZXR1cm4gKHN0cmluZzogc3RyaW5nKTogVGVzdFJlc3VsdCA9PiB7XG4gICAgcmV0dXJuIHN0cmluZy5zdGFydHNXaXRoKHZhbHVlKVxuICAgICAgPyB7IHZhbHVlLCBsZW5ndGg6IHZhbHVlLmxlbmd0aCB9XG4gICAgICA6IHVuZGVmaW5lZDtcbiAgfTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlTWF0Y2hUZXN0RnVuY3Rpb24obWF0Y2g6IFJlZ0V4cCk6IFRlc3RGdW5jdGlvbiB7XG4gIHJldHVybiAoc3RyaW5nOiBzdHJpbmcpOiBUZXN0UmVzdWx0ID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBtYXRjaC5leGVjKHN0cmluZyk7XG4gICAgaWYgKHJlc3VsdCkgcmV0dXJuIHsgdmFsdWU6IHJlc3VsdCwgbGVuZ3RoOiByZXN1bHRbMF0ubGVuZ3RoIH07XG4gIH07XG59XG5cbi8vIGFjY29yZGluZyB0byB1bmljb2RlIHN5bWJvbHMgKGh0dHA6Ly93d3cudW5pY29kZS5vcmcvcmVwb3J0cy90cjM1L3RyMzUtZGF0ZXMuaHRtbCNEYXRlX0ZpZWxkX1N5bWJvbF9UYWJsZSlcbmNvbnN0IERBVEVfVElNRV9GT1JNQVRURVJfREVGQVVMVF9SVUxFUyA9IFtcbiAge1xuICAgIHRlc3Q6IGNyZWF0ZUxpdGVyYWxUZXN0RnVuY3Rpb24oXCJ5eXl5XCIpLFxuICAgIGZuOiAoKTogQ2FsbGJhY2tSZXN1bHQgPT4gKHsgdHlwZTogXCJ5ZWFyXCIsIHZhbHVlOiBcIm51bWVyaWNcIiB9KSxcbiAgfSxcbiAge1xuICAgIHRlc3Q6IGNyZWF0ZUxpdGVyYWxUZXN0RnVuY3Rpb24oXCJ5eVwiKSxcbiAgICBmbjogKCk6IENhbGxiYWNrUmVzdWx0ID0+ICh7IHR5cGU6IFwieWVhclwiLCB2YWx1ZTogXCIyLWRpZ2l0XCIgfSksXG4gIH0sXG4gIHtcbiAgICB0ZXN0OiBjcmVhdGVMaXRlcmFsVGVzdEZ1bmN0aW9uKFwiTU1cIiksXG4gICAgZm46ICgpOiBDYWxsYmFja1Jlc3VsdCA9PiAoeyB0eXBlOiBcIm1vbnRoXCIsIHZhbHVlOiBcIjItZGlnaXRcIiB9KSxcbiAgfSxcbiAge1xuICAgIHRlc3Q6IGNyZWF0ZUxpdGVyYWxUZXN0RnVuY3Rpb24oXCJNXCIpLFxuICAgIGZuOiAoKTogQ2FsbGJhY2tSZXN1bHQgPT4gKHsgdHlwZTogXCJtb250aFwiLCB2YWx1ZTogXCJudW1lcmljXCIgfSksXG4gIH0sXG4gIHtcbiAgICB0ZXN0OiBjcmVhdGVMaXRlcmFsVGVzdEZ1bmN0aW9uKFwiZGRcIiksXG4gICAgZm46ICgpOiBDYWxsYmFja1Jlc3VsdCA9PiAoeyB0eXBlOiBcImRheVwiLCB2YWx1ZTogXCIyLWRpZ2l0XCIgfSksXG4gIH0sXG4gIHtcbiAgICB0ZXN0OiBjcmVhdGVMaXRlcmFsVGVzdEZ1bmN0aW9uKFwiZFwiKSxcbiAgICBmbjogKCk6IENhbGxiYWNrUmVzdWx0ID0+ICh7IHR5cGU6IFwiZGF5XCIsIHZhbHVlOiBcIm51bWVyaWNcIiB9KSxcbiAgfSxcbiAge1xuICAgIHRlc3Q6IGNyZWF0ZUxpdGVyYWxUZXN0RnVuY3Rpb24oXCJISFwiKSxcbiAgICBmbjogKCk6IENhbGxiYWNrUmVzdWx0ID0+ICh7IHR5cGU6IFwiaG91clwiLCB2YWx1ZTogXCIyLWRpZ2l0XCIgfSksXG4gIH0sXG4gIHtcbiAgICB0ZXN0OiBjcmVhdGVMaXRlcmFsVGVzdEZ1bmN0aW9uKFwiSFwiKSxcbiAgICBmbjogKCk6IENhbGxiYWNrUmVzdWx0ID0+ICh7IHR5cGU6IFwiaG91clwiLCB2YWx1ZTogXCJudW1lcmljXCIgfSksXG4gIH0sXG4gIHtcbiAgICB0ZXN0OiBjcmVhdGVMaXRlcmFsVGVzdEZ1bmN0aW9uKFwiaGhcIiksXG4gICAgZm46ICgpOiBDYWxsYmFja1Jlc3VsdCA9PiAoe1xuICAgICAgdHlwZTogXCJob3VyXCIsXG4gICAgICB2YWx1ZTogXCIyLWRpZ2l0XCIsXG4gICAgICBob3VyMTI6IHRydWUsXG4gICAgfSksXG4gIH0sXG4gIHtcbiAgICB0ZXN0OiBjcmVhdGVMaXRlcmFsVGVzdEZ1bmN0aW9uKFwiaFwiKSxcbiAgICBmbjogKCk6IENhbGxiYWNrUmVzdWx0ID0+ICh7XG4gICAgICB0eXBlOiBcImhvdXJcIixcbiAgICAgIHZhbHVlOiBcIm51bWVyaWNcIixcbiAgICAgIGhvdXIxMjogdHJ1ZSxcbiAgICB9KSxcbiAgfSxcbiAge1xuICAgIHRlc3Q6IGNyZWF0ZUxpdGVyYWxUZXN0RnVuY3Rpb24oXCJtbVwiKSxcbiAgICBmbjogKCk6IENhbGxiYWNrUmVzdWx0ID0+ICh7IHR5cGU6IFwibWludXRlXCIsIHZhbHVlOiBcIjItZGlnaXRcIiB9KSxcbiAgfSxcbiAge1xuICAgIHRlc3Q6IGNyZWF0ZUxpdGVyYWxUZXN0RnVuY3Rpb24oXCJtXCIpLFxuICAgIGZuOiAoKTogQ2FsbGJhY2tSZXN1bHQgPT4gKHsgdHlwZTogXCJtaW51dGVcIiwgdmFsdWU6IFwibnVtZXJpY1wiIH0pLFxuICB9LFxuICB7XG4gICAgdGVzdDogY3JlYXRlTGl0ZXJhbFRlc3RGdW5jdGlvbihcInNzXCIpLFxuICAgIGZuOiAoKTogQ2FsbGJhY2tSZXN1bHQgPT4gKHsgdHlwZTogXCJzZWNvbmRcIiwgdmFsdWU6IFwiMi1kaWdpdFwiIH0pLFxuICB9LFxuICB7XG4gICAgdGVzdDogY3JlYXRlTGl0ZXJhbFRlc3RGdW5jdGlvbihcInNcIiksXG4gICAgZm46ICgpOiBDYWxsYmFja1Jlc3VsdCA9PiAoeyB0eXBlOiBcInNlY29uZFwiLCB2YWx1ZTogXCJudW1lcmljXCIgfSksXG4gIH0sXG4gIHtcbiAgICB0ZXN0OiBjcmVhdGVMaXRlcmFsVGVzdEZ1bmN0aW9uKFwiU1NTXCIpLFxuICAgIGZuOiAoKTogQ2FsbGJhY2tSZXN1bHQgPT4gKHsgdHlwZTogXCJmcmFjdGlvbmFsU2Vjb25kXCIsIHZhbHVlOiAzIH0pLFxuICB9LFxuICB7XG4gICAgdGVzdDogY3JlYXRlTGl0ZXJhbFRlc3RGdW5jdGlvbihcIlNTXCIpLFxuICAgIGZuOiAoKTogQ2FsbGJhY2tSZXN1bHQgPT4gKHsgdHlwZTogXCJmcmFjdGlvbmFsU2Vjb25kXCIsIHZhbHVlOiAyIH0pLFxuICB9LFxuICB7XG4gICAgdGVzdDogY3JlYXRlTGl0ZXJhbFRlc3RGdW5jdGlvbihcIlNcIiksXG4gICAgZm46ICgpOiBDYWxsYmFja1Jlc3VsdCA9PiAoeyB0eXBlOiBcImZyYWN0aW9uYWxTZWNvbmRcIiwgdmFsdWU6IDEgfSksXG4gIH0sXG4gIHtcbiAgICB0ZXN0OiBjcmVhdGVMaXRlcmFsVGVzdEZ1bmN0aW9uKFwiYVwiKSxcbiAgICBmbjogKHZhbHVlOiB1bmtub3duKTogQ2FsbGJhY2tSZXN1bHQgPT4gKHtcbiAgICAgIHR5cGU6IFwiZGF5UGVyaW9kXCIsXG4gICAgICB2YWx1ZTogdmFsdWUgYXMgc3RyaW5nLFxuICAgIH0pLFxuICB9LFxuICAvLyBxdW90ZWQgbGl0ZXJhbFxuICB7XG4gICAgdGVzdDogY3JlYXRlTWF0Y2hUZXN0RnVuY3Rpb24oL14oJykoPzx2YWx1ZT5cXFxcLnxbXlxcJ10qKVxcMS8pLFxuICAgIGZuOiAobWF0Y2g6IHVua25vd24pOiBDYWxsYmFja1Jlc3VsdCA9PiAoe1xuICAgICAgdHlwZTogXCJsaXRlcmFsXCIsXG4gICAgICB2YWx1ZTogKG1hdGNoIGFzIFJlZ0V4cEV4ZWNBcnJheSkuZ3JvdXBzIS52YWx1ZSBhcyBzdHJpbmcsXG4gICAgfSksXG4gIH0sXG4gIC8vIGxpdGVyYWxcbiAge1xuICAgIHRlc3Q6IGNyZWF0ZU1hdGNoVGVzdEZ1bmN0aW9uKC9eLis/XFxzKi8pLFxuICAgIGZuOiAobWF0Y2g6IHVua25vd24pOiBDYWxsYmFja1Jlc3VsdCA9PiAoe1xuICAgICAgdHlwZTogXCJsaXRlcmFsXCIsXG4gICAgICB2YWx1ZTogKG1hdGNoIGFzIFJlZ0V4cEV4ZWNBcnJheSlbMF0sXG4gICAgfSksXG4gIH0sXG5dIGFzIGNvbnN0O1xuXG50eXBlIEZvcm1hdFBhcnQgPSB7XG4gIHR5cGU6IERhdGVUaW1lRm9ybWF0UGFydFR5cGVzO1xuICB2YWx1ZTogc3RyaW5nIHwgbnVtYmVyO1xuICBob3VyMTI/OiBib29sZWFuO1xufTtcbnR5cGUgRm9ybWF0ID0gRm9ybWF0UGFydFtdO1xuXG5leHBvcnQgY2xhc3MgRGF0ZVRpbWVGb3JtYXR0ZXIge1xuICAjZm9ybWF0OiBGb3JtYXQ7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgZm9ybWF0U3RyaW5nOiBzdHJpbmcsXG4gICAgcnVsZXM6IFJ1bGVbXSA9IFsuLi5EQVRFX1RJTUVfRk9STUFUVEVSX0RFRkFVTFRfUlVMRVNdLFxuICApIHtcbiAgICBjb25zdCB0b2tlbml6ZXIgPSBuZXcgVG9rZW5pemVyKHJ1bGVzKTtcbiAgICB0aGlzLiNmb3JtYXQgPSB0b2tlbml6ZXIudG9rZW5pemUoXG4gICAgICBmb3JtYXRTdHJpbmcsXG4gICAgICAoeyB0eXBlLCB2YWx1ZSwgaG91cjEyIH0pID0+IHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgICAgIHR5cGUsXG4gICAgICAgICAgdmFsdWUsXG4gICAgICAgIH0gYXMgdW5rbm93biBhcyBSZWNlaXZlclJlc3VsdDtcbiAgICAgICAgaWYgKGhvdXIxMikgcmVzdWx0LmhvdXIxMiA9IGhvdXIxMiBhcyBib29sZWFuO1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfSxcbiAgICApIGFzIEZvcm1hdDtcbiAgfVxuXG4gIGZvcm1hdChkYXRlOiBEYXRlLCBvcHRpb25zOiBPcHRpb25zID0ge30pOiBzdHJpbmcge1xuICAgIGxldCBzdHJpbmcgPSBcIlwiO1xuXG4gICAgY29uc3QgdXRjID0gb3B0aW9ucy50aW1lWm9uZSA9PT0gXCJVVENcIjtcblxuICAgIGZvciAoY29uc3QgdG9rZW4gb2YgdGhpcy4jZm9ybWF0KSB7XG4gICAgICBjb25zdCB0eXBlID0gdG9rZW4udHlwZTtcblxuICAgICAgc3dpdGNoICh0eXBlKSB7XG4gICAgICAgIGNhc2UgXCJ5ZWFyXCI6IHtcbiAgICAgICAgICBjb25zdCB2YWx1ZSA9IHV0YyA/IGRhdGUuZ2V0VVRDRnVsbFllYXIoKSA6IGRhdGUuZ2V0RnVsbFllYXIoKTtcbiAgICAgICAgICBzd2l0Y2ggKHRva2VuLnZhbHVlKSB7XG4gICAgICAgICAgICBjYXNlIFwibnVtZXJpY1wiOiB7XG4gICAgICAgICAgICAgIHN0cmluZyArPSB2YWx1ZTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXNlIFwiMi1kaWdpdFwiOiB7XG4gICAgICAgICAgICAgIHN0cmluZyArPSBkaWdpdHModmFsdWUsIDIpLnNsaWNlKC0yKTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICB0aHJvdyBFcnJvcihcbiAgICAgICAgICAgICAgICBgRm9ybWF0dGVyRXJyb3I6IHZhbHVlIFwiJHt0b2tlbi52YWx1ZX1cIiBpcyBub3Qgc3VwcG9ydGVkYCxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgY2FzZSBcIm1vbnRoXCI6IHtcbiAgICAgICAgICBjb25zdCB2YWx1ZSA9ICh1dGMgPyBkYXRlLmdldFVUQ01vbnRoKCkgOiBkYXRlLmdldE1vbnRoKCkpICsgMTtcbiAgICAgICAgICBzd2l0Y2ggKHRva2VuLnZhbHVlKSB7XG4gICAgICAgICAgICBjYXNlIFwibnVtZXJpY1wiOiB7XG4gICAgICAgICAgICAgIHN0cmluZyArPSB2YWx1ZTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXNlIFwiMi1kaWdpdFwiOiB7XG4gICAgICAgICAgICAgIHN0cmluZyArPSBkaWdpdHModmFsdWUsIDIpO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgIHRocm93IEVycm9yKFxuICAgICAgICAgICAgICAgIGBGb3JtYXR0ZXJFcnJvcjogdmFsdWUgXCIke3Rva2VuLnZhbHVlfVwiIGlzIG5vdCBzdXBwb3J0ZWRgLFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBjYXNlIFwiZGF5XCI6IHtcbiAgICAgICAgICBjb25zdCB2YWx1ZSA9IHV0YyA/IGRhdGUuZ2V0VVRDRGF0ZSgpIDogZGF0ZS5nZXREYXRlKCk7XG4gICAgICAgICAgc3dpdGNoICh0b2tlbi52YWx1ZSkge1xuICAgICAgICAgICAgY2FzZSBcIm51bWVyaWNcIjoge1xuICAgICAgICAgICAgICBzdHJpbmcgKz0gdmFsdWU7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBcIjItZGlnaXRcIjoge1xuICAgICAgICAgICAgICBzdHJpbmcgKz0gZGlnaXRzKHZhbHVlLCAyKTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICB0aHJvdyBFcnJvcihcbiAgICAgICAgICAgICAgICBgRm9ybWF0dGVyRXJyb3I6IHZhbHVlIFwiJHt0b2tlbi52YWx1ZX1cIiBpcyBub3Qgc3VwcG9ydGVkYCxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgY2FzZSBcImhvdXJcIjoge1xuICAgICAgICAgIGxldCB2YWx1ZSA9IHV0YyA/IGRhdGUuZ2V0VVRDSG91cnMoKSA6IGRhdGUuZ2V0SG91cnMoKTtcbiAgICAgICAgICBpZiAodG9rZW4uaG91cjEyKSB7XG4gICAgICAgICAgICBpZiAodmFsdWUgPT09IDApIHZhbHVlID0gMTI7XG4gICAgICAgICAgICBlbHNlIGlmICh2YWx1ZSA+IDEyKSB2YWx1ZSAtPSAxMjtcbiAgICAgICAgICB9XG4gICAgICAgICAgc3dpdGNoICh0b2tlbi52YWx1ZSkge1xuICAgICAgICAgICAgY2FzZSBcIm51bWVyaWNcIjoge1xuICAgICAgICAgICAgICBzdHJpbmcgKz0gdmFsdWU7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBcIjItZGlnaXRcIjoge1xuICAgICAgICAgICAgICBzdHJpbmcgKz0gZGlnaXRzKHZhbHVlLCAyKTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICB0aHJvdyBFcnJvcihcbiAgICAgICAgICAgICAgICBgRm9ybWF0dGVyRXJyb3I6IHZhbHVlIFwiJHt0b2tlbi52YWx1ZX1cIiBpcyBub3Qgc3VwcG9ydGVkYCxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgY2FzZSBcIm1pbnV0ZVwiOiB7XG4gICAgICAgICAgY29uc3QgdmFsdWUgPSB1dGMgPyBkYXRlLmdldFVUQ01pbnV0ZXMoKSA6IGRhdGUuZ2V0TWludXRlcygpO1xuICAgICAgICAgIHN3aXRjaCAodG9rZW4udmFsdWUpIHtcbiAgICAgICAgICAgIGNhc2UgXCJudW1lcmljXCI6IHtcbiAgICAgICAgICAgICAgc3RyaW5nICs9IHZhbHVlO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhc2UgXCIyLWRpZ2l0XCI6IHtcbiAgICAgICAgICAgICAgc3RyaW5nICs9IGRpZ2l0cyh2YWx1ZSwgMik7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgdGhyb3cgRXJyb3IoXG4gICAgICAgICAgICAgICAgYEZvcm1hdHRlckVycm9yOiB2YWx1ZSBcIiR7dG9rZW4udmFsdWV9XCIgaXMgbm90IHN1cHBvcnRlZGAsXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGNhc2UgXCJzZWNvbmRcIjoge1xuICAgICAgICAgIGNvbnN0IHZhbHVlID0gdXRjID8gZGF0ZS5nZXRVVENTZWNvbmRzKCkgOiBkYXRlLmdldFNlY29uZHMoKTtcbiAgICAgICAgICBzd2l0Y2ggKHRva2VuLnZhbHVlKSB7XG4gICAgICAgICAgICBjYXNlIFwibnVtZXJpY1wiOiB7XG4gICAgICAgICAgICAgIHN0cmluZyArPSB2YWx1ZTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXNlIFwiMi1kaWdpdFwiOiB7XG4gICAgICAgICAgICAgIHN0cmluZyArPSBkaWdpdHModmFsdWUsIDIpO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgIHRocm93IEVycm9yKFxuICAgICAgICAgICAgICAgIGBGb3JtYXR0ZXJFcnJvcjogdmFsdWUgXCIke3Rva2VuLnZhbHVlfVwiIGlzIG5vdCBzdXBwb3J0ZWRgLFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBjYXNlIFwiZnJhY3Rpb25hbFNlY29uZFwiOiB7XG4gICAgICAgICAgY29uc3QgdmFsdWUgPSB1dGNcbiAgICAgICAgICAgID8gZGF0ZS5nZXRVVENNaWxsaXNlY29uZHMoKVxuICAgICAgICAgICAgOiBkYXRlLmdldE1pbGxpc2Vjb25kcygpO1xuICAgICAgICAgIHN0cmluZyArPSBkaWdpdHModmFsdWUsIE51bWJlcih0b2tlbi52YWx1ZSkpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIC8vIEZJWE1FKGJhcnRsb21pZWp1KVxuICAgICAgICBjYXNlIFwidGltZVpvbmVOYW1lXCI6IHtcbiAgICAgICAgICAvLyBzdHJpbmcgKz0gdXRjID8gXCJaXCIgOiB0b2tlbi52YWx1ZVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGNhc2UgXCJkYXlQZXJpb2RcIjoge1xuICAgICAgICAgIHN0cmluZyArPSBkYXRlLmdldEhvdXJzKCkgPj0gMTIgPyBcIlBNXCIgOiBcIkFNXCI7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgY2FzZSBcImxpdGVyYWxcIjoge1xuICAgICAgICAgIHN0cmluZyArPSB0b2tlbi52YWx1ZTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgdGhyb3cgRXJyb3IoYEZvcm1hdHRlckVycm9yOiB7ICR7dG9rZW4udHlwZX0gJHt0b2tlbi52YWx1ZX0gfWApO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBzdHJpbmc7XG4gIH1cblxuICBwYXJzZVRvUGFydHMoc3RyaW5nOiBzdHJpbmcpOiBEYXRlVGltZUZvcm1hdFBhcnRbXSB7XG4gICAgY29uc3QgcGFydHM6IERhdGVUaW1lRm9ybWF0UGFydFtdID0gW107XG5cbiAgICBmb3IgKGNvbnN0IHRva2VuIG9mIHRoaXMuI2Zvcm1hdCkge1xuICAgICAgY29uc3QgdHlwZSA9IHRva2VuLnR5cGU7XG5cbiAgICAgIGxldCB2YWx1ZSA9IFwiXCI7XG4gICAgICBzd2l0Y2ggKHRva2VuLnR5cGUpIHtcbiAgICAgICAgY2FzZSBcInllYXJcIjoge1xuICAgICAgICAgIHN3aXRjaCAodG9rZW4udmFsdWUpIHtcbiAgICAgICAgICAgIGNhc2UgXCJudW1lcmljXCI6IHtcbiAgICAgICAgICAgICAgdmFsdWUgPSAvXlxcZHsxLDR9Ly5leGVjKHN0cmluZyk/LlswXSBhcyBzdHJpbmc7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBcIjItZGlnaXRcIjoge1xuICAgICAgICAgICAgICB2YWx1ZSA9IC9eXFxkezEsMn0vLmV4ZWMoc3RyaW5nKT8uWzBdIGFzIHN0cmluZztcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICB0aHJvdyBFcnJvcihcbiAgICAgICAgICAgICAgICBgUGFyc2VyRXJyb3I6IHZhbHVlIFwiJHt0b2tlbi52YWx1ZX1cIiBpcyBub3Qgc3VwcG9ydGVkYCxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgY2FzZSBcIm1vbnRoXCI6IHtcbiAgICAgICAgICBzd2l0Y2ggKHRva2VuLnZhbHVlKSB7XG4gICAgICAgICAgICBjYXNlIFwibnVtZXJpY1wiOiB7XG4gICAgICAgICAgICAgIHZhbHVlID0gL15cXGR7MSwyfS8uZXhlYyhzdHJpbmcpPy5bMF0gYXMgc3RyaW5nO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhc2UgXCIyLWRpZ2l0XCI6IHtcbiAgICAgICAgICAgICAgdmFsdWUgPSAvXlxcZHsyfS8uZXhlYyhzdHJpbmcpPy5bMF0gYXMgc3RyaW5nO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhc2UgXCJuYXJyb3dcIjoge1xuICAgICAgICAgICAgICB2YWx1ZSA9IC9eW2EtekEtWl0rLy5leGVjKHN0cmluZyk/LlswXSBhcyBzdHJpbmc7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBcInNob3J0XCI6IHtcbiAgICAgICAgICAgICAgdmFsdWUgPSAvXlthLXpBLVpdKy8uZXhlYyhzdHJpbmcpPy5bMF0gYXMgc3RyaW5nO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhc2UgXCJsb25nXCI6IHtcbiAgICAgICAgICAgICAgdmFsdWUgPSAvXlthLXpBLVpdKy8uZXhlYyhzdHJpbmcpPy5bMF0gYXMgc3RyaW5nO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgIHRocm93IEVycm9yKFxuICAgICAgICAgICAgICAgIGBQYXJzZXJFcnJvcjogdmFsdWUgXCIke3Rva2VuLnZhbHVlfVwiIGlzIG5vdCBzdXBwb3J0ZWRgLFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBjYXNlIFwiZGF5XCI6IHtcbiAgICAgICAgICBzd2l0Y2ggKHRva2VuLnZhbHVlKSB7XG4gICAgICAgICAgICBjYXNlIFwibnVtZXJpY1wiOiB7XG4gICAgICAgICAgICAgIHZhbHVlID0gL15cXGR7MSwyfS8uZXhlYyhzdHJpbmcpPy5bMF0gYXMgc3RyaW5nO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhc2UgXCIyLWRpZ2l0XCI6IHtcbiAgICAgICAgICAgICAgdmFsdWUgPSAvXlxcZHsyfS8uZXhlYyhzdHJpbmcpPy5bMF0gYXMgc3RyaW5nO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgIHRocm93IEVycm9yKFxuICAgICAgICAgICAgICAgIGBQYXJzZXJFcnJvcjogdmFsdWUgXCIke3Rva2VuLnZhbHVlfVwiIGlzIG5vdCBzdXBwb3J0ZWRgLFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBjYXNlIFwiaG91clwiOiB7XG4gICAgICAgICAgc3dpdGNoICh0b2tlbi52YWx1ZSkge1xuICAgICAgICAgICAgY2FzZSBcIm51bWVyaWNcIjoge1xuICAgICAgICAgICAgICB2YWx1ZSA9IC9eXFxkezEsMn0vLmV4ZWMoc3RyaW5nKT8uWzBdIGFzIHN0cmluZztcbiAgICAgICAgICAgICAgaWYgKHRva2VuLmhvdXIxMiAmJiBwYXJzZUludCh2YWx1ZSkgPiAxMikge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgICAgICAgICAgICBgVHJ5aW5nIHRvIHBhcnNlIGhvdXIgZ3JlYXRlciB0aGFuIDEyLiBVc2UgJ0gnIGluc3RlYWQgb2YgJ2gnLmAsXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhc2UgXCIyLWRpZ2l0XCI6IHtcbiAgICAgICAgICAgICAgdmFsdWUgPSAvXlxcZHsyfS8uZXhlYyhzdHJpbmcpPy5bMF0gYXMgc3RyaW5nO1xuICAgICAgICAgICAgICBpZiAodG9rZW4uaG91cjEyICYmIHBhcnNlSW50KHZhbHVlKSA+IDEyKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihcbiAgICAgICAgICAgICAgICAgIGBUcnlpbmcgdG8gcGFyc2UgaG91ciBncmVhdGVyIHRoYW4gMTIuIFVzZSAnSEgnIGluc3RlYWQgb2YgJ2hoJy5gLFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICB0aHJvdyBFcnJvcihcbiAgICAgICAgICAgICAgICBgUGFyc2VyRXJyb3I6IHZhbHVlIFwiJHt0b2tlbi52YWx1ZX1cIiBpcyBub3Qgc3VwcG9ydGVkYCxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgY2FzZSBcIm1pbnV0ZVwiOiB7XG4gICAgICAgICAgc3dpdGNoICh0b2tlbi52YWx1ZSkge1xuICAgICAgICAgICAgY2FzZSBcIm51bWVyaWNcIjoge1xuICAgICAgICAgICAgICB2YWx1ZSA9IC9eXFxkezEsMn0vLmV4ZWMoc3RyaW5nKT8uWzBdIGFzIHN0cmluZztcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXNlIFwiMi1kaWdpdFwiOiB7XG4gICAgICAgICAgICAgIHZhbHVlID0gL15cXGR7Mn0vLmV4ZWMoc3RyaW5nKT8uWzBdIGFzIHN0cmluZztcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICB0aHJvdyBFcnJvcihcbiAgICAgICAgICAgICAgICBgUGFyc2VyRXJyb3I6IHZhbHVlIFwiJHt0b2tlbi52YWx1ZX1cIiBpcyBub3Qgc3VwcG9ydGVkYCxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgY2FzZSBcInNlY29uZFwiOiB7XG4gICAgICAgICAgc3dpdGNoICh0b2tlbi52YWx1ZSkge1xuICAgICAgICAgICAgY2FzZSBcIm51bWVyaWNcIjoge1xuICAgICAgICAgICAgICB2YWx1ZSA9IC9eXFxkezEsMn0vLmV4ZWMoc3RyaW5nKT8uWzBdIGFzIHN0cmluZztcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXNlIFwiMi1kaWdpdFwiOiB7XG4gICAgICAgICAgICAgIHZhbHVlID0gL15cXGR7Mn0vLmV4ZWMoc3RyaW5nKT8uWzBdIGFzIHN0cmluZztcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICB0aHJvdyBFcnJvcihcbiAgICAgICAgICAgICAgICBgUGFyc2VyRXJyb3I6IHZhbHVlIFwiJHt0b2tlbi52YWx1ZX1cIiBpcyBub3Qgc3VwcG9ydGVkYCxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgY2FzZSBcImZyYWN0aW9uYWxTZWNvbmRcIjoge1xuICAgICAgICAgIHZhbHVlID0gbmV3IFJlZ0V4cChgXlxcXFxkeyR7dG9rZW4udmFsdWV9fWApLmV4ZWMoc3RyaW5nKVxuICAgICAgICAgICAgPy5bMF0gYXMgc3RyaW5nO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGNhc2UgXCJ0aW1lWm9uZU5hbWVcIjoge1xuICAgICAgICAgIHZhbHVlID0gdG9rZW4udmFsdWUgYXMgc3RyaW5nO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGNhc2UgXCJkYXlQZXJpb2RcIjoge1xuICAgICAgICAgIHZhbHVlID0gL14oQXxQKU0vLmV4ZWMoc3RyaW5nKT8uWzBdIGFzIHN0cmluZztcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBjYXNlIFwibGl0ZXJhbFwiOiB7XG4gICAgICAgICAgaWYgKCFzdHJpbmcuc3RhcnRzV2l0aCh0b2tlbi52YWx1ZSBhcyBzdHJpbmcpKSB7XG4gICAgICAgICAgICB0aHJvdyBFcnJvcihcbiAgICAgICAgICAgICAgYExpdGVyYWwgXCIke3Rva2VuLnZhbHVlfVwiIG5vdCBmb3VuZCBcIiR7c3RyaW5nLnNsaWNlKDAsIDI1KX1cImAsXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH1cbiAgICAgICAgICB2YWx1ZSA9IHRva2VuLnZhbHVlIGFzIHN0cmluZztcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgdGhyb3cgRXJyb3IoYCR7dG9rZW4udHlwZX0gJHt0b2tlbi52YWx1ZX1gKTtcbiAgICAgIH1cblxuICAgICAgaWYgKCF2YWx1ZSkge1xuICAgICAgICB0aHJvdyBFcnJvcihcbiAgICAgICAgICBgdmFsdWUgbm90IHZhbGlkIGZvciB0b2tlbiB7ICR7dHlwZX0gJHt2YWx1ZX0gfSAke1xuICAgICAgICAgICAgc3RyaW5nLnNsaWNlKFxuICAgICAgICAgICAgICAwLFxuICAgICAgICAgICAgICAyNSxcbiAgICAgICAgICAgIClcbiAgICAgICAgICB9YCxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIHBhcnRzLnB1c2goeyB0eXBlLCB2YWx1ZSB9KTtcblxuICAgICAgc3RyaW5nID0gc3RyaW5nLnNsaWNlKHZhbHVlLmxlbmd0aCk7XG4gICAgfVxuXG4gICAgaWYgKHN0cmluZy5sZW5ndGgpIHtcbiAgICAgIHRocm93IEVycm9yKFxuICAgICAgICBgZGF0ZXRpbWUgc3RyaW5nIHdhcyBub3QgZnVsbHkgcGFyc2VkISAke3N0cmluZy5zbGljZSgwLCAyNSl9YCxcbiAgICAgICk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHBhcnRzO1xuICB9XG5cbiAgLyoqIHNvcnQgJiBmaWx0ZXIgZGF0ZVRpbWVGb3JtYXRQYXJ0ICovXG4gIHNvcnREYXRlVGltZUZvcm1hdFBhcnQocGFydHM6IERhdGVUaW1lRm9ybWF0UGFydFtdKTogRGF0ZVRpbWVGb3JtYXRQYXJ0W10ge1xuICAgIGxldCByZXN1bHQ6IERhdGVUaW1lRm9ybWF0UGFydFtdID0gW107XG4gICAgY29uc3QgdHlwZUFycmF5ID0gW1xuICAgICAgXCJ5ZWFyXCIsXG4gICAgICBcIm1vbnRoXCIsXG4gICAgICBcImRheVwiLFxuICAgICAgXCJob3VyXCIsXG4gICAgICBcIm1pbnV0ZVwiLFxuICAgICAgXCJzZWNvbmRcIixcbiAgICAgIFwiZnJhY3Rpb25hbFNlY29uZFwiLFxuICAgIF07XG4gICAgZm9yIChjb25zdCB0eXBlIG9mIHR5cGVBcnJheSkge1xuICAgICAgY29uc3QgY3VycmVudCA9IHBhcnRzLmZpbmRJbmRleCgoZWwpID0+IGVsLnR5cGUgPT09IHR5cGUpO1xuICAgICAgaWYgKGN1cnJlbnQgIT09IC0xKSB7XG4gICAgICAgIHJlc3VsdCA9IHJlc3VsdC5jb25jYXQocGFydHMuc3BsaWNlKGN1cnJlbnQsIDEpKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmVzdWx0ID0gcmVzdWx0LmNvbmNhdChwYXJ0cyk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHBhcnRzVG9EYXRlKHBhcnRzOiBEYXRlVGltZUZvcm1hdFBhcnRbXSk6IERhdGUge1xuICAgIGNvbnN0IGRhdGUgPSBuZXcgRGF0ZSgpO1xuICAgIGNvbnN0IHV0YyA9IHBhcnRzLmZpbmQoXG4gICAgICAocGFydCkgPT4gcGFydC50eXBlID09PSBcInRpbWVab25lTmFtZVwiICYmIHBhcnQudmFsdWUgPT09IFwiVVRDXCIsXG4gICAgKTtcblxuICAgIGNvbnN0IGRheVBhcnQgPSBwYXJ0cy5maW5kKChwYXJ0KSA9PiBwYXJ0LnR5cGUgPT09IFwiZGF5XCIpO1xuXG4gICAgdXRjID8gZGF0ZS5zZXRVVENIb3VycygwLCAwLCAwLCAwKSA6IGRhdGUuc2V0SG91cnMoMCwgMCwgMCwgMCk7XG4gICAgZm9yIChjb25zdCBwYXJ0IG9mIHBhcnRzKSB7XG4gICAgICBzd2l0Y2ggKHBhcnQudHlwZSkge1xuICAgICAgICBjYXNlIFwieWVhclwiOiB7XG4gICAgICAgICAgY29uc3QgdmFsdWUgPSBOdW1iZXIocGFydC52YWx1ZS5wYWRTdGFydCg0LCBcIjIwXCIpKTtcbiAgICAgICAgICB1dGMgPyBkYXRlLnNldFVUQ0Z1bGxZZWFyKHZhbHVlKSA6IGRhdGUuc2V0RnVsbFllYXIodmFsdWUpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGNhc2UgXCJtb250aFwiOiB7XG4gICAgICAgICAgY29uc3QgdmFsdWUgPSBOdW1iZXIocGFydC52YWx1ZSkgLSAxO1xuICAgICAgICAgIGlmIChkYXlQYXJ0KSB7XG4gICAgICAgICAgICB1dGNcbiAgICAgICAgICAgICAgPyBkYXRlLnNldFVUQ01vbnRoKHZhbHVlLCBOdW1iZXIoZGF5UGFydC52YWx1ZSkpXG4gICAgICAgICAgICAgIDogZGF0ZS5zZXRNb250aCh2YWx1ZSwgTnVtYmVyKGRheVBhcnQudmFsdWUpKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdXRjID8gZGF0ZS5zZXRVVENNb250aCh2YWx1ZSkgOiBkYXRlLnNldE1vbnRoKHZhbHVlKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgY2FzZSBcImRheVwiOiB7XG4gICAgICAgICAgY29uc3QgdmFsdWUgPSBOdW1iZXIocGFydC52YWx1ZSk7XG4gICAgICAgICAgdXRjID8gZGF0ZS5zZXRVVENEYXRlKHZhbHVlKSA6IGRhdGUuc2V0RGF0ZSh2YWx1ZSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgY2FzZSBcImhvdXJcIjoge1xuICAgICAgICAgIGxldCB2YWx1ZSA9IE51bWJlcihwYXJ0LnZhbHVlKTtcbiAgICAgICAgICBjb25zdCBkYXlQZXJpb2QgPSBwYXJ0cy5maW5kKFxuICAgICAgICAgICAgKHBhcnQ6IERhdGVUaW1lRm9ybWF0UGFydCkgPT4gcGFydC50eXBlID09PSBcImRheVBlcmlvZFwiLFxuICAgICAgICAgICk7XG4gICAgICAgICAgaWYgKGRheVBlcmlvZD8udmFsdWUgPT09IFwiUE1cIikgdmFsdWUgKz0gMTI7XG4gICAgICAgICAgdXRjID8gZGF0ZS5zZXRVVENIb3Vycyh2YWx1ZSkgOiBkYXRlLnNldEhvdXJzKHZhbHVlKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBjYXNlIFwibWludXRlXCI6IHtcbiAgICAgICAgICBjb25zdCB2YWx1ZSA9IE51bWJlcihwYXJ0LnZhbHVlKTtcbiAgICAgICAgICB1dGMgPyBkYXRlLnNldFVUQ01pbnV0ZXModmFsdWUpIDogZGF0ZS5zZXRNaW51dGVzKHZhbHVlKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBjYXNlIFwic2Vjb25kXCI6IHtcbiAgICAgICAgICBjb25zdCB2YWx1ZSA9IE51bWJlcihwYXJ0LnZhbHVlKTtcbiAgICAgICAgICB1dGMgPyBkYXRlLnNldFVUQ1NlY29uZHModmFsdWUpIDogZGF0ZS5zZXRTZWNvbmRzKHZhbHVlKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBjYXNlIFwiZnJhY3Rpb25hbFNlY29uZFwiOiB7XG4gICAgICAgICAgY29uc3QgdmFsdWUgPSBOdW1iZXIocGFydC52YWx1ZSk7XG4gICAgICAgICAgdXRjID8gZGF0ZS5zZXRVVENNaWxsaXNlY29uZHModmFsdWUpIDogZGF0ZS5zZXRNaWxsaXNlY29uZHModmFsdWUpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBkYXRlO1xuICB9XG5cbiAgcGFyc2Uoc3RyaW5nOiBzdHJpbmcpOiBEYXRlIHtcbiAgICBjb25zdCBwYXJ0cyA9IHRoaXMucGFyc2VUb1BhcnRzKHN0cmluZyk7XG4gICAgY29uc3Qgc29ydFBhcnRzID0gdGhpcy5zb3J0RGF0ZVRpbWVGb3JtYXRQYXJ0KHBhcnRzKTtcbiAgICByZXR1cm4gdGhpcy5wYXJ0c1RvRGF0ZShzb3J0UGFydHMpO1xuICB9XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMEVBQTBFO0FBQzFFLHFDQUFxQztBQTZCckMsT0FBTyxNQUFNO0VBQ1gsTUFBYztFQUVkLFlBQVksUUFBZ0IsRUFBRSxDQUFFO0lBQzlCLElBQUksQ0FBQyxLQUFLLEdBQUc7RUFDZjtFQUVBLFFBQVEsSUFBa0IsRUFBRSxFQUFvQixFQUFhO0lBQzNELElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDO01BQUU7TUFBTTtJQUFHO0lBQzNCLE9BQU8sSUFBSTtFQUNiO0VBRUEsU0FDRSxNQUFjLEVBQ2QsV0FBVyxDQUFDLFFBQWlDLEtBQUssRUFDaEM7SUFDbEIsVUFBVSxVQUFVLEtBQWE7TUFDL0IsSUFBSSxRQUFRO01BQ1osS0FBSyxNQUFNLFFBQVEsTUFBTztRQUN4QixNQUFNLFNBQVMsS0FBSyxJQUFJLENBQUM7UUFDekIsSUFBSSxRQUFRO1VBQ1YsTUFBTSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsR0FBRztVQUMxQixTQUFTO1VBQ1QsU0FBUyxPQUFPLEtBQUssQ0FBQztVQUN0QixNQUFNLFFBQVE7WUFBRSxHQUFHLEtBQUssRUFBRSxDQUFDLE1BQU07WUFBRTtVQUFNO1VBQ3pDLE1BQU0sU0FB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
// denoCacheMetadata=8836524996605801822,16229846121032642766