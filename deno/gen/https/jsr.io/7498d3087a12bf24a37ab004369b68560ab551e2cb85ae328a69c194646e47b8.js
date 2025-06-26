import { isPlainObject } from './isPlainObject.ts';
import { getSymbols } from '../compat/_internal/getSymbols.ts';
import { getTag } from '../compat/_internal/getTag.ts';
import { argumentsTag, arrayBufferTag, arrayTag, bigInt64ArrayTag, bigUint64ArrayTag, booleanTag, dataViewTag, dateTag, errorTag, float32ArrayTag, float64ArrayTag, functionTag, int8ArrayTag, int16ArrayTag, int32ArrayTag, mapTag, numberTag, objectTag, regexpTag, setTag, stringTag, symbolTag, uint8ArrayTag, uint8ClampedArrayTag, uint16ArrayTag, uint32ArrayTag } from '../compat/_internal/tags.ts';
import { eq } from '../compat/util/eq.ts';
/**
 * Compares two values for equality using a custom comparison function.
 *
 * The custom function allows for fine-tuned control over the comparison process. If it returns a boolean, that result determines the equality. If it returns undefined, the function falls back to the default equality comparison.
 *
 * This function also uses the custom equality function to compare values inside objects,
 * arrays, maps, sets, and other complex structures, ensuring a deep comparison.
 *
 * This approach provides flexibility in handling complex comparisons while maintaining efficient default behavior for simpler cases.
 *
 * The custom comparison function can take up to six parameters:
 * - `x`: The value from the first object `a`.
 * - `y`: The value from the second object `b`.
 * - `property`: The property key used to get `x` and `y`.
 * - `xParent`: The parent of the first value `x`.
 * - `yParent`: The parent of the second value `y`.
 * - `stack`: An internal stack (Map) to handle circular references.
 *
 * @param {unknown} a - The first value to compare.
 * @param {unknown} b - The second value to compare.
 * @param {(x: any, y: any, property?: PropertyKey, xParent?: any, yParent?: any, stack?: Map<any, any>) => boolean | void} areValuesEqual - A function to customize the comparison.
 *   If it returns a boolean, that result will be used. If it returns undefined,
 *   the default equality comparison will be used.
 * @returns {boolean} `true` if the values are equal according to the customizer, otherwise `false`.
 *
 * @example
 * const customizer = (a, b) => {
 *   if (typeof a === 'string' && typeof b === 'string') {
 *     return a.toLowerCase() === b.toLowerCase();
 *   }
 * };
 * isEqualWith('Hello', 'hello', customizer); // true
 * isEqualWith({ a: 'Hello' }, { a: 'hello' }, customizer); // true
 * isEqualWith([1, 2, 3], [1, 2, 3], customizer); // true
 */ export function isEqualWith(a, b, areValuesEqual) {
  return isEqualWithImpl(a, b, undefined, undefined, undefined, undefined, areValuesEqual);
}
function isEqualWithImpl(a, b, property, aParent, bParent, stack, areValuesEqual) {
  const result = areValuesEqual(a, b, property, aParent, bParent, stack);
  if (result !== undefined) {
    return result;
  }
  if (typeof a === typeof b) {
    switch(typeof a){
      case 'bigint':
      case 'string':
      case 'boolean':
      case 'symbol':
      case 'undefined':
        {
          return a === b;
        }
      case 'number':
        {
          return a === b || Object.is(a, b);
        }
      case 'function':
        {
          return a === b;
        }
      case 'object':
        {
          return areObjectsEqual(a, b, stack, areValuesEqual);
        }
    }
  }
  return areObjectsEqual(a, b, stack, areValuesEqual);
}
function areObjectsEqual(a, b, stack, areValuesEqual) {
  if (Object.is(a, b)) {
    return true;
  }
  let aTag = getTag(a);
  let bTag = getTag(b);
  if (aTag === argumentsTag) {
    aTag = objectTag;
  }
  if (bTag === argumentsTag) {
    bTag = objectTag;
  }
  if (aTag !== bTag) {
    return false;
  }
  switch(aTag){
    case stringTag:
      return a.toString() === b.toString();
    case numberTag:
      {
        const x = a.valueOf();
        const y = b.valueOf();
        return eq(x, y);
      }
    case booleanTag:
    case dateTag:
    case symbolTag:
      return Object.is(a.valueOf(), b.valueOf());
    case regexpTag:
      {
        return a.source === b.source && a.flags === b.flags;
      }
    case functionTag:
      {
        return a === b;
      }
  }
  stack = stack ?? new Map();
  const aStack = stack.get(a);
  const bStack = stack.get(b);
  if (aStack != null && bStack != null) {
    return aStack === b;
  }
  stack.set(a, b);
  stack.set(b, a);
  try {
    switch(aTag){
      case mapTag:
        {
          if (a.size !== b.size) {
            return false;
          }
          for (const [key, value] of a.entries()){
            if (!b.has(key) || !isEqualWithImpl(value, b.get(key), key, a, b, stack, areValuesEqual)) {
              return false;
            }
          }
          return true;
        }
      case setTag:
        {
          if (a.size !== b.size) {
            return false;
          }
          const aValues = Array.from(a.values());
          const bValues = Array.from(b.values());
          for(let i = 0; i < aValues.length; i++){
            const aValue = aValues[i];
            const index = bValues.findIndex((bValue)=>{
              return isEqualWithImpl(aValue, bValue, undefined, a, b, stack, areValuesEqual);
            });
            if (index === -1) {
              return false;
            }
            bValues.splice(index, 1);
          }
          return true;
        }
      case arrayTag:
      case uint8ArrayTag:
      case uint8ClampedArrayTag:
      case uint16ArrayTag:
      case uint32ArrayTag:
      case bigUint64ArrayTag:
      case int8ArrayTag:
      case int16ArrayTag:
      case int32ArrayTag:
      case bigInt64ArrayTag:
      case float32ArrayTag:
      case float64ArrayTag:
        {
          // Buffers are also treated as [object Uint8Array]s.
          if (typeof Buffer !== 'undefined' && Buffer.isBuffer(a) !== Buffer.isBuffer(b)) {
            return false;
          }
          if (a.length !== b.length) {
            return false;
          }
          for(let i = 0; i < a.length; i++){
            if (!isEqualWithImpl(a[i], b[i], i, a, b, stack, areValuesEqual)) {
              return false;
            }
          }
          return true;
        }
      case arrayBufferTag:
        {
          if (a.byteLength !== b.byteLength) {
            return false;
          }
          return areObjectsEqual(new Uint8Array(a), new Uint8Array(b), stack, areValuesEqual);
        }
      case dataViewTag:
        {
          if (a.byteLength !== b.byteLength || a.byteOffset !== b.byteOffset) {
            return false;
          }
          return areObjectsEqual(new Uint8Array(a), new Uint8Array(b), stack, areValuesEqual);
        }
      case errorTag:
        {
          return a.name === b.name && a.message === b.message;
        }
      case objectTag:
        {
          const areEqualInstances = areObjectsEqual(a.constructor, b.constructor, stack, areValuesEqual) || isPlainObject(a) && isPlainObject(b);
          if (!areEqualInstances) {
            return false;
          }
          const aKeys = [
            ...Object.keys(a),
            ...getSymbols(a)
          ];
          const bKeys = [
            ...Object.keys(b),
            ...getSymbols(b)
          ];
          if (aKeys.length !== bKeys.length) {
            return false;
          }
          for(let i = 0; i < aKeys.length; i++){
            const propKey = aKeys[i];
            const aProp = a[propKey];
            if (!Object.hasOwn(b, propKey)) {
              return false;
            }
            const bProp = b[propKey];
            if (!isEqualWithImpl(aProp, bProp, propKey, a, b, stack, areValuesEqual)) {
              return false;
            }
          }
          return true;
        }
      default:
        {
          return false;
        }
    }
  } finally{
    stack.delete(a);
    stack.delete(b);
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9wcmVkaWNhdGUvaXNFcXVhbFdpdGgudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgaXNQbGFpbk9iamVjdCB9IGZyb20gJy4vaXNQbGFpbk9iamVjdC50cyc7XG5pbXBvcnQgeyBnZXRTeW1ib2xzIH0gZnJvbSAnLi4vY29tcGF0L19pbnRlcm5hbC9nZXRTeW1ib2xzLnRzJztcbmltcG9ydCB7IGdldFRhZyB9IGZyb20gJy4uL2NvbXBhdC9faW50ZXJuYWwvZ2V0VGFnLnRzJztcbmltcG9ydCB7XG4gIGFyZ3VtZW50c1RhZyxcbiAgYXJyYXlCdWZmZXJUYWcsXG4gIGFycmF5VGFnLFxuICBiaWdJbnQ2NEFycmF5VGFnLFxuICBiaWdVaW50NjRBcnJheVRhZyxcbiAgYm9vbGVhblRhZyxcbiAgZGF0YVZpZXdUYWcsXG4gIGRhdGVUYWcsXG4gIGVycm9yVGFnLFxuICBmbG9hdDMyQXJyYXlUYWcsXG4gIGZsb2F0NjRBcnJheVRhZyxcbiAgZnVuY3Rpb25UYWcsXG4gIGludDhBcnJheVRhZyxcbiAgaW50MTZBcnJheVRhZyxcbiAgaW50MzJBcnJheVRhZyxcbiAgbWFwVGFnLFxuICBudW1iZXJUYWcsXG4gIG9iamVjdFRhZyxcbiAgcmVnZXhwVGFnLFxuICBzZXRUYWcsXG4gIHN0cmluZ1RhZyxcbiAgc3ltYm9sVGFnLFxuICB1aW50OEFycmF5VGFnLFxuICB1aW50OENsYW1wZWRBcnJheVRhZyxcbiAgdWludDE2QXJyYXlUYWcsXG4gIHVpbnQzMkFycmF5VGFnLFxufSBmcm9tICcuLi9jb21wYXQvX2ludGVybmFsL3RhZ3MudHMnO1xuaW1wb3J0IHsgZXEgfSBmcm9tICcuLi9jb21wYXQvdXRpbC9lcS50cyc7XG5cbmRlY2xhcmUgbGV0IEJ1ZmZlcjpcbiAgfCB7XG4gICAgICBpc0J1ZmZlcjogKGE6IGFueSkgPT4gYm9vbGVhbjtcbiAgICB9XG4gIHwgdW5kZWZpbmVkO1xuXG4vKipcbiAqIENvbXBhcmVzIHR3byB2YWx1ZXMgZm9yIGVxdWFsaXR5IHVzaW5nIGEgY3VzdG9tIGNvbXBhcmlzb24gZnVuY3Rpb24uXG4gKlxuICogVGhlIGN1c3RvbSBmdW5jdGlvbiBhbGxvd3MgZm9yIGZpbmUtdHVuZWQgY29udHJvbCBvdmVyIHRoZSBjb21wYXJpc29uIHByb2Nlc3MuIElmIGl0IHJldHVybnMgYSBib29sZWFuLCB0aGF0IHJlc3VsdCBkZXRlcm1pbmVzIHRoZSBlcXVhbGl0eS4gSWYgaXQgcmV0dXJucyB1bmRlZmluZWQsIHRoZSBmdW5jdGlvbiBmYWxscyBiYWNrIHRvIHRoZSBkZWZhdWx0IGVxdWFsaXR5IGNvbXBhcmlzb24uXG4gKlxuICogVGhpcyBmdW5jdGlvbiBhbHNvIHVzZXMgdGhlIGN1c3RvbSBlcXVhbGl0eSBmdW5jdGlvbiB0byBjb21wYXJlIHZhbHVlcyBpbnNpZGUgb2JqZWN0cyxcbiAqIGFycmF5cywgbWFwcywgc2V0cywgYW5kIG90aGVyIGNvbXBsZXggc3RydWN0dXJlcywgZW5zdXJpbmcgYSBkZWVwIGNvbXBhcmlzb24uXG4gKlxuICogVGhpcyBhcHByb2FjaCBwcm92aWRlcyBmbGV4aWJpbGl0eSBpbiBoYW5kbGluZyBjb21wbGV4IGNvbXBhcmlzb25zIHdoaWxlIG1haW50YWluaW5nIGVmZmljaWVudCBkZWZhdWx0IGJlaGF2aW9yIGZvciBzaW1wbGVyIGNhc2VzLlxuICpcbiAqIFRoZSBjdXN0b20gY29tcGFyaXNvbiBmdW5jdGlvbiBjYW4gdGFrZSB1cCB0byBzaXggcGFyYW1ldGVyczpcbiAqIC0gYHhgOiBUaGUgdmFsdWUgZnJvbSB0aGUgZmlyc3Qgb2JqZWN0IGBhYC5cbiAqIC0gYHlgOiBUaGUgdmFsdWUgZnJvbSB0aGUgc2Vjb25kIG9iamVjdCBgYmAuXG4gKiAtIGBwcm9wZXJ0eWA6IFRoZSBwcm9wZXJ0eSBrZXkgdXNlZCB0byBnZXQgYHhgIGFuZCBgeWAuXG4gKiAtIGB4UGFyZW50YDogVGhlIHBhcmVudCBvZiB0aGUgZmlyc3QgdmFsdWUgYHhgLlxuICogLSBgeVBhcmVudGA6IFRoZSBwYXJlbnQgb2YgdGhlIHNlY29uZCB2YWx1ZSBgeWAuXG4gKiAtIGBzdGFja2A6IEFuIGludGVybmFsIHN0YWNrIChNYXApIHRvIGhhbmRsZSBjaXJjdWxhciByZWZlcmVuY2VzLlxuICpcbiAqIEBwYXJhbSB7dW5rbm93bn0gYSAtIFRoZSBmaXJzdCB2YWx1ZSB0byBjb21wYXJlLlxuICogQHBhcmFtIHt1bmtub3dufSBiIC0gVGhlIHNlY29uZCB2YWx1ZSB0byBjb21wYXJlLlxuICogQHBhcmFtIHsoeDogYW55LCB5OiBhbnksIHByb3BlcnR5PzogUHJvcGVydHlLZXksIHhQYXJlbnQ/OiBhbnksIHlQYXJlbnQ/OiBhbnksIHN0YWNrPzogTWFwPGFueSwgYW55PikgPT4gYm9vbGVhbiB8IHZvaWR9IGFyZVZhbHVlc0VxdWFsIC0gQSBmdW5jdGlvbiB0byBjdXN0b21pemUgdGhlIGNvbXBhcmlzb24uXG4gKiAgIElmIGl0IHJldHVybnMgYSBib29sZWFuLCB0aGF0IHJlc3VsdCB3aWxsIGJlIHVzZWQuIElmIGl0IHJldHVybnMgdW5kZWZpbmVkLFxuICogICB0aGUgZGVmYXVsdCBlcXVhbGl0eSBjb21wYXJpc29uIHdpbGwgYmUgdXNlZC5cbiAqIEByZXR1cm5zIHtib29sZWFufSBgdHJ1ZWAgaWYgdGhlIHZhbHVlcyBhcmUgZXF1YWwgYWNjb3JkaW5nIHRvIHRoZSBjdXN0b21pemVyLCBvdGhlcndpc2UgYGZhbHNlYC5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgY3VzdG9taXplciA9IChhLCBiKSA9PiB7XG4gKiAgIGlmICh0eXBlb2YgYSA9PT0gJ3N0cmluZycgJiYgdHlwZW9mIGIgPT09ICdzdHJpbmcnKSB7XG4gKiAgICAgcmV0dXJuIGEudG9Mb3dlckNhc2UoKSA9PT0gYi50b0xvd2VyQ2FzZSgpO1xuICogICB9XG4gKiB9O1xuICogaXNFcXVhbFdpdGgoJ0hlbGxvJywgJ2hlbGxvJywgY3VzdG9taXplcik7IC8vIHRydWVcbiAqIGlzRXF1YWxXaXRoKHsgYTogJ0hlbGxvJyB9LCB7IGE6ICdoZWxsbycgfSwgY3VzdG9taXplcik7IC8vIHRydWVcbiAqIGlzRXF1YWxXaXRoKFsxLCAyLCAzXSwgWzEsIDIsIDNdLCBjdXN0b21pemVyKTsgLy8gdHJ1ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNFcXVhbFdpdGgoXG4gIGE6IGFueSxcbiAgYjogYW55LFxuICBhcmVWYWx1ZXNFcXVhbDogKFxuICAgIHg6IGFueSxcbiAgICB5OiBhbnksXG4gICAgcHJvcGVydHk/OiBQcm9wZXJ0eUtleSxcbiAgICB4UGFyZW50PzogYW55LFxuICAgIHlQYXJlbnQ/OiBhbnksXG4gICAgc3RhY2s/OiBNYXA8YW55LCBhbnk+XG4gICkgPT4gYm9vbGVhbiB8IHZvaWRcbik6IGJvb2xlYW4ge1xuICByZXR1cm4gaXNFcXVhbFdpdGhJbXBsKGEsIGIsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgYXJlVmFsdWVzRXF1YWwpO1xufVxuXG5mdW5jdGlvbiBpc0VxdWFsV2l0aEltcGwoXG4gIGE6IGFueSxcbiAgYjogYW55LFxuICBwcm9wZXJ0eTogUHJvcGVydHlLZXkgfCB1bmRlZmluZWQsXG4gIGFQYXJlbnQ6IGFueSxcbiAgYlBhcmVudDogYW55LFxuICBzdGFjazogTWFwPGFueSwgYW55PiB8IHVuZGVmaW5lZCxcbiAgYXJlVmFsdWVzRXF1YWw6IChcbiAgICB4OiBhbnksXG4gICAgeTogYW55LFxuICAgIHByb3BlcnR5PzogUHJvcGVydHlLZXksXG4gICAgeFBhcmVudD86IGFueSxcbiAgICB5UGFyZW50PzogYW55LFxuICAgIHN0YWNrPzogTWFwPGFueSwgYW55PlxuICApID0+IGJvb2xlYW4gfCB2b2lkXG4pOiBib29sZWFuIHtcbiAgY29uc3QgcmVzdWx0ID0gYXJlVmFsdWVzRXF1YWwoYSwgYiwgcHJvcGVydHksIGFQYXJlbnQsIGJQYXJlbnQsIHN0YWNrKTtcblxuICBpZiAocmVzdWx0ICE9PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgaWYgKHR5cGVvZiBhID09PSB0eXBlb2YgYikge1xuICAgIHN3aXRjaCAodHlwZW9mIGEpIHtcbiAgICAgIGNhc2UgJ2JpZ2ludCc6XG4gICAgICBjYXNlICdzdHJpbmcnOlxuICAgICAgY2FzZSAnYm9vbGVhbic6XG4gICAgICBjYXNlICdzeW1ib2wnOlxuICAgICAgY2FzZSAndW5kZWZpbmVkJzoge1xuICAgICAgICByZXR1cm4gYSA9PT0gYjtcbiAgICAgIH1cbiAgICAgIGNhc2UgJ251bWJlcic6IHtcbiAgICAgICAgcmV0dXJuIGEgPT09IGIgfHwgT2JqZWN0LmlzKGEsIGIpO1xuICAgICAgfVxuICAgICAgY2FzZSAnZnVuY3Rpb24nOiB7XG4gICAgICAgIHJldHVybiBhID09PSBiO1xuICAgICAgfVxuICAgICAgY2FzZSAnb2JqZWN0Jzoge1xuICAgICAgICByZXR1cm4gYXJlT2JqZWN0c0VxdWFsKGEsIGIsIHN0YWNrLCBhcmVWYWx1ZXNFcXVhbCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGFyZU9iamVjdHNFcXVhbChhLCBiLCBzdGFjaywgYXJlVmFsdWVzRXF1YWwpO1xufVxuXG5mdW5jdGlvbiBhcmVPYmplY3RzRXF1YWwoXG4gIGE6IGFueSxcbiAgYjogYW55LFxuICBzdGFjazogTWFwPGFueSwgYW55PiB8IHVuZGVmaW5lZCxcbiAgYXJlVmFsdWVzRXF1YWw6IChcbiAgICB4OiBhbnksXG4gICAgeTogYW55LFxuICAgIHByb3BlcnR5PzogUHJvcGVydHlLZXksXG4gICAgeFBhcmVudD86IGFueSxcbiAgICB5UGFyZW50PzogYW55LFxuICAgIHN0YWNrPzogTWFwPGFueSwgYW55PlxuICApID0+IGJvb2xlYW4gfCB2b2lkXG4pIHtcbiAgaWYgKE9iamVjdC5pcyhhLCBiKSkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgbGV0IGFUYWcgPSBnZXRUYWcoYSk7XG4gIGxldCBiVGFnID0gZ2V0VGFnKGIpO1xuXG4gIGlmIChhVGFnID09PSBhcmd1bWVudHNUYWcpIHtcbiAgICBhVGFnID0gb2JqZWN0VGFnO1xuICB9XG5cbiAgaWYgKGJUYWcgPT09IGFyZ3VtZW50c1RhZykge1xuICAgIGJUYWcgPSBvYmplY3RUYWc7XG4gIH1cblxuICBpZiAoYVRhZyAhPT0gYlRhZykge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHN3aXRjaCAoYVRhZykge1xuICAgIGNhc2Ugc3RyaW5nVGFnOlxuICAgICAgcmV0dXJuIGEudG9TdHJpbmcoKSA9PT0gYi50b1N0cmluZygpO1xuXG4gICAgY2FzZSBudW1iZXJUYWc6IHtcbiAgICAgIGNvbnN0IHggPSBhLnZhbHVlT2YoKTtcbiAgICAgIGNvbnN0IHkgPSBiLnZhbHVlT2YoKTtcblxuICAgICAgcmV0dXJuIGVxKHgsIHkpO1xuICAgIH1cblxuICAgIGNhc2UgYm9vbGVhblRhZzpcbiAgICBjYXNlIGRhdGVUYWc6XG4gICAgY2FzZSBzeW1ib2xUYWc6XG4gICAgICByZXR1cm4gT2JqZWN0LmlzKGEudmFsdWVPZigpLCBiLnZhbHVlT2YoKSk7XG5cbiAgICBjYXNlIHJlZ2V4cFRhZzoge1xuICAgICAgcmV0dXJuIGEuc291cmNlID09PSBiLnNvdXJjZSAmJiBhLmZsYWdzID09PSBiLmZsYWdzO1xuICAgIH1cblxuICAgIGNhc2UgZnVuY3Rpb25UYWc6IHtcbiAgICAgIHJldHVybiBhID09PSBiO1xuICAgIH1cbiAgfVxuXG4gIHN0YWNrID0gc3RhY2sgPz8gbmV3IE1hcCgpO1xuXG4gIGNvbnN0IGFTdGFjayA9IHN0YWNrLmdldChhKTtcbiAgY29uc3QgYlN0YWNrID0gc3RhY2suZ2V0KGIpO1xuXG4gIGlmIChhU3RhY2sgIT0gbnVsbCAmJiBiU3RhY2sgIT0gbnVsbCkge1xuICAgIHJldHVybiBhU3RhY2sgPT09IGI7XG4gIH1cblxuICBzdGFjay5zZXQoYSwgYik7XG4gIHN0YWNrLnNldChiLCBhKTtcblxuICB0cnkge1xuICAgIHN3aXRjaCAoYVRhZykge1xuICAgICAgY2FzZSBtYXBUYWc6IHtcbiAgICAgICAgaWYgKGEuc2l6ZSAhPT0gYi5zaXplKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgYS5lbnRyaWVzKCkpIHtcbiAgICAgICAgICBpZiAoIWIuaGFzKGtleSkgfHwgIWlzRXF1YWxXaXRoSW1wbCh2YWx1ZSwgYi5nZXQoa2V5KSwga2V5LCBhLCBiLCBzdGFjaywgYXJlVmFsdWVzRXF1YWwpKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG5cbiAgICAgIGNhc2Ugc2V0VGFnOiB7XG4gICAgICAgIGlmIChhLnNpemUgIT09IGIuc2l6ZSkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGFWYWx1ZXMgPSBBcnJheS5mcm9tKGEudmFsdWVzKCkpO1xuICAgICAgICBjb25zdCBiVmFsdWVzID0gQXJyYXkuZnJvbShiLnZhbHVlcygpKTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFWYWx1ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBjb25zdCBhVmFsdWUgPSBhVmFsdWVzW2ldO1xuICAgICAgICAgIGNvbnN0IGluZGV4ID0gYlZhbHVlcy5maW5kSW5kZXgoYlZhbHVlID0+IHtcbiAgICAgICAgICAgIHJldHVybiBpc0VxdWFsV2l0aEltcGwoYVZhbHVlLCBiVmFsdWUsIHVuZGVmaW5lZCwgYSwgYiwgc3RhY2ssIGFyZVZhbHVlc0VxdWFsKTtcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIGlmIChpbmRleCA9PT0gLTEpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBiVmFsdWVzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgY2FzZSBhcnJheVRhZzpcbiAgICAgIGNhc2UgdWludDhBcnJheVRhZzpcbiAgICAgIGNhc2UgdWludDhDbGFtcGVkQXJyYXlUYWc6XG4gICAgICBjYXNlIHVpbnQxNkFycmF5VGFnOlxuICAgICAgY2FzZSB1aW50MzJBcnJheVRhZzpcbiAgICAgIGNhc2UgYmlnVWludDY0QXJyYXlUYWc6XG4gICAgICBjYXNlIGludDhBcnJheVRhZzpcbiAgICAgIGNhc2UgaW50MTZBcnJheVRhZzpcbiAgICAgIGNhc2UgaW50MzJBcnJheVRhZzpcbiAgICAgIGNhc2UgYmlnSW50NjRBcnJheVRhZzpcbiAgICAgIGNhc2UgZmxvYXQzMkFycmF5VGFnOlxuICAgICAgY2FzZSBmbG9hdDY0QXJyYXlUYWc6IHtcbiAgICAgICAgLy8gQnVmZmVycyBhcmUgYWxzbyB0cmVhdGVkIGFzIFtvYmplY3QgVWludDhBcnJheV1zLlxuICAgICAgICBpZiAodHlwZW9mIEJ1ZmZlciAhPT0gJ3VuZGVmaW5lZCcgJiYgQnVmZmVyLmlzQnVmZmVyKGEpICE9PSBCdWZmZXIuaXNCdWZmZXIoYikpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoYS5sZW5ndGggIT09IGIubGVuZ3RoKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgaWYgKCFpc0VxdWFsV2l0aEltcGwoYVtpXSwgYltpXSwgaSwgYSwgYiwgc3RhY2ssIGFyZVZhbHVlc0VxdWFsKSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuXG4gICAgICBjYXNlIGFycmF5QnVmZmVyVGFnOiB7XG4gICAgICAgIGlmIChhLmJ5dGVMZW5ndGggIT09IGIuYnl0ZUxlbmd0aCkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBhcmVPYmplY3RzRXF1YWwobmV3IFVpbnQ4QXJyYXkoYSksIG5ldyBVaW50OEFycmF5KGIpLCBzdGFjaywgYXJlVmFsdWVzRXF1YWwpO1xuICAgICAgfVxuXG4gICAgICBjYXNlIGRhdGFWaWV3VGFnOiB7XG4gICAgICAgIGlmIChhLmJ5dGVMZW5ndGggIT09IGIuYnl0ZUxlbmd0aCB8fCBhLmJ5dGVPZmZzZXQgIT09IGIuYnl0ZU9mZnNldCkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBhcmVPYmplY3RzRXF1YWwobmV3IFVpbnQ4QXJyYXkoYSksIG5ldyBVaW50OEFycmF5KGIpLCBzdGFjaywgYXJlVmFsdWVzRXF1YWwpO1xuICAgICAgfVxuXG4gICAgICBjYXNlIGVycm9yVGFnOiB7XG4gICAgICAgIHJldHVybiBhLm5hbWUgPT09IGIubmFtZSAmJiBhLm1lc3NhZ2UgPT09IGIubWVzc2FnZTtcbiAgICAgIH1cblxuICAgICAgY2FzZSBvYmplY3RUYWc6IHtcbiAgICAgICAgY29uc3QgYXJlRXF1YWxJbnN0YW5jZXMgPVxuICAgICAgICAgIGFyZU9iamVjdHNFcXVhbChhLmNvbnN0cnVjdG9yLCBiLmNvbnN0cnVjdG9yLCBzdGFjaywgYXJlVmFsdWVzRXF1YWwpIHx8XG4gICAgICAgICAgKGlzUGxhaW5PYmplY3QoYSkgJiYgaXNQbGFpbk9iamVjdChiKSk7XG5cbiAgICAgICAgaWYgKCFhcmVFcXVhbEluc3RhbmNlcykge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGFLZXlzID0gWy4uLk9iamVjdC5rZXlzKGEpLCAuLi5nZXRTeW1ib2xzKGEpXTtcbiAgICAgICAgY29uc3QgYktleXMgPSBbLi4uT2JqZWN0LmtleXMoYiksIC4uLmdldFN5bWJvbHMoYildO1xuXG4gICAgICAgIGlmIChhS2V5cy5sZW5ndGggIT09IGJLZXlzLmxlbmd0aCkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYUtleXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBjb25zdCBwcm9wS2V5ID0gYUtleXNbaV07XG4gICAgICAgICAgY29uc3QgYVByb3AgPSAoYSBhcyBhbnkpW3Byb3BLZXldO1xuXG4gICAgICAgICAgaWYgKCFPYmplY3QuaGFzT3duKGIsIHByb3BLZXkpKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgYlByb3AgPSAoYiBhcyBhbnkpW3Byb3BLZXldO1xuXG4gICAgICAgICAgaWYgKCFpc0VxdWFsV2l0aEltcGwoYVByb3AsIGJQcm9wLCBwcm9wS2V5LCBhLCBiLCBzdGFjaywgYXJlVmFsdWVzRXF1YWwpKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgICBkZWZhdWx0OiB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG4gIH0gZmluYWxseSB7XG4gICAgc3RhY2suZGVsZXRlKGEpO1xuICAgIHN0YWNrLmRlbGV0ZShiKTtcbiAgfVxufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsYUFBYSxRQUFRLHFCQUFxQjtBQUNuRCxTQUFTLFVBQVUsUUFBUSxvQ0FBb0M7QUFDL0QsU0FBUyxNQUFNLFFBQVEsZ0NBQWdDO0FBQ3ZELFNBQ0UsWUFBWSxFQUNaLGNBQWMsRUFDZCxRQUFRLEVBQ1IsZ0JBQWdCLEVBQ2hCLGlCQUFpQixFQUNqQixVQUFVLEVBQ1YsV0FBVyxFQUNYLE9BQU8sRUFDUCxRQUFRLEVBQ1IsZUFBZSxFQUNm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
// denoCacheMetadata=6604761796950480793,1490979442957945848