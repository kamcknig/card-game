import { escape } from './escape.ts';
import { attempt } from '../function/attempt.ts';
import { defaults } from '../object/defaults.ts';
import { toString } from '../util/toString.ts';
// A regular expression for matching literal string in ES template string.
const esTemplateRegExp = /\$\{([^\\}]*(?:\\.[^\\}]*)*)\}/g;
// A regular expression for matching unescaped characters in string.
const unEscapedRegExp = /['\n\r\u2028\u2029\\]/g;
// A regular expression for matching no match.
const noMatchExp = /($^)/;
const escapeMap = new Map([
  [
    '\\',
    '\\'
  ],
  [
    "'",
    "'"
  ],
  [
    '\n',
    'n'
  ],
  [
    '\r',
    'r'
  ],
  [
    '\u2028',
    'u2028'
  ],
  [
    '\u2029',
    'u2029'
  ]
]);
function escapeString(match) {
  return `\\${escapeMap.get(match)}`;
}
// Only import the necessary functions for preventing circular dependencies.(lodash-es also does this)
export const templateSettings = {
  escape: /<%-([\s\S]+?)%>/g,
  evaluate: /<%([\s\S]+?)%>/g,
  interpolate: /<%=([\s\S]+?)%>/g,
  variable: '',
  imports: {
    _: {
      escape,
      template
    }
  }
};
/**
 * Compiles a template string into a function that can interpolate data properties.
 *
 * This function allows you to create a template with custom delimiters for escaping,
 * evaluating, and interpolating values. It can also handle custom variable names and
 * imported functions.
 *
 * @param {string} string - The template string.
 * @param {TemplateOptions} [options] - The options object.
 * @param {RegExp} [options.escape] - The regular expression for "escape" delimiter.
 * @param {RegExp} [options.evaluate] - The regular expression for "evaluate" delimiter.
 * @param {RegExp} [options.interpolate] - The regular expression for "interpolate" delimiter.
 * @param {string} [options.variable] - The data object variable name.
 * @param {Record<string, unknown>} [options.imports] - The object of imported functions.
 * @param {string} [options.sourceURL] - The source URL of the template.
 * @param {unknown} [guard] - The guard to detect if the function is called with `options`.
 * @returns {(data?: object) => string} Returns the compiled template function.
 *
 * @example
 * // Use the "escape" delimiter to escape data properties.
 * const compiled = template('<%- value %>');
 * compiled({ value: '<div>' }); // returns '&lt;div&gt;'
 *
 * @example
 * // Use the "interpolate" delimiter to interpolate data properties.
 * const compiled = template('<%= value %>');
 * compiled({ value: 'Hello, World!' }); // returns 'Hello, World!'
 *
 * @example
 * // Use the "evaluate" delimiter to evaluate JavaScript code.
 * const compiled = template('<% if (value) { %>Yes<% } else { %>No<% } %>');
 * compiled({ value: true }); // returns 'Yes'
 *
 * @example
 * // Use the "variable" option to specify the data object variable name.
 * const compiled = template('<%= data.value %>', { variable: 'data' });
 * compiled({ value: 'Hello, World!' }); // returns 'Hello, World!'
 *
 * @example
 * // Use the "imports" option to import functions.
 * const compiled = template('<%= _.toUpper(value) %>', { imports: { _: { toUpper } } });
 * compiled({ value: 'hello, world!' }); // returns 'HELLO, WORLD!'
 *
 * @example
 * // Use the custom "escape" delimiter.
 * const compiled = template('<@ value @>', { escape: /<@([\s\S]+?)@>/g });
 * compiled({ value: '<div>' }); // returns '&lt;div&gt;'
 *
 * @example
 * // Use the custom "evaluate" delimiter.
 * const compiled = template('<# if (value) { #>Yes<# } else { #>No<# } #>', { evaluate: /<#([\s\S]+?)#>/g });
 * compiled({ value: true }); // returns 'Yes'
 *
 * @example
 * // Use the custom "interpolate" delimiter.
 * const compiled = template('<$ value $>', { interpolate: /<\$([\s\S]+?)\$>/g });
 * compiled({ value: 'Hello, World!' }); // returns 'Hello, World!'
 *
 * @example
 * // Use the "sourceURL" option to specify the source URL of the template.
 * const compiled = template('hello <%= user %>!', { sourceURL: 'template.js' });
 */ export function template(string, options, guard) {
  string = toString(string);
  if (guard) {
    options = templateSettings;
  }
  options = defaults({
    ...options
  }, templateSettings);
  const delimitersRegExp = new RegExp([
    options.escape?.source ?? noMatchExp.source,
    options.interpolate?.source ?? noMatchExp.source,
    options.interpolate ? esTemplateRegExp.source : noMatchExp.source,
    options.evaluate?.source ?? noMatchExp.source,
    '$'
  ].join('|'), 'g');
  let lastIndex = 0;
  let isEvaluated = false;
  let source = `__p += ''`;
  for (const match of string.matchAll(delimitersRegExp)){
    const [fullMatch, escapeValue, interpolateValue, esTemplateValue, evaluateValue] = match;
    const { index } = match;
    source += ` + '${string.slice(lastIndex, index).replace(unEscapedRegExp, escapeString)}'`;
    if (escapeValue) {
      source += ` + _.escape(${escapeValue})`;
    }
    if (interpolateValue) {
      source += ` + ((${interpolateValue}) == null ? '' : ${interpolateValue})`;
    } else if (esTemplateValue) {
      source += ` + ((${esTemplateValue}) == null ? '' : ${esTemplateValue})`;
    }
    if (evaluateValue) {
      source += `;\n${evaluateValue};\n __p += ''`;
      isEvaluated = true;
    }
    lastIndex = index + fullMatch.length;
  }
  const imports = defaults({
    ...options.imports
  }, templateSettings.imports);
  const importsKeys = Object.keys(imports);
  const importValues = Object.values(imports);
  const sourceURL = `//# sourceURL=${options.sourceURL ? String(options.sourceURL).replace(/[\r\n]/g, ' ') : `es-toolkit.templateSource[${Date.now()}]`}\n`;
  const compiledFunction = `function(${options.variable || 'obj'}) {
    let __p = '';
    ${options.variable ? '' : 'if (obj == null) { obj = {}; }'}
    ${isEvaluated ? `function print() { __p += Array.prototype.join.call(arguments, ''); }` : ''}
    ${options.variable ? source : `with(obj) {\n${source}\n}`}
    return __p;
  }`;
  const result = attempt(()=>new Function(...importsKeys, `${sourceURL}return ${compiledFunction}`)(...importValues));
  result.source = compiledFunction;
  if (result instanceof Error) {
    throw result;
  }
  return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvc3RyaW5nL3RlbXBsYXRlLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGVzY2FwZSB9IGZyb20gJy4vZXNjYXBlLnRzJztcbmltcG9ydCB7IGF0dGVtcHQgfSBmcm9tICcuLi9mdW5jdGlvbi9hdHRlbXB0LnRzJztcbmltcG9ydCB7IGRlZmF1bHRzIH0gZnJvbSAnLi4vb2JqZWN0L2RlZmF1bHRzLnRzJztcbmltcG9ydCB7IHRvU3RyaW5nIH0gZnJvbSAnLi4vdXRpbC90b1N0cmluZy50cyc7XG5cbi8vIEEgcmVndWxhciBleHByZXNzaW9uIGZvciBtYXRjaGluZyBsaXRlcmFsIHN0cmluZyBpbiBFUyB0ZW1wbGF0ZSBzdHJpbmcuXG5jb25zdCBlc1RlbXBsYXRlUmVnRXhwID0gL1xcJFxceyhbXlxcXFx9XSooPzpcXFxcLlteXFxcXH1dKikqKVxcfS9nO1xuXG4vLyBBIHJlZ3VsYXIgZXhwcmVzc2lvbiBmb3IgbWF0Y2hpbmcgdW5lc2NhcGVkIGNoYXJhY3RlcnMgaW4gc3RyaW5nLlxuY29uc3QgdW5Fc2NhcGVkUmVnRXhwID0gL1snXFxuXFxyXFx1MjAyOFxcdTIwMjlcXFxcXS9nO1xuXG4vLyBBIHJlZ3VsYXIgZXhwcmVzc2lvbiBmb3IgbWF0Y2hpbmcgbm8gbWF0Y2guXG5jb25zdCBub01hdGNoRXhwID0gLygkXikvO1xuXG5jb25zdCBlc2NhcGVNYXAgPSBuZXcgTWFwKFtcbiAgWydcXFxcJywgJ1xcXFwnXSxcbiAgW1wiJ1wiLCBcIidcIl0sXG4gIFsnXFxuJywgJ24nXSxcbiAgWydcXHInLCAnciddLFxuICBbJ1xcdTIwMjgnLCAndTIwMjgnXSxcbiAgWydcXHUyMDI5JywgJ3UyMDI5J10sXG5dKTtcblxuZnVuY3Rpb24gZXNjYXBlU3RyaW5nKG1hdGNoOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gYFxcXFwke2VzY2FwZU1hcC5nZXQobWF0Y2gpfWA7XG59XG5cbi8vIE9ubHkgaW1wb3J0IHRoZSBuZWNlc3NhcnkgZnVuY3Rpb25zIGZvciBwcmV2ZW50aW5nIGNpcmN1bGFyIGRlcGVuZGVuY2llcy4obG9kYXNoLWVzIGFsc28gZG9lcyB0aGlzKVxuZXhwb3J0IGNvbnN0IHRlbXBsYXRlU2V0dGluZ3MgPSB7XG4gIGVzY2FwZTogLzwlLShbXFxzXFxTXSs/KSU+L2csXG4gIGV2YWx1YXRlOiAvPCUoW1xcc1xcU10rPyklPi9nLFxuICBpbnRlcnBvbGF0ZTogLzwlPShbXFxzXFxTXSs/KSU+L2csXG4gIHZhcmlhYmxlOiAnJyxcbiAgaW1wb3J0czoge1xuICAgIF86IHtcbiAgICAgIGVzY2FwZSxcbiAgICAgIHRlbXBsYXRlLFxuICAgIH0sXG4gIH0sXG59O1xuXG5pbnRlcmZhY2UgVGVtcGxhdGVPcHRpb25zIHtcbiAgZXNjYXBlPzogUmVnRXhwO1xuICBldmFsdWF0ZT86IFJlZ0V4cDtcbiAgaW50ZXJwb2xhdGU/OiBSZWdFeHA7XG4gIHZhcmlhYmxlPzogc3RyaW5nO1xuICBpbXBvcnRzPzogUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gIHNvdXJjZVVSTD86IHN0cmluZztcbn1cblxuLyoqXG4gKiBDb21waWxlcyBhIHRlbXBsYXRlIHN0cmluZyBpbnRvIGEgZnVuY3Rpb24gdGhhdCBjYW4gaW50ZXJwb2xhdGUgZGF0YSBwcm9wZXJ0aWVzLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gYWxsb3dzIHlvdSB0byBjcmVhdGUgYSB0ZW1wbGF0ZSB3aXRoIGN1c3RvbSBkZWxpbWl0ZXJzIGZvciBlc2NhcGluZyxcbiAqIGV2YWx1YXRpbmcsIGFuZCBpbnRlcnBvbGF0aW5nIHZhbHVlcy4gSXQgY2FuIGFsc28gaGFuZGxlIGN1c3RvbSB2YXJpYWJsZSBuYW1lcyBhbmRcbiAqIGltcG9ydGVkIGZ1bmN0aW9ucy5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gc3RyaW5nIC0gVGhlIHRlbXBsYXRlIHN0cmluZy5cbiAqIEBwYXJhbSB7VGVtcGxhdGVPcHRpb25zfSBbb3B0aW9uc10gLSBUaGUgb3B0aW9ucyBvYmplY3QuXG4gKiBAcGFyYW0ge1JlZ0V4cH0gW29wdGlvbnMuZXNjYXBlXSAtIFRoZSByZWd1bGFyIGV4cHJlc3Npb24gZm9yIFwiZXNjYXBlXCIgZGVsaW1pdGVyLlxuICogQHBhcmFtIHtSZWdFeHB9IFtvcHRpb25zLmV2YWx1YXRlXSAtIFRoZSByZWd1bGFyIGV4cHJlc3Npb24gZm9yIFwiZXZhbHVhdGVcIiBkZWxpbWl0ZXIuXG4gKiBAcGFyYW0ge1JlZ0V4cH0gW29wdGlvbnMuaW50ZXJwb2xhdGVdIC0gVGhlIHJlZ3VsYXIgZXhwcmVzc2lvbiBmb3IgXCJpbnRlcnBvbGF0ZVwiIGRlbGltaXRlci5cbiAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy52YXJpYWJsZV0gLSBUaGUgZGF0YSBvYmplY3QgdmFyaWFibGUgbmFtZS5cbiAqIEBwYXJhbSB7UmVjb3JkPHN0cmluZywgdW5rbm93bj59IFtvcHRpb25zLmltcG9ydHNdIC0gVGhlIG9iamVjdCBvZiBpbXBvcnRlZCBmdW5jdGlvbnMuXG4gKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMuc291cmNlVVJMXSAtIFRoZSBzb3VyY2UgVVJMIG9mIHRoZSB0ZW1wbGF0ZS5cbiAqIEBwYXJhbSB7dW5rbm93bn0gW2d1YXJkXSAtIFRoZSBndWFyZCB0byBkZXRlY3QgaWYgdGhlIGZ1bmN0aW9uIGlzIGNhbGxlZCB3aXRoIGBvcHRpb25zYC5cbiAqIEByZXR1cm5zIHsoZGF0YT86IG9iamVjdCkgPT4gc3RyaW5nfSBSZXR1cm5zIHRoZSBjb21waWxlZCB0ZW1wbGF0ZSBmdW5jdGlvbi5cbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gVXNlIHRoZSBcImVzY2FwZVwiIGRlbGltaXRlciB0byBlc2NhcGUgZGF0YSBwcm9wZXJ0aWVzLlxuICogY29uc3QgY29tcGlsZWQgPSB0ZW1wbGF0ZSgnPCUtIHZhbHVlICU+Jyk7XG4gKiBjb21waWxlZCh7IHZhbHVlOiAnPGRpdj4nIH0pOyAvLyByZXR1cm5zICcmbHQ7ZGl2Jmd0OydcbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gVXNlIHRoZSBcImludGVycG9sYXRlXCIgZGVsaW1pdGVyIHRvIGludGVycG9sYXRlIGRhdGEgcHJvcGVydGllcy5cbiAqIGNvbnN0IGNvbXBpbGVkID0gdGVtcGxhdGUoJzwlPSB2YWx1ZSAlPicpO1xuICogY29tcGlsZWQoeyB2YWx1ZTogJ0hlbGxvLCBXb3JsZCEnIH0pOyAvLyByZXR1cm5zICdIZWxsbywgV29ybGQhJ1xuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBVc2UgdGhlIFwiZXZhbHVhdGVcIiBkZWxpbWl0ZXIgdG8gZXZhbHVhdGUgSmF2YVNjcmlwdCBjb2RlLlxuICogY29uc3QgY29tcGlsZWQgPSB0ZW1wbGF0ZSgnPCUgaWYgKHZhbHVlKSB7ICU+WWVzPCUgfSBlbHNlIHsgJT5ObzwlIH0gJT4nKTtcbiAqIGNvbXBpbGVkKHsgdmFsdWU6IHRydWUgfSk7IC8vIHJldHVybnMgJ1llcydcbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gVXNlIHRoZSBcInZhcmlhYmxlXCIgb3B0aW9uIHRvIHNwZWNpZnkgdGhlIGRhdGEgb2JqZWN0IHZhcmlhYmxlIG5hbWUuXG4gKiBjb25zdCBjb21waWxlZCA9IHRlbXBsYXRlKCc8JT0gZGF0YS52YWx1ZSAlPicsIHsgdmFyaWFibGU6ICdkYXRhJyB9KTtcbiAqIGNvbXBpbGVkKHsgdmFsdWU6ICdIZWxsbywgV29ybGQhJyB9KTsgLy8gcmV0dXJucyAnSGVsbG8sIFdvcmxkISdcbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gVXNlIHRoZSBcImltcG9ydHNcIiBvcHRpb24gdG8gaW1wb3J0IGZ1bmN0aW9ucy5cbiAqIGNvbnN0IGNvbXBpbGVkID0gdGVtcGxhdGUoJzwlPSBfLnRvVXBwZXIodmFsdWUpICU+JywgeyBpbXBvcnRzOiB7IF86IHsgdG9VcHBlciB9IH0gfSk7XG4gKiBjb21waWxlZCh7IHZhbHVlOiAnaGVsbG8sIHdvcmxkIScgfSk7IC8vIHJldHVybnMgJ0hFTExPLCBXT1JMRCEnXG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIFVzZSB0aGUgY3VzdG9tIFwiZXNjYXBlXCIgZGVsaW1pdGVyLlxuICogY29uc3QgY29tcGlsZWQgPSB0ZW1wbGF0ZSgnPEAgdmFsdWUgQD4nLCB7IGVzY2FwZTogLzxAKFtcXHNcXFNdKz8pQD4vZyB9KTtcbiAqIGNvbXBpbGVkKHsgdmFsdWU6ICc8ZGl2PicgfSk7IC8vIHJldHVybnMgJyZsdDtkaXYmZ3Q7J1xuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBVc2UgdGhlIGN1c3RvbSBcImV2YWx1YXRlXCIgZGVsaW1pdGVyLlxuICogY29uc3QgY29tcGlsZWQgPSB0ZW1wbGF0ZSgnPCMgaWYgKHZhbHVlKSB7ICM+WWVzPCMgfSBlbHNlIHsgIz5ObzwjIH0gIz4nLCB7IGV2YWx1YXRlOiAvPCMoW1xcc1xcU10rPykjPi9nIH0pO1xuICogY29tcGlsZWQoeyB2YWx1ZTogdHJ1ZSB9KTsgLy8gcmV0dXJucyAnWWVzJ1xuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBVc2UgdGhlIGN1c3RvbSBcImludGVycG9sYXRlXCIgZGVsaW1pdGVyLlxuICogY29uc3QgY29tcGlsZWQgPSB0ZW1wbGF0ZSgnPCQgdmFsdWUgJD4nLCB7IGludGVycG9sYXRlOiAvPFxcJChbXFxzXFxTXSs/KVxcJD4vZyB9KTtcbiAqIGNvbXBpbGVkKHsgdmFsdWU6ICdIZWxsbywgV29ybGQhJyB9KTsgLy8gcmV0dXJucyAnSGVsbG8sIFdvcmxkISdcbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gVXNlIHRoZSBcInNvdXJjZVVSTFwiIG9wdGlvbiB0byBzcGVjaWZ5IHRoZSBzb3VyY2UgVVJMIG9mIHRoZSB0ZW1wbGF0ZS5cbiAqIGNvbnN0IGNvbXBpbGVkID0gdGVtcGxhdGUoJ2hlbGxvIDwlPSB1c2VyICU+IScsIHsgc291cmNlVVJMOiAndGVtcGxhdGUuanMnIH0pO1xuICovXG5leHBvcnQgZnVuY3Rpb24gdGVtcGxhdGUoXG4gIHN0cmluZzogc3RyaW5nLFxuICBvcHRpb25zPzogVGVtcGxhdGVPcHRpb25zLFxuICBndWFyZD86IHVua25vd25cbik6ICgoZGF0YT86IG9iamVjdCkgPT4gc3RyaW5nKSAmIHsgc291cmNlOiBzdHJpbmcgfSB7XG4gIHN0cmluZyA9IHRvU3RyaW5nKHN0cmluZyk7XG5cbiAgaWYgKGd1YXJkKSB7XG4gICAgb3B0aW9ucyA9IHRlbXBsYXRlU2V0dGluZ3M7XG4gIH1cblxuICBvcHRpb25zID0gZGVmYXVsdHMoeyAuLi5vcHRpb25zIH0sIHRlbXBsYXRlU2V0dGluZ3MpO1xuXG4gIGNvbnN0IGRlbGltaXRlcnNSZWdFeHAgPSBuZXcgUmVnRXhwKFxuICAgIFtcbiAgICAgIG9wdGlvbnMuZXNjYXBlPy5zb3VyY2UgPz8gbm9NYXRjaEV4cC5zb3VyY2UsXG4gICAgICBvcHRpb25zLmludGVycG9sYXRlPy5zb3VyY2UgPz8gbm9NYXRjaEV4cC5zb3VyY2UsXG4gICAgICBvcHRpb25zLmludGVycG9sYXRlID8gZXNUZW1wbGF0ZVJlZ0V4cC5zb3VyY2UgOiBub01hdGNoRXhwLnNvdXJjZSxcbiAgICAgIG9wdGlvbnMuZXZhbHVhdGU/LnNvdXJjZSA/PyBub01hdGNoRXhwLnNvdXJjZSxcbiAgICAgICckJyxcbiAgICBdLmpvaW4oJ3wnKSxcbiAgICAnZydcbiAgKTtcblxuICBsZXQgbGFzdEluZGV4ID0gMDtcbiAgbGV0IGlzRXZhbHVhdGVkID0gZmFsc2U7XG4gIGxldCBzb3VyY2UgPSBgX19wICs9ICcnYDtcblxuICBmb3IgKGNvbnN0IG1hdGNoIG9mIHN0cmluZy5tYXRjaEFsbChkZWxpbWl0ZXJzUmVnRXhwKSkge1xuICAgIGNvbnN0IFtmdWxsTWF0Y2gsIGVzY2FwZVZhbHVlLCBpbnRlcnBvbGF0ZVZhbHVlLCBlc1RlbXBsYXRlVmFsdWUsIGV2YWx1YXRlVmFsdWVdID0gbWF0Y2g7XG4gICAgY29uc3QgeyBpbmRleCB9ID0gbWF0Y2g7XG5cbiAgICBzb3VyY2UgKz0gYCArICcke3N0cmluZy5zbGljZShsYXN0SW5kZXgsIGluZGV4KS5yZXBsYWNlKHVuRXNjYXBlZFJlZ0V4cCwgZXNjYXBlU3RyaW5nKX0nYDtcblxuICAgIGlmIChlc2NhcGVWYWx1ZSkge1xuICAgICAgc291cmNlICs9IGAgKyBfLmVzY2FwZSgke2VzY2FwZVZhbHVlfSlgO1xuICAgIH1cblxuICAgIGlmIChpbnRlcnBvbGF0ZVZhbHVlKSB7XG4gICAgICBzb3VyY2UgKz0gYCArICgoJHtpbnRlcnBvbGF0ZVZhbHVlfSkgPT0gbnVsbCA/ICcnIDogJHtpbnRlcnBvbGF0ZVZhbHVlfSlgO1xuICAgIH0gZWxzZSBpZiAoZXNUZW1wbGF0ZVZhbHVlKSB7XG4gICAgICBzb3VyY2UgKz0gYCArICgoJHtlc1RlbXBsYXRlVmFsdWV9KSA9PSBudWxsID8gJycgOiAke2VzVGVtcGxhdGVWYWx1ZX0pYDtcbiAgICB9XG5cbiAgICBpZiAoZXZhbHVhdGVWYWx1ZSkge1xuICAgICAgc291cmNlICs9IGA7XFxuJHtldmFsdWF0ZVZhbHVlfTtcXG4gX19wICs9ICcnYDtcbiAgICAgIGlzRXZhbHVhdGVkID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBsYXN0SW5kZXggPSBpbmRleCArIGZ1bGxNYXRjaC5sZW5ndGg7XG4gIH1cblxuICBjb25zdCBpbXBvcnRzID0gZGVmYXVsdHMoeyAuLi5vcHRpb25zLmltcG9ydHMgfSwgdGVtcGxhdGVTZXR0aW5ncy5pbXBvcnRzKTtcbiAgY29uc3QgaW1wb3J0c0tleXMgPSBPYmplY3Qua2V5cyhpbXBvcnRzKTtcbiAgY29uc3QgaW1wb3J0VmFsdWVzID0gT2JqZWN0LnZhbHVlcyhpbXBvcnRzKTtcblxuICBjb25zdCBzb3VyY2VVUkwgPSBgLy8jIHNvdXJjZVVSTD0ke1xuICAgIG9wdGlvbnMuc291cmNlVVJMID8gU3RyaW5nKG9wdGlvbnMuc291cmNlVVJMKS5yZXBsYWNlKC9bXFxyXFxuXS9nLCAnICcpIDogYGVzLXRvb2xraXQudGVtcGxhdGVTb3VyY2VbJHtEYXRlLm5vdygpfV1gXG4gIH1cXG5gO1xuXG4gIGNvbnN0IGNvbXBpbGVkRnVuY3Rpb24gPSBgZnVuY3Rpb24oJHtvcHRpb25zLnZhcmlhYmxlIHx8ICdvYmonfSkge1xuICAgIGxldCBfX3AgPSAnJztcbiAgICAke29wdGlvbnMudmFyaWFibGUgPyAnJyA6ICdpZiAob2JqID09IG51bGwpIHsgb2JqID0ge307IH0nfVxuICAgICR7aXNFdmFsdWF0ZWQgPyBgZnVuY3Rpb24gcHJpbnQoKSB7IF9fcCArPSBBcnJheS5wcm90b3R5cGUuam9pbi5jYWxsKGFyZ3VtZW50cywgJycpOyB9YCA6ICcnfVxuICAgICR7b3B0aW9ucy52YXJpYWJsZSA/IHNvdXJjZSA6IGB3aXRoKG9iaikge1xcbiR7c291cmNlfVxcbn1gfVxuICAgIHJldHVybiBfX3A7XG4gIH1gO1xuXG4gIGNvbnN0IHJlc3VsdCA9IGF0dGVtcHQoKCkgPT4gbmV3IEZ1bmN0aW9uKC4uLmltcG9ydHNLZXlzLCBgJHtzb3VyY2VVUkx9cmV0dXJuICR7Y29tcGlsZWRGdW5jdGlvbn1gKSguLi5pbXBvcnRWYWx1ZXMpKTtcblxuICByZXN1bHQuc291cmNlID0gY29tcGlsZWRGdW5jdGlvbjtcblxuICBpZiAocmVzdWx0IGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICB0aHJvdyByZXN1bHQ7XG4gIH1cblxuICByZXR1cm4gcmVzdWx0O1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsTUFBTSxRQUFRLGNBQWM7QUFDckMsU0FBUyxPQUFPLFFBQVEseUJBQXlCO0FBQ2pELFNBQVMsUUFBUSxRQUFRLHdCQUF3QjtBQUNqRCxTQUFTLFFBQVEsUUFBUSxzQkFBc0I7QUFFL0MsMEVBQTBFO0FBQzFFLE1BQU0sbUJBQW1CO0FBRXpCLG9FQUFvRTtBQUNwRSxNQUFNLGtCQUFrQjtBQUV4Qiw4Q0FBOEM7QUFDOUMsTUFBTSxhQUFhO0FBRW5CLE1BQU0sWUFBWSxJQUFJLElBQUk7RUFDeEI7SUFBQztJQUFNO0dBQUs7RUFDWjtJQUFDO0lBQUs7R0FBSTtFQUNWO0lBQUM7SUFBTTtHQUFJO0VBQ1g7SUFBQztJQUFNO0dBQUk7RUFDWDtJQUFDO0lB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
// denoCacheMetadata=11257252145743028962,7425790178690120949