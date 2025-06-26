// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible. Do not rely on good formatting of values
// for AssertionError messages in browsers.
import { red, stripColor } from "../fmt/colors.ts";
import { buildMessage, diff, diffstr } from "./_diff.ts";
import { format } from "./_format.ts";
const CAN_NOT_DISPLAY = "[Cannot display]";
export class AssertionError extends Error {
  name = "AssertionError";
  constructor(message){
    super(message);
  }
}
function isKeyedCollection(x) {
  return [
    Symbol.iterator,
    "size"
  ].every((k)=>k in x);
}
/**
 * Deep equality comparison used in assertions
 * @param c actual value
 * @param d expected value
 */ export function equal(c, d) {
  const seen = new Map();
  return function compare(a, b) {
    // Have to render RegExp & Date for string comparison
    // unless it's mistreated as object
    if (a && b && (a instanceof RegExp && b instanceof RegExp || a instanceof URL && b instanceof URL)) {
      return String(a) === String(b);
    }
    if (a instanceof Date && b instanceof Date) {
      const aTime = a.getTime();
      const bTime = b.getTime();
      // Check for NaN equality manually since NaN is not
      // equal to itself.
      if (Number.isNaN(aTime) && Number.isNaN(bTime)) {
        return true;
      }
      return aTime === bTime;
    }
    if (typeof a === "number" && typeof b === "number") {
      return Number.isNaN(a) && Number.isNaN(b) || a === b;
    }
    if (Object.is(a, b)) {
      return true;
    }
    if (a && typeof a === "object" && b && typeof b === "object") {
      if (a && b && !constructorsEqual(a, b)) {
        return false;
      }
      if (a instanceof WeakMap || b instanceof WeakMap) {
        if (!(a instanceof WeakMap && b instanceof WeakMap)) return false;
        throw new TypeError("cannot compare WeakMap instances");
      }
      if (a instanceof WeakSet || b instanceof WeakSet) {
        if (!(a instanceof WeakSet && b instanceof WeakSet)) return false;
        throw new TypeError("cannot compare WeakSet instances");
      }
      if (seen.get(a) === b) {
        return true;
      }
      if (Object.keys(a || {}).length !== Object.keys(b || {}).length) {
        return false;
      }
      seen.set(a, b);
      if (isKeyedCollection(a) && isKeyedCollection(b)) {
        if (a.size !== b.size) {
          return false;
        }
        let unmatchedEntries = a.size;
        for (const [aKey, aValue] of a.entries()){
          for (const [bKey, bValue] of b.entries()){
            /* Given that Map keys can be references, we need
             * to ensure that they are also deeply equal */ if (aKey === aValue && bKey === bValue && compare(aKey, bKey) || compare(aKey, bKey) && compare(aValue, bValue)) {
              unmatchedEntries--;
              break;
            }
          }
        }
        return unmatchedEntries === 0;
      }
      const merged = {
        ...a,
        ...b
      };
      for (const key of [
        ...Object.getOwnPropertyNames(merged),
        ...Object.getOwnPropertySymbols(merged)
      ]){
        if (!compare(a && a[key], b && b[key])) {
          return false;
        }
        if (key in a && !(key in b) || key in b && !(key in a)) {
          return false;
        }
      }
      if (a instanceof WeakRef || b instanceof WeakRef) {
        if (!(a instanceof WeakRef && b instanceof WeakRef)) return false;
        return compare(a.deref(), b.deref());
      }
      return true;
    }
    return false;
  }(c, d);
}
// deno-lint-ignore ban-types
function constructorsEqual(a, b) {
  return a.constructor === b.constructor || a.constructor === Object && !b.constructor || !a.constructor && b.constructor === Object;
}
/** Make an assertion, error will be thrown if `expr` does not have truthy value. */ export function assert(expr, msg = "") {
  if (!expr) {
    throw new AssertionError(msg);
  }
}
/** Make an assertion, error will be thrown if `expr` have truthy value. */ export function assertFalse(expr, msg = "") {
  if (expr) {
    throw new AssertionError(msg);
  }
}
/**
 * Make an assertion that `actual` and `expected` are equal, deeply. If not
 * deeply equal, then throw.
 *
 * Type parameter can be specified to ensure values under comparison have the same type.
 * For example:
 * ```ts
 * import { assertEquals } from "./asserts.ts";
 *
 * assertEquals<number>(1, 2)
 * ```
 */ export function assertEquals(actual, expected, msg) {
  if (equal(actual, expected)) {
    return;
  }
  let message = "";
  const actualString = format(actual);
  const expectedString = format(expected);
  try {
    const stringDiff = typeof actual === "string" && typeof expected === "string";
    const diffResult = stringDiff ? diffstr(actual, expected) : diff(actualString.split("\n"), expectedString.split("\n"));
    const diffMsg = buildMessage(diffResult, {
      stringDiff
    }).join("\n");
    message = `Values are not equal:\n${diffMsg}`;
  } catch  {
    message = `\n${red(CAN_NOT_DISPLAY)} + \n\n`;
  }
  if (msg) {
    message = msg;
  }
  throw new AssertionError(message);
}
/**
 * Make an assertion that `actual` and `expected` are not equal, deeply.
 * If not then throw.
 *
 * Type parameter can be specified to ensure values under comparison have the same type.
 * For example:
 * ```ts
 * import { assertNotEquals } from "./asserts.ts";
 *
 * assertNotEquals<number>(1, 2)
 * ```
 */ export function assertNotEquals(actual, expected, msg) {
  if (!equal(actual, expected)) {
    return;
  }
  let actualString;
  let expectedString;
  try {
    actualString = String(actual);
  } catch  {
    actualString = "[Cannot display]";
  }
  try {
    expectedString = String(expected);
  } catch  {
    expectedString = "[Cannot display]";
  }
  if (!msg) {
    msg = `actual: ${actualString} expected not to be: ${expectedString}`;
  }
  throw new AssertionError(msg);
}
/**
 * Make an assertion that `actual` and `expected` are strictly equal. If
 * not then throw.
 *
 * ```ts
 * import { assertStrictEquals } from "./asserts.ts";
 *
 * assertStrictEquals(1, 2)
 * ```
 */ export function assertStrictEquals(actual, expected, msg) {
  if (Object.is(actual, expected)) {
    return;
  }
  let message;
  if (msg) {
    message = msg;
  } else {
    const actualString = format(actual);
    const expectedString = format(expected);
    if (actualString === expectedString) {
      const withOffset = actualString.split("\n").map((l)=>`    ${l}`).join("\n");
      message = `Values have the same structure but are not reference-equal:\n\n${red(withOffset)}\n`;
    } else {
      try {
        const stringDiff = typeof actual === "string" && typeof expected === "string";
        const diffResult = stringDiff ? diffstr(actual, expected) : diff(actualString.split("\n"), expectedString.split("\n"));
        const diffMsg = buildMessage(diffResult, {
          stringDiff
        }).join("\n");
        message = `Values are not strictly equal:\n${diffMsg}`;
      } catch  {
        message = `\n${red(CAN_NOT_DISPLAY)} + \n\n`;
      }
    }
  }
  throw new AssertionError(message);
}
/**
 * Make an assertion that `actual` and `expected` are not strictly equal.
 * If the values are strictly equal then throw.
 *
 * ```ts
 * import { assertNotStrictEquals } from "./asserts.ts";
 *
 * assertNotStrictEquals(1, 1)
 * ```
 */ export function assertNotStrictEquals(actual, expected, msg) {
  if (!Object.is(actual, expected)) {
    return;
  }
  throw new AssertionError(msg ?? `Expected "actual" to be strictly unequal to: ${format(actual)}\n`);
}
/**
 * Make an assertion that `actual` and `expected` are almost equal numbers through
 * a given tolerance. It can be used to take into account IEEE-754 double-precision
 * floating-point representation limitations.
 * If the values are not almost equal then throw.
 *
 * ```ts
 * import { assertAlmostEquals, assertThrows } from "./asserts.ts";
 *
 * assertAlmostEquals(0.1, 0.2);
 *
 * // Using a custom tolerance value
 * assertAlmostEquals(0.1 + 0.2, 0.3, 1e-16);
 * assertThrows(() => assertAlmostEquals(0.1 + 0.2, 0.3, 1e-17));
 * ```
 */ export function assertAlmostEquals(actual, expected, tolerance = 1e-7, msg) {
  if (Object.is(actual, expected)) {
    return;
  }
  const delta = Math.abs(expected - actual);
  if (delta <= tolerance) {
    return;
  }
  const f = (n)=>Number.isInteger(n) ? n : n.toExponential();
  throw new AssertionError(msg ?? `actual: "${f(actual)}" expected to be close to "${f(expected)}": \
delta "${f(delta)}" is greater than "${f(tolerance)}"`);
}
/**
 * Make an assertion that `obj` is an instance of `type`.
 * If not then throw.
 */ export function assertInstanceOf(actual, expectedType, msg = "") {
  if (!msg) {
    const expectedTypeStr = expectedType.name;
    let actualTypeStr = "";
    if (actual === null) {
      actualTypeStr = "null";
    } else if (actual === undefined) {
      actualTypeStr = "undefined";
    } else if (typeof actual === "object") {
      actualTypeStr = actual.constructor?.name ?? "Object";
    } else {
      actualTypeStr = typeof actual;
    }
    if (expectedTypeStr == actualTypeStr) {
      msg = `Expected object to be an instance of "${expectedTypeStr}".`;
    } else if (actualTypeStr == "function") {
      msg = `Expected object to be an instance of "${expectedTypeStr}" but was not an instanced object.`;
    } else {
      msg = `Expected object to be an instance of "${expectedTypeStr}" but was "${actualTypeStr}".`;
    }
  }
  assert(actual instanceof expectedType, msg);
}
/**
 * Make an assertion that actual is not null or undefined.
 * If not then throw.
 */ export function assertExists(actual, msg) {
  if (actual === undefined || actual === null) {
    if (!msg) {
      msg = `actual: "${actual}" expected to not be null or undefined`;
    }
    throw new AssertionError(msg);
  }
}
/**
 * Make an assertion that actual includes expected. If not
 * then throw.
 */ export function assertStringIncludes(actual, expected, msg) {
  if (!actual.includes(expected)) {
    if (!msg) {
      msg = `actual: "${actual}" expected to contain: "${expected}"`;
    }
    throw new AssertionError(msg);
  }
}
/**
 * Make an assertion that `actual` includes the `expected` values.
 * If not then an error will be thrown.
 *
 * Type parameter can be specified to ensure values under comparison have the same type.
 * For example:
 *
 * ```ts
 * import { assertArrayIncludes } from "./asserts.ts";
 *
 * assertArrayIncludes<number>([1, 2], [2])
 * ```
 */ export function assertArrayIncludes(actual, expected, msg) {
  const missing = [];
  for(let i = 0; i < expected.length; i++){
    let found = false;
    for(let j = 0; j < actual.length; j++){
      if (equal(expected[i], actual[j])) {
        found = true;
        break;
      }
    }
    if (!found) {
      missing.push(expected[i]);
    }
  }
  if (missing.length === 0) {
    return;
  }
  if (!msg) {
    msg = `actual: "${format(actual)}" expected to include: "${format(expected)}"\nmissing: ${format(missing)}`;
  }
  throw new AssertionError(msg);
}
/**
 * Make an assertion that `actual` match RegExp `expected`. If not
 * then throw.
 */ export function assertMatch(actual, expected, msg) {
  if (!expected.test(actual)) {
    if (!msg) {
      msg = `actual: "${actual}" expected to match: "${expected}"`;
    }
    throw new AssertionError(msg);
  }
}
/**
 * Make an assertion that `actual` not match RegExp `expected`. If match
 * then throw.
 */ export function assertNotMatch(actual, expected, msg) {
  if (expected.test(actual)) {
    if (!msg) {
      msg = `actual: "${actual}" expected to not match: "${expected}"`;
    }
    throw new AssertionError(msg);
  }
}
/**
 * Make an assertion that `actual` object is a subset of `expected` object, deeply.
 * If not, then throw.
 */ export function assertObjectMatch(// deno-lint-ignore no-explicit-any
actual, expected) {
  function filter(a, b) {
    const seen = new WeakMap();
    return fn(a, b);
    function fn(a, b) {
      // Prevent infinite loop with circular references with same filter
      if (seen.has(a) && seen.get(a) === b) {
        return a;
      }
      seen.set(a, b);
      // Filter keys and symbols which are present in both actual and expected
      const filtered = {};
      const entries = [
        ...Object.getOwnPropertyNames(a),
        ...Object.getOwnPropertySymbols(a)
      ].filter((key)=>key in b).map((key)=>[
          key,
          a[key]
        ]);
      for (const [key, value] of entries){
        // On array references, build a filtered array and filter nested objects inside
        if (Array.isArray(value)) {
          const subset = b[key];
          if (Array.isArray(subset)) {
            filtered[key] = fn({
              ...value
            }, {
              ...subset
            });
            continue;
          }
        } else if (value instanceof RegExp) {
          filtered[key] = value;
          continue;
        } else if (typeof value === "object") {
          const subset = b[key];
          if (typeof subset === "object" && subset) {
            // When both operands are maps, build a filtered map with common keys and filter nested objects inside
            if (value instanceof Map && subset instanceof Map) {
              filtered[key] = new Map([
                ...value
              ].filter(([k])=>subset.has(k)).map(([k, v])=>[
                  k,
                  typeof v === "object" ? fn(v, subset.get(k)) : v
                ]));
              continue;
            }
            // When both operands are set, build a filtered set with common values
            if (value instanceof Set && subset instanceof Set) {
              filtered[key] = new Set([
                ...value
              ].filter((v)=>subset.has(v)));
              continue;
            }
            filtered[key] = fn(value, subset);
            continue;
          }
        }
        filtered[key] = value;
      }
      return filtered;
    }
  }
  return assertEquals(// get the intersection of "actual" and "expected"
  // side effect: all the instances' constructor field is "Object" now.
  filter(actual, expected), // set (nested) instances' constructor field to be "Object" without changing expected value.
  // see https://github.com/denoland/deno_std/pull/1419
  filter(expected, expected));
}
/**
 * Forcefully throws a failed assertion
 */ export function fail(msg) {
  assert(false, `Failed assertion${msg ? `: ${msg}` : "."}`);
}
/**
 * Make an assertion that `error` is an `Error`.
 * If not then an error will be thrown.
 * An error class and a string that should be included in the
 * error message can also be asserted.
 */ export function assertIsError(error, // deno-lint-ignore no-explicit-any
ErrorClass, msgIncludes, msg) {
  if (error instanceof Error === false) {
    throw new AssertionError(`Expected "error" to be an Error object.`);
  }
  if (ErrorClass && !(error instanceof ErrorClass)) {
    msg = `Expected error to be instance of "${ErrorClass.name}", but was "${typeof error === "object" ? error?.constructor?.name : "[not an object]"}"${msg ? `: ${msg}` : "."}`;
    throw new AssertionError(msg);
  }
  if (msgIncludes && (!(error instanceof Error) || !stripColor(error.message).includes(stripColor(msgIncludes)))) {
    msg = `Expected error message to include "${msgIncludes}", but got "${error instanceof Error ? error.message : "[not an Error]"}"${msg ? `: ${msg}` : "."}`;
    throw new AssertionError(msg);
  }
}
export function assertThrows(fn, errorClassOrCallbackOrMsg, msgIncludesOrMsg, msg) {
  // deno-lint-ignore no-explicit-any
  let ErrorClass = undefined;
  let msgIncludes = undefined;
  let errorCallback = undefined;
  let err;
  if (typeof errorClassOrCallbackOrMsg !== "string") {
    if (errorClassOrCallbackOrMsg === undefined || errorClassOrCallbackOrMsg.prototype instanceof Error || errorClassOrCallbackOrMsg.prototype === Error.prototype) {
      // deno-lint-ignore no-explicit-any
      ErrorClass = errorClassOrCallbackOrMsg;
      msgIncludes = msgIncludesOrMsg;
    } else {
      errorCallback = errorClassOrCallbackOrMsg;
      msg = msgIncludesOrMsg;
    }
  } else {
    msg = errorClassOrCallbackOrMsg;
  }
  let doesThrow = false;
  const msgToAppendToError = msg ? `: ${msg}` : ".";
  try {
    fn();
  } catch (error) {
    if (ErrorClass || errorCallback) {
      if (error instanceof Error === false) {
        throw new AssertionError("A non-Error object was thrown.");
      }
      assertIsError(error, ErrorClass, msgIncludes, msg);
      if (typeof errorCallback === "function") {
        errorCallback(error);
      }
    }
    err = error;
    doesThrow = true;
  }
  if (!doesThrow) {
    msg = `Expected function to throw${msgToAppendToError}`;
    throw new AssertionError(msg);
  }
  return err;
}
export async function assertRejects(fn, errorClassOrCallbackOrMsg, msgIncludesOrMsg, msg) {
  // deno-lint-ignore no-explicit-any
  let ErrorClass = undefined;
  let msgIncludes = undefined;
  let errorCallback = undefined;
  let err;
  if (typeof errorClassOrCallbackOrMsg !== "string") {
    if (errorClassOrCallbackOrMsg === undefined || errorClassOrCallbackOrMsg.prototype instanceof Error || errorClassOrCallbackOrMsg.prototype === Error.prototype) {
      // deno-lint-ignore no-explicit-any
      ErrorClass = errorClassOrCallbackOrMsg;
      msgIncludes = msgIncludesOrMsg;
    } else {
      errorCallback = errorClassOrCallbackOrMsg;
      msg = msgIncludesOrMsg;
    }
  } else {
    msg = errorClassOrCallbackOrMsg;
  }
  let doesThrow = false;
  let isPromiseReturned = false;
  const msgToAppendToError = msg ? `: ${msg}` : ".";
  try {
    const possiblePromise = fn();
    if (possiblePromise && typeof possiblePromise === "object" && typeof possiblePromise.then === "function") {
      isPromiseReturned = true;
      await possiblePromise;
    }
  } catch (error) {
    if (!isPromiseReturned) {
      throw new AssertionError(`Function throws when expected to reject${msgToAppendToError}`);
    }
    if (ErrorClass || errorCallback) {
      if (error instanceof Error === false) {
        throw new AssertionError("A non-Error object was rejected.");
      }
      assertIsError(error, ErrorClass, msgIncludes, msg);
      if (typeof errorCallback == "function") {
        errorCallback(error);
      }
    }
    err = error;
    doesThrow = true;
  }
  if (!doesThrow) {
    throw new AssertionError(`Expected function to reject${msgToAppendToError}`);
  }
  return err;
}
/** Use this to stub out methods that will throw when invoked. */ export function unimplemented(msg) {
  throw new AssertionError(msg || "unimplemented");
}
/** Use this to assert unreachable code. */ export function unreachable() {
  throw new AssertionError("unreachable");
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE1MC4wL3Rlc3RpbmcvYXNzZXJ0cy50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuLy8gVGhpcyBtb2R1bGUgaXMgYnJvd3NlciBjb21wYXRpYmxlLiBEbyBub3QgcmVseSBvbiBnb29kIGZvcm1hdHRpbmcgb2YgdmFsdWVzXG4vLyBmb3IgQXNzZXJ0aW9uRXJyb3IgbWVzc2FnZXMgaW4gYnJvd3NlcnMuXG5cbmltcG9ydCB7IHJlZCwgc3RyaXBDb2xvciB9IGZyb20gXCIuLi9mbXQvY29sb3JzLnRzXCI7XG5pbXBvcnQgeyBidWlsZE1lc3NhZ2UsIGRpZmYsIGRpZmZzdHIgfSBmcm9tIFwiLi9fZGlmZi50c1wiO1xuaW1wb3J0IHsgZm9ybWF0IH0gZnJvbSBcIi4vX2Zvcm1hdC50c1wiO1xuXG5jb25zdCBDQU5fTk9UX0RJU1BMQVkgPSBcIltDYW5ub3QgZGlzcGxheV1cIjtcblxuZXhwb3J0IGNsYXNzIEFzc2VydGlvbkVycm9yIGV4dGVuZHMgRXJyb3Ige1xuICBvdmVycmlkZSBuYW1lID0gXCJBc3NlcnRpb25FcnJvclwiO1xuICBjb25zdHJ1Y3RvcihtZXNzYWdlOiBzdHJpbmcpIHtcbiAgICBzdXBlcihtZXNzYWdlKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBpc0tleWVkQ29sbGVjdGlvbih4OiB1bmtub3duKTogeCBpcyBTZXQ8dW5rbm93bj4ge1xuICByZXR1cm4gW1N5bWJvbC5pdGVyYXRvciwgXCJzaXplXCJdLmV2ZXJ5KChrKSA9PiBrIGluICh4IGFzIFNldDx1bmtub3duPikpO1xufVxuXG4vKipcbiAqIERlZXAgZXF1YWxpdHkgY29tcGFyaXNvbiB1c2VkIGluIGFzc2VydGlvbnNcbiAqIEBwYXJhbSBjIGFjdHVhbCB2YWx1ZVxuICogQHBhcmFtIGQgZXhwZWN0ZWQgdmFsdWVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGVxdWFsKGM6IHVua25vd24sIGQ6IHVua25vd24pOiBib29sZWFuIHtcbiAgY29uc3Qgc2VlbiA9IG5ldyBNYXAoKTtcbiAgcmV0dXJuIChmdW5jdGlvbiBjb21wYXJlKGE6IHVua25vd24sIGI6IHVua25vd24pOiBib29sZWFuIHtcbiAgICAvLyBIYXZlIHRvIHJlbmRlciBSZWdFeHAgJiBEYXRlIGZvciBzdHJpbmcgY29tcGFyaXNvblxuICAgIC8vIHVubGVzcyBpdCdzIG1pc3RyZWF0ZWQgYXMgb2JqZWN0XG4gICAgaWYgKFxuICAgICAgYSAmJlxuICAgICAgYiAmJlxuICAgICAgKChhIGluc3RhbmNlb2YgUmVnRXhwICYmIGIgaW5zdGFuY2VvZiBSZWdFeHApIHx8XG4gICAgICAgIChhIGluc3RhbmNlb2YgVVJMICYmIGIgaW5zdGFuY2VvZiBVUkwpKVxuICAgICkge1xuICAgICAgcmV0dXJuIFN0cmluZyhhKSA9PT0gU3RyaW5nKGIpO1xuICAgIH1cbiAgICBpZiAoYSBpbnN0YW5jZW9mIERhdGUgJiYgYiBpbnN0YW5jZW9mIERhdGUpIHtcbiAgICAgIGNvbnN0IGFUaW1lID0gYS5nZXRUaW1lKCk7XG4gICAgICBjb25zdCBiVGltZSA9IGIuZ2V0VGltZSgpO1xuICAgICAgLy8gQ2hlY2sgZm9yIE5hTiBlcXVhbGl0eSBtYW51YWxseSBzaW5jZSBOYU4gaXMgbm90XG4gICAgICAvLyBlcXVhbCB0byBpdHNlbGYuXG4gICAgICBpZiAoTnVtYmVyLmlzTmFOKGFUaW1lKSAmJiBOdW1iZXIuaXNOYU4oYlRpbWUpKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGFUaW1lID09PSBiVGltZTtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBhID09PSBcIm51bWJlclwiICYmIHR5cGVvZiBiID09PSBcIm51bWJlclwiKSB7XG4gICAgICByZXR1cm4gTnVtYmVyLmlzTmFOKGEpICYmIE51bWJlci5pc05hTihiKSB8fCBhID09PSBiO1xuICAgIH1cbiAgICBpZiAoT2JqZWN0LmlzKGEsIGIpKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKGEgJiYgdHlwZW9mIGEgPT09IFwib2JqZWN0XCIgJiYgYiAmJiB0eXBlb2YgYiA9PT0gXCJvYmplY3RcIikge1xuICAgICAgaWYgKGEgJiYgYiAmJiAhY29uc3RydWN0b3JzRXF1YWwoYSwgYikpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgaWYgKGEgaW5zdGFuY2VvZiBXZWFrTWFwIHx8IGIgaW5zdGFuY2VvZiBXZWFrTWFwKSB7XG4gICAgICAgIGlmICghKGEgaW5zdGFuY2VvZiBXZWFrTWFwICYmIGIgaW5zdGFuY2VvZiBXZWFrTWFwKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiY2Fubm90IGNvbXBhcmUgV2Vha01hcCBpbnN0YW5jZXNcIik7XG4gICAgICB9XG4gICAgICBpZiAoYSBpbnN0YW5jZW9mIFdlYWtTZXQgfHwgYiBpbnN0YW5jZW9mIFdlYWtTZXQpIHtcbiAgICAgICAgaWYgKCEoYSBpbnN0YW5jZW9mIFdlYWtTZXQgJiYgYiBpbnN0YW5jZW9mIFdlYWtTZXQpKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJjYW5ub3QgY29tcGFyZSBXZWFrU2V0IGluc3RhbmNlc1wiKTtcbiAgICAgIH1cbiAgICAgIGlmIChzZWVuLmdldChhKSA9PT0gYikge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIGlmIChPYmplY3Qua2V5cyhhIHx8IHt9KS5sZW5ndGggIT09IE9iamVjdC5rZXlzKGIgfHwge30pLmxlbmd0aCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICBzZWVuLnNldChhLCBiKTtcbiAgICAgIGlmIChpc0tleWVkQ29sbGVjdGlvbihhKSAmJiBpc0tleWVkQ29sbGVjdGlvbihiKSkge1xuICAgICAgICBpZiAoYS5zaXplICE9PSBiLnNpemUpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgdW5tYXRjaGVkRW50cmllcyA9IGEuc2l6ZTtcblxuICAgICAgICBmb3IgKGNvbnN0IFthS2V5LCBhVmFsdWVdIG9mIGEuZW50cmllcygpKSB7XG4gICAgICAgICAgZm9yIChjb25zdCBbYktleSwgYlZhbHVlXSBvZiBiLmVudHJpZXMoKSkge1xuICAgICAgICAgICAgLyogR2l2ZW4gdGhhdCBNYXAga2V5cyBjYW4gYmUgcmVmZXJlbmNlcywgd2UgbmVlZFxuICAgICAgICAgICAgICogdG8gZW5zdXJlIHRoYXQgdGhleSBhcmUgYWxzbyBkZWVwbHkgZXF1YWwgKi9cbiAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgKGFLZXkgPT09IGFWYWx1ZSAmJiBiS2V5ID09PSBiVmFsdWUgJiYgY29tcGFyZShhS2V5LCBiS2V5KSkgfHxcbiAgICAgICAgICAgICAgKGNvbXBhcmUoYUtleSwgYktleSkgJiYgY29tcGFyZShhVmFsdWUsIGJWYWx1ZSkpXG4gICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgdW5tYXRjaGVkRW50cmllcy0tO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdW5tYXRjaGVkRW50cmllcyA9PT0gMDtcbiAgICAgIH1cbiAgICAgIGNvbnN0IG1lcmdlZCA9IHsgLi4uYSwgLi4uYiB9O1xuICAgICAgZm9yIChcbiAgICAgICAgY29uc3Qga2V5IG9mIFtcbiAgICAgICAgICAuLi5PYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhtZXJnZWQpLFxuICAgICAgICAgIC4uLk9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHMobWVyZ2VkKSxcbiAgICAgICAgXVxuICAgICAgKSB7XG4gICAgICAgIHR5cGUgS2V5ID0ga2V5b2YgdHlwZW9mIG1lcmdlZDtcbiAgICAgICAgaWYgKCFjb21wYXJlKGEgJiYgYVtrZXkgYXMgS2V5XSwgYiAmJiBiW2tleSBhcyBLZXldKSkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoKChrZXkgaW4gYSkgJiYgKCEoa2V5IGluIGIpKSkgfHwgKChrZXkgaW4gYikgJiYgKCEoa2V5IGluIGEpKSkpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChhIGluc3RhbmNlb2YgV2Vha1JlZiB8fCBiIGluc3RhbmNlb2YgV2Vha1JlZikge1xuICAgICAgICBpZiAoIShhIGluc3RhbmNlb2YgV2Vha1JlZiAmJiBiIGluc3RhbmNlb2YgV2Vha1JlZikpIHJldHVybiBmYWxzZTtcbiAgICAgICAgcmV0dXJuIGNvbXBhcmUoYS5kZXJlZigpLCBiLmRlcmVmKCkpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfSkoYywgZCk7XG59XG5cbi8vIGRlbm8tbGludC1pZ25vcmUgYmFuLXR5cGVzXG5mdW5jdGlvbiBjb25zdHJ1Y3RvcnNFcXVhbChhOiBvYmplY3QsIGI6IG9iamVjdCkge1xuICByZXR1cm4gYS5jb25zdHJ1Y3RvciA9PT0gYi5jb25zdHJ1Y3RvciB8fFxuICAgIGEuY29uc3RydWN0b3IgPT09IE9iamVjdCAmJiAhYi5jb25zdHJ1Y3RvciB8fFxuICAgICFhLmNvbnN0cnVjdG9yICYmIGIuY29uc3RydWN0b3IgPT09IE9iamVjdDtcbn1cblxuLyoqIE1ha2UgYW4gYXNzZXJ0aW9uLCBlcnJvciB3aWxsIGJlIHRocm93biBpZiBgZXhwcmAgZG9lcyBub3QgaGF2ZSB0cnV0aHkgdmFsdWUuICovXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0KGV4cHI6IHVua25vd24sIG1zZyA9IFwiXCIpOiBhc3NlcnRzIGV4cHIge1xuICBpZiAoIWV4cHIpIHtcbiAgICB0aHJvdyBuZXcgQXNzZXJ0aW9uRXJyb3IobXNnKTtcbiAgfVxufVxuXG4vKiogTWFrZSBhbiBhc3NlcnRpb24sIGVycm9yIHdpbGwgYmUgdGhyb3duIGlmIGBleHByYCBoYXZlIHRydXRoeSB2YWx1ZS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRGYWxzZShleHByOiB1bmtub3duLCBtc2cgPSBcIlwiKTogYXNzZXJ0cyBleHByIGlzIGZhbHNlIHtcbiAgaWYgKGV4cHIpIHtcbiAgICB0aHJvdyBuZXcgQXNzZXJ0aW9uRXJyb3IobXNnKTtcbiAgfVxufVxuXG4vKipcbiAqIE1ha2UgYW4gYXNzZXJ0aW9uIHRoYXQgYGFjdHVhbGAgYW5kIGBleHBlY3RlZGAgYXJlIGVxdWFsLCBkZWVwbHkuIElmIG5vdFxuICogZGVlcGx5IGVxdWFsLCB0aGVuIHRocm93LlxuICpcbiAqIFR5cGUgcGFyYW1ldGVyIGNhbiBiZSBzcGVjaWZpZWQgdG8gZW5zdXJlIHZhbHVlcyB1bmRlciBjb21wYXJpc29uIGhhdmUgdGhlIHNhbWUgdHlwZS5cbiAqIEZvciBleGFtcGxlOlxuICogYGBgdHNcbiAqIGltcG9ydCB7IGFzc2VydEVxdWFscyB9IGZyb20gXCIuL2Fzc2VydHMudHNcIjtcbiAqXG4gKiBhc3NlcnRFcXVhbHM8bnVtYmVyPigxLCAyKVxuICogYGBgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRFcXVhbHM8VD4oYWN0dWFsOiBULCBleHBlY3RlZDogVCwgbXNnPzogc3RyaW5nKTogdm9pZCB7XG4gIGlmIChlcXVhbChhY3R1YWwsIGV4cGVjdGVkKSkge1xuICAgIHJldHVybjtcbiAgfVxuICBsZXQgbWVzc2FnZSA9IFwiXCI7XG4gIGNvbnN0IGFjdHVhbFN0cmluZyA9IGZvcm1hdChhY3R1YWwpO1xuICBjb25zdCBleHBlY3RlZFN0cmluZyA9IGZvcm1hdChleHBlY3RlZCk7XG4gIHRyeSB7XG4gICAgY29uc3Qgc3RyaW5nRGlmZiA9ICh0eXBlb2YgYWN0dWFsID09PSBcInN0cmluZ1wiKSAmJlxuICAgICAgKHR5cGVvZiBleHBlY3RlZCA9PT0gXCJzdHJpbmdcIik7XG4gICAgY29uc3QgZGlmZlJlc3VsdCA9IHN0cmluZ0RpZmZcbiAgICAgID8gZGlmZnN0cihhY3R1YWwgYXMgc3RyaW5nLCBleHBlY3RlZCBhcyBzdHJpbmcpXG4gICAgICA6IGRpZmYoYWN0dWFsU3RyaW5nLnNwbGl0KFwiXFxuXCIpLCBleHBlY3RlZFN0cmluZy5zcGxpdChcIlxcblwiKSk7XG4gICAgY29uc3QgZGlmZk1zZyA9IGJ1aWxkTWVzc2FnZShkaWZmUmVzdWx0LCB7IHN0cmluZ0RpZmYgfSkuam9pbihcIlxcblwiKTtcbiAgICBtZXNzYWdlID0gYFZhbHVlcyBhcmUgbm90IGVxdWFsOlxcbiR7ZGlmZk1zZ31gO1xuICB9IGNhdGNoIHtcbiAgICBtZXNzYWdlID0gYFxcbiR7cmVkKENBTl9OT1RfRElTUExBWSl9ICsgXFxuXFxuYDtcbiAgfVxuICBpZiAobXNnKSB7XG4gICAgbWVzc2FnZSA9IG1zZztcbiAgfVxuICB0aHJvdyBuZXcgQXNzZXJ0aW9uRXJyb3IobWVzc2FnZSk7XG59XG5cbi8qKlxuICogTWFrZSBhbiBhc3NlcnRpb24gdGhhdCBgYWN0dWFsYCBhbmQgYGV4cGVjdGVkYCBhcmUgbm90IGVxdWFsLCBkZWVwbHkuXG4gKiBJZiBub3QgdGhlbiB0aHJvdy5cbiAqXG4gKiBUeXBlIHBhcmFtZXRlciBjYW4gYmUgc3BlY2lmaWVkIHRvIGVuc3VyZSB2YWx1ZXMgdW5kZXIgY29tcGFyaXNvbiBoYXZlIHRoZSBzYW1lIHR5cGUuXG4gKiBGb3IgZXhhbXBsZTpcbiAqIGBgYHRzXG4gKiBpbXBvcnQgeyBhc3NlcnROb3RFcXVhbHMgfSBmcm9tIFwiLi9hc3NlcnRzLnRzXCI7XG4gKlxuICogYXNzZXJ0Tm90RXF1YWxzPG51bWJlcj4oMSwgMilcbiAqIGBgYFxuICovXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0Tm90RXF1YWxzPFQ+KGFjdHVhbDogVCwgZXhwZWN0ZWQ6IFQsIG1zZz86IHN0cmluZyk6IHZvaWQge1xuICBpZiAoIWVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQpKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGxldCBhY3R1YWxTdHJpbmc6IHN0cmluZztcbiAgbGV0IGV4cGVjdGVkU3RyaW5nOiBzdHJpbmc7XG4gIHRyeSB7XG4gICAgYWN0dWFsU3RyaW5nID0gU3RyaW5nKGFjdHVhbCk7XG4gIH0gY2F0Y2gge1xuICAgIGFjdHVhbFN0cmluZyA9IFwiW0Nhbm5vdCBkaXNwbGF5XVwiO1xuICB9XG4gIHRyeSB7XG4gICAgZXhwZWN0ZWRTdHJpbmcgPSBTdHJpbmcoZXhwZWN0ZWQpO1xuICB9IGNhdGNoIHtcbiAgICBleHBlY3RlZFN0cmluZyA9IFwiW0Nhbm5vdCBkaXNwbGF5XVwiO1xuICB9XG4gIGlmICghbXNnKSB7XG4gICAgbXNnID0gYGFjdHVhbDogJHthY3R1YWxTdHJpbmd9IGV4cGVjdGVkIG5vdCB0byBiZTogJHtleHBlY3RlZFN0cmluZ31gO1xuICB9XG4gIHRocm93IG5ldyBBc3NlcnRpb25FcnJvcihtc2cpO1xufVxuXG4vKipcbiAqIE1ha2UgYW4gYXNzZXJ0aW9uIHRoYXQgYGFjdHVhbGAgYW5kIGBleHBlY3RlZGAgYXJlIHN0cmljdGx5IGVxdWFsLiBJZlxuICogbm90IHRoZW4gdGhyb3cuXG4gKlxuICogYGBgdHNcbiAqIGltcG9ydCB7IGFzc2VydFN0cmljdEVxdWFscyB9IGZyb20gXCIuL2Fzc2VydHMudHNcIjtcbiAqXG4gKiBhc3NlcnRTdHJpY3RFcXVhbHMoMSwgMilcbiAqIGBgYFxuICovXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0U3RyaWN0RXF1YWxzPFQ+KFxuICBhY3R1YWw6IHVua25vd24sXG4gIGV4cGVjdGVkOiBULFxuICBtc2c/OiBzdHJpbmcsXG4pOiBhc3NlcnRzIGFjdHVhbCBpcyBUIHtcbiAgaWYgKE9iamVjdC5pcyhhY3R1YWwsIGV4cGVjdGVkKSkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGxldCBtZXNzYWdlOiBzdHJpbmc7XG5cbiAgaWYgKG1zZykge1xuICAgIG1lc3NhZ2UgPSBtc2c7XG4gIH0gZWxzZSB7XG4gICAgY29uc3QgYWN0dWFsU3RyaW5nID0gZm9ybWF0KGFjdHVhbCk7XG4gICAgY29uc3QgZXhwZWN0ZWRTdHJpbmcgPSBmb3JtYXQoZXhwZWN0ZWQpO1xuXG4gICAgaWYgKGFjdHVhbFN0cmluZyA9PT0gZXhwZWN0ZWRTdHJpbmcpIHtcbiAgICAgIGNvbnN0IHdpdGhPZmZzZXQgPSBhY3R1YWxTdHJpbmdcbiAgICAgICAgLnNwbGl0KFwiXFxuXCIpXG4gICAgICAgIC5tYXAoKGwpID0+IGAgICAgJHtsfWApXG4gICAgICAgIC5qb2luKFwiXFxuXCIpO1xuICAgICAgbWVzc2FnZSA9XG4gICAgICAgIGBWYWx1ZXMgaGF2ZSB0aGUgc2FtZSBzdHJ1Y3R1cmUgYnV0IGFyZSBub3QgcmVmZXJlbmNlLWVxdWFsOlxcblxcbiR7XG4gICAgICAgICAgcmVkKHdpdGhPZmZzZXQpXG4gICAgICAgIH1cXG5gO1xuICAgIH0gZWxzZSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBzdHJpbmdEaWZmID0gKHR5cGVvZiBhY3R1YWwgPT09IFwic3RyaW5nXCIpICYmXG4gICAgICAgICAgKHR5cGVvZiBleHBlY3RlZCA9PT0gXCJzdHJpbmdcIik7XG4gICAgICAgIGNvbnN0IGRpZmZSZXN1bHQgPSBzdHJpbmdEaWZmXG4gICAgICAgICAgPyBkaWZmc3RyKGFjdHVhbCBhcyBzdHJpbmcsIGV4cGVjdGVkIGFzIHN0cmluZylcbiAgICAgICAgICA6IGRpZmYoYWN0dWFsU3RyaW5nLnNwbGl0KFwiXFxuXCIpLCBleHBlY3RlZFN0cmluZy5zcGxpdChcIlxcblwiKSk7XG4gICAgICAgIGNvbnN0IGRpZmZNc2cgPSBidWlsZE1lc3NhZ2UoZGlmZlJlc3VsdCwgeyBzdHJpbmdEaWZmIH0pLmpvaW4oXCJcXG5cIik7XG4gICAgICAgIG1lc3NhZ2UgPSBgVmFsdWVzIGFyZSBub3Qgc3RyaWN0bHkgZXF1YWw6XFxuJHtkaWZmTXNnfWA7XG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgbWVzc2FnZSA9IGBcXG4ke3JlZChDQU5fTk9UX0RJU1BMQVkpfSArIFxcblxcbmA7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgdGhyb3cgbmV3IEFzc2VydGlvbkVycm9yKG1lc3NhZ2UpO1xufVxuXG4vKipcbiAqIE1ha2UgYW4gYXNzZXJ0aW9uIHRoYXQgYGFjdHVhbGAgYW5kIGBleHBlY3RlZGAgYXJlIG5vdCBzdHJpY3RseSBlcXVhbC5cbiAqIElmIHRoZSB2YWx1ZXMgYXJlIHN0cmljdGx5IGVxdWFsIHRoZW4gdGhyb3cuXG4gKlxuICogYGBgdHNcbiAqIGltcG9ydCB7IGFzc2VydE5vdFN0cmljdEVxdWFscyB9IGZyb20gXCIuL2Fzc2VydHMudHNcIjtcbiAqXG4gKiBhc3NlcnROb3RTdHJpY3RFcXVhbHMoMSwgMSlcbiAqIGBgYFxuICovXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0Tm90U3RyaWN0RXF1YWxzPFQ+KFxuICBhY3R1YWw6IFQsXG4gIGV4cGVjdGVkOiBULFxuICBtc2c/OiBzdHJpbmcsXG4pOiB2b2lkIHtcbiAgaWYgKCFPYmplY3QuaXMoYWN0dWFsLCBleHBlY3RlZCkpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICB0aHJvdyBuZXcgQXNzZXJ0aW9uRXJyb3IoXG4gICAgbXNnID8/IGBFeHBlY3RlZCBcImFjdHVhbFwiIHRvIGJlIHN0cmljdGx5IHVuZXF1YWwgdG86ICR7Zm9ybWF0KGFjdHVhbCl9XFxuYCxcbiAgKTtcbn1cblxuLyoqXG4gKiBNYWtlIGFuIGFzc2VydGlvbiB0aGF0IGBhY3R1YWxgIGFuZCBgZXhwZWN0ZWRgIGFyZSBhbG1vc3QgZXF1YWwgbnVtYmVycyB0aHJvdWdoXG4gKiBhIGdpdmVuIHRvbGVyYW5jZS4gSXQgY2FuIGJlIHVzZWQgdG8gdGFrZSBpbnRvIGFjY291bnQgSUVFRS03NTQgZG91YmxlLXByZWNpc2lvblxuICogZmxvYXRpbmctcG9pbnQgcmVwcmVzZW50YXRpb24gbGltaXRhdGlvbnMuXG4gKiBJZiB0aGUgdmFsdWVzIGFyZSBub3QgYWxtb3N0IGVxdWFsIHRoZW4gdGhyb3cuXG4gKlxuICogYGBgdHNcbiAqIGltcG9ydCB7IGFzc2VydEFsbW9zdEVxdWFscywgYXNzZXJ0VGhyb3dzIH0gZnJvbSBcIi4vYXNzZXJ0cy50c1wiO1xuICpcbiAqIGFzc2VydEFsbW9zdEVxdWFscygwLjEsIDAuMik7XG4gKlxuICogLy8gVXNpbmcgYSBjdXN0b20gdG9sZXJhbmNlIHZhbHVlXG4gKiBhc3NlcnRBbG1vc3RFcXVhbHMoMC4xICsgMC4yLCAwLjMsIDFlLTE2KTtcbiAqIGFzc2VydFRocm93cygoKSA9PiBhc3NlcnRBbG1vc3RFcXVhbHMoMC4xICsgMC4yLCAwLjMsIDFlLTE3KSk7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydEFsbW9zdEVxdWFscyhcbiAgYWN0dWFsOiBudW1iZXIsXG4gIGV4cGVjdGVkOiBudW1iZXIsXG4gIHRvbGVyYW5jZSA9IDFlLTcsXG4gIG1zZz86IHN0cmluZyxcbikge1xuICBpZiAoT2JqZWN0LmlzKGFjdHVhbCwgZXhwZWN0ZWQpKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGNvbnN0IGRlbHRhID0gTWF0aC5hYnMoZXhwZWN0ZWQgLSBhY3R1YWwpO1xuICBpZiAoZGVsdGEgPD0gdG9sZXJhbmNlKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGNvbnN0IGYgPSAobjogbnVtYmVyKSA9PiBOdW1iZXIuaXNJbnRlZ2VyKG4pID8gbiA6IG4udG9FeHBvbmVudGlhbCgpO1xuICB0aHJvdyBuZXcgQXNzZXJ0aW9uRXJyb3IoXG4gICAgbXNnID8/XG4gICAgICBgYWN0dWFsOiBcIiR7ZihhY3R1YWwpfVwiIGV4cGVjdGVkIHRvIGJlIGNsb3NlIHRvIFwiJHtmKGV4cGVjdGVkKX1cIjogXFxcbmRlbHRhIFwiJHtmKGRlbHRhKX1cIiBpcyBncmVhdGVyIHRoYW4gXCIke2YodG9sZXJhbmNlKX1cImAsXG4gICk7XG59XG5cbi8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG50eXBlIEFueUNvbnN0cnVjdG9yID0gbmV3ICguLi5hcmdzOiBhbnlbXSkgPT4gYW55O1xudHlwZSBHZXRDb25zdHJ1Y3RvclR5cGU8VCBleHRlbmRzIEFueUNvbnN0cnVjdG9yPiA9IFQgZXh0ZW5kcyAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxubmV3ICguLi5hcmdzOiBhbnkpID0+IGluZmVyIEMgPyBDXG4gIDogbmV2ZXI7XG5cbi8qKlxuICogTWFrZSBhbiBhc3NlcnRpb24gdGhhdCBgb2JqYCBpcyBhbiBpbnN0YW5jZSBvZiBgdHlwZWAuXG4gKiBJZiBub3QgdGhlbiB0aHJvdy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydEluc3RhbmNlT2Y8VCBleHRlbmRzIEFueUNvbnN0cnVjdG9yPihcbiAgYWN0dWFsOiB1bmtub3duLFxuICBleHBlY3RlZFR5cGU6IFQsXG4gIG1zZyA9IFwiXCIsXG4pOiBhc3NlcnRzIGFjdHVhbCBpcyBHZXRDb25zdHJ1Y3RvclR5cGU8VD4ge1xuICBpZiAoIW1zZykge1xuICAgIGNvbnN0IGV4cGVjdGVkVHlwZVN0ciA9IGV4cGVjdGVkVHlwZS5uYW1lO1xuXG4gICAgbGV0IGFjdHVhbFR5cGVTdHIgPSBcIlwiO1xuICAgIGlmIChhY3R1YWwgPT09IG51bGwpIHtcbiAgICAgIGFjdHVhbFR5cGVTdHIgPSBcIm51bGxcIjtcbiAgICB9IGVsc2UgaWYgKGFjdHVhbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBhY3R1YWxUeXBlU3RyID0gXCJ1bmRlZmluZWRcIjtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBhY3R1YWwgPT09IFwib2JqZWN0XCIpIHtcbiAgICAgIGFjdHVhbFR5cGVTdHIgPSBhY3R1YWwuY29uc3RydWN0b3I/Lm5hbWUgPz8gXCJPYmplY3RcIjtcbiAgICB9IGVsc2Uge1xuICAgICAgYWN0dWFsVHlwZVN0ciA9IHR5cGVvZiBhY3R1YWw7XG4gICAgfVxuXG4gICAgaWYgKGV4cGVjdGVkVHlwZVN0ciA9PSBhY3R1YWxUeXBlU3RyKSB7XG4gICAgICBtc2cgPSBgRXhwZWN0ZWQgb2JqZWN0IHRvIGJlIGFuIGluc3RhbmNlIG9mIFwiJHtleHBlY3RlZFR5cGVTdHJ9XCIuYDtcbiAgICB9IGVsc2UgaWYgKGFjdHVhbFR5cGVTdHIgPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICBtc2cgPVxuICAgICAgICBgRXhwZWN0ZWQgb2JqZWN0IHRvIGJlIGFuIGluc3RhbmNlIG9mIFwiJHtleHBlY3RlZFR5cGVTdHJ9XCIgYnV0IHdhcyBub3QgYW4gaW5zdGFuY2VkIG9iamVjdC5gO1xuICAgIH0gZWxzZSB7XG4gICAgICBtc2cgPVxuICAgICAgICBgRXhwZWN0ZWQgb2JqZWN0IHRvIGJlIGFuIGluc3RhbmNlIG9mIFwiJHtleHBlY3RlZFR5cGVTdHJ9XCIgYnV0IHdhcyBcIiR7YWN0dWFsVHlwZVN0cn1cIi5gO1xuICAgIH1cbiAgfVxuICBhc3NlcnQoYWN0dWFsIGluc3RhbmNlb2YgZXhwZWN0ZWRUeXBlLCBtc2cpO1xufVxuXG4vKipcbiAqIE1ha2UgYW4gYXNzZXJ0aW9uIHRoYXQgYWN0dWFsIGlzIG5vdCBudWxsIG9yIHVuZGVmaW5lZC5cbiAqIElmIG5vdCB0aGVuIHRocm93LlxuICovXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0RXhpc3RzPFQ+KFxuICBhY3R1YWw6IFQsXG4gIG1zZz86IHN0cmluZyxcbik6IGFzc2VydHMgYWN0dWFsIGlzIE5vbk51bGxhYmxlPFQ+IHtcbiAgaWYgKGFjdHVhbCA9PT0gdW5kZWZpbmVkIHx8IGFjdHVhbCA9PT0gbnVsbCkge1xuICAgIGlmICghbXNnKSB7XG4gICAgICBtc2cgPSBgYWN0dWFsOiBcIiR7YWN0dWFsfVwiIGV4cGVjdGVkIHRvIG5vdCBiZSBudWxsIG9yIHVuZGVmaW5lZGA7XG4gICAgfVxuICAgIHRocm93IG5ldyBBc3NlcnRpb25FcnJvcihtc2cpO1xuICB9XG59XG5cbi8qKlxuICogTWFrZSBhbiBhc3NlcnRpb24gdGhhdCBhY3R1YWwgaW5jbHVkZXMgZXhwZWN0ZWQuIElmIG5vdFxuICogdGhlbiB0aHJvdy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydFN0cmluZ0luY2x1ZGVzKFxuICBhY3R1YWw6IHN0cmluZyxcbiAgZXhwZWN0ZWQ6IHN0cmluZyxcbiAgbXNnPzogc3RyaW5nLFxuKTogdm9pZCB7XG4gIGlmICghYWN0dWFsLmluY2x1ZGVzKGV4cGVjdGVkKSkge1xuICAgIGlmICghbXNnKSB7XG4gICAgICBtc2cgPSBgYWN0dWFsOiBcIiR7YWN0dWFsfVwiIGV4cGVjdGVkIHRvIGNvbnRhaW46IFwiJHtleHBlY3RlZH1cImA7XG4gICAgfVxuICAgIHRocm93IG5ldyBBc3NlcnRpb25FcnJvcihtc2cpO1xuICB9XG59XG5cbi8qKlxuICogTWFrZSBhbiBhc3NlcnRpb24gdGhhdCBgYWN0dWFsYCBpbmNsdWRlcyB0aGUgYGV4cGVjdGVkYCB2YWx1ZXMuXG4gKiBJZiBub3QgdGhlbiBhbiBlcnJvciB3aWxsIGJlIHRocm93bi5cbiAqXG4gKiBUeXBlIHBhcmFtZXRlciBjYW4gYmUgc3BlY2lmaWVkIHRvIGVuc3VyZSB2YWx1ZXMgdW5kZXIgY29tcGFyaXNvbiBoYXZlIHRoZSBzYW1lIHR5cGUuXG4gKiBGb3IgZXhhbXBsZTpcbiAqXG4gKiBgYGB0c1xuICogaW1wb3J0IHsgYXNzZXJ0QXJyYXlJbmNsdWRlcyB9IGZyb20gXCIuL2Fzc2VydHMudHNcIjtcbiAqXG4gKiBhc3NlcnRBcnJheUluY2x1ZGVzPG51bWJlcj4oWzEsIDJdLCBbMl0pXG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydEFycmF5SW5jbHVkZXM8VD4oXG4gIGFjdHVhbDogQXJyYXlMaWtlPFQ+LFxuICBleHBlY3RlZDogQXJyYXlMaWtlPFQ+LFxuICBtc2c/OiBzdHJpbmcsXG4pOiB2b2lkIHtcbiAgY29uc3QgbWlzc2luZzogdW5rbm93bltdID0gW107XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgZXhwZWN0ZWQubGVuZ3RoOyBpKyspIHtcbiAgICBsZXQgZm91bmQgPSBmYWxzZTtcbiAgICBmb3IgKGxldCBqID0gMDsgaiA8IGFjdHVhbC5sZW5ndGg7IGorKykge1xuICAgICAgaWYgKGVxdWFsKGV4cGVjdGVkW2ldLCBhY3R1YWxbal0pKSB7XG4gICAgICAgIGZvdW5kID0gdHJ1ZTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICghZm91bmQpIHtcbiAgICAgIG1pc3NpbmcucHVzaChleHBlY3RlZFtpXSk7XG4gICAgfVxuICB9XG4gIGlmIChtaXNzaW5nLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAoIW1zZykge1xuICAgIG1zZyA9IGBhY3R1YWw6IFwiJHtmb3JtYXQoYWN0dWFsKX1cIiBleHBlY3RlZCB0byBpbmNsdWRlOiBcIiR7XG4gICAgICBmb3JtYXQoZXhwZWN0ZWQpXG4gICAgfVwiXFxubWlzc2luZzogJHtmb3JtYXQobWlzc2luZyl9YDtcbiAgfVxuICB0aHJvdyBuZXcgQXNzZXJ0aW9uRXJyb3IobXNnKTtcbn1cblxuLyoqXG4gKiBNYWtlIGFuIGFzc2VydGlvbiB0aGF0IGBhY3R1YWxgIG1hdGNoIFJlZ0V4cCBgZXhwZWN0ZWRgLiBJZiBub3RcbiAqIHRoZW4gdGhyb3cuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRNYXRjaChcbiAgYWN0dWFsOiBzdHJpbmcsXG4gIGV4cGVjdGVkOiBSZWdFeHAsXG4gIG1zZz86IHN0cmluZyxcbik6IHZvaWQge1xuICBpZiAoIWV4cGVjdGVkLnRlc3QoYWN0dWFsKSkge1xuICAgIGlmICghbXNnKSB7XG4gICAgICBtc2cgPSBgYWN0dWFsOiBcIiR7YWN0dWFsfVwiIGV4cGVjdGVkIHRvIG1hdGNoOiBcIiR7ZXhwZWN0ZWR9XCJgO1xuICAgIH1cbiAgICB0aHJvdyBuZXcgQXNzZXJ0aW9uRXJyb3IobXNnKTtcbiAgfVxufVxuXG4vKipcbiAqIE1ha2UgYW4gYXNzZXJ0aW9uIHRoYXQgYGFjdHVhbGAgbm90IG1hdGNoIFJlZ0V4cCBgZXhwZWN0ZWRgLiBJZiBtYXRjaFxuICogdGhlbiB0aHJvdy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydE5vdE1hdGNoKFxuICBhY3R1YWw6IHN0cmluZyxcbiAgZXhwZWN0ZWQ6IFJlZ0V4cCxcbiAgbXNnPzogc3RyaW5nLFxuKTogdm9pZCB7XG4gIGlmIChleHBlY3RlZC50ZXN0KGFjdHVhbCkpIHtcbiAgICBpZiAoIW1zZykge1xuICAgICAgbXNnID0gYGFjdHVhbDogXCIke2FjdHVhbH1cIiBleHBlY3RlZCB0byBub3QgbWF0Y2g6IFwiJHtleHBlY3RlZH1cImA7XG4gICAgfVxuICAgIHRocm93IG5ldyBBc3NlcnRpb25FcnJvcihtc2cpO1xuICB9XG59XG5cbi8qKlxuICogTWFrZSBhbiBhc3NlcnRpb24gdGhhdCBgYWN0dWFsYCBvYmplY3QgaXMgYSBzdWJzZXQgb2YgYGV4cGVjdGVkYCBvYmplY3QsIGRlZXBseS5cbiAqIElmIG5vdCwgdGhlbiB0aHJvdy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydE9iamVjdE1hdGNoKFxuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICBhY3R1YWw6IFJlY29yZDxQcm9wZXJ0eUtleSwgYW55PixcbiAgZXhwZWN0ZWQ6IFJlY29yZDxQcm9wZXJ0eUtleSwgdW5rbm93bj4sXG4pOiB2b2lkIHtcbiAgdHlwZSBsb29zZSA9IFJlY29yZDxQcm9wZXJ0eUtleSwgdW5rbm93bj47XG5cbiAgZnVuY3Rpb24gZmlsdGVyKGE6IGxvb3NlLCBiOiBsb29zZSkge1xuICAgIGNvbnN0IHNlZW4gPSBuZXcgV2Vha01hcCgpO1xuICAgIHJldHVybiBmbihhLCBiKTtcblxuICAgIGZ1bmN0aW9uIGZuKGE6IGxvb3NlLCBiOiBsb29zZSk6IGxvb3NlIHtcbiAgICAgIC8vIFByZXZlbnQgaW5maW5pdGUgbG9vcCB3aXRoIGNpcmN1bGFyIHJlZmVyZW5jZXMgd2l0aCBzYW1lIGZpbHRlclxuICAgICAgaWYgKChzZWVuLmhhcyhhKSkgJiYgKHNlZW4uZ2V0KGEpID09PSBiKSkge1xuICAgICAgICByZXR1cm4gYTtcbiAgICAgIH1cbiAgICAgIHNlZW4uc2V0KGEsIGIpO1xuICAgICAgLy8gRmlsdGVyIGtleXMgYW5kIHN5bWJvbHMgd2hpY2ggYXJlIHByZXNlbnQgaW4gYm90aCBhY3R1YWwgYW5kIGV4cGVjdGVkXG4gICAgICBjb25zdCBmaWx0ZXJlZCA9IHt9IGFzIGxvb3NlO1xuICAgICAgY29uc3QgZW50cmllcyA9IFtcbiAgICAgICAgLi4uT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMoYSksXG4gICAgICAgIC4uLk9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHMoYSksXG4gICAgICBdXG4gICAgICAgIC5maWx0ZXIoKGtleSkgPT4ga2V5IGluIGIpXG4gICAgICAgIC5tYXAoKGtleSkgPT4gW2tleSwgYVtrZXkgYXMgc3RyaW5nXV0pIGFzIEFycmF5PFtzdHJpbmcsIHVua25vd25dPjtcbiAgICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIGVudHJpZXMpIHtcbiAgICAgICAgLy8gT24gYXJyYXkgcmVmZXJlbmNlcywgYnVpbGQgYSBmaWx0ZXJlZCBhcnJheSBhbmQgZmlsdGVyIG5lc3RlZCBvYmplY3RzIGluc2lkZVxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICAgICAgICBjb25zdCBzdWJzZXQgPSAoYiBhcyBsb29zZSlba2V5XTtcbiAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShzdWJzZXQpKSB7XG4gICAgICAgICAgICBmaWx0ZXJlZFtrZXldID0gZm4oeyAuLi52YWx1ZSB9LCB7IC4uLnN1YnNldCB9KTtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgfSAvLyBPbiByZWdleHAgcmVmZXJlbmNlcywga2VlcCB2YWx1ZSBhcyBpdCB0byBhdm9pZCBsb29zaW5nIHBhdHRlcm4gYW5kIGZsYWdzXG4gICAgICAgIGVsc2UgaWYgKHZhbHVlIGluc3RhbmNlb2YgUmVnRXhwKSB7XG4gICAgICAgICAgZmlsdGVyZWRba2V5XSA9IHZhbHVlO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9IC8vIE9uIG5lc3RlZCBvYmplY3RzIHJlZmVyZW5jZXMsIGJ1aWxkIGEgZmlsdGVyZWQgb2JqZWN0IHJlY3Vyc2l2ZWx5XG4gICAgICAgIGVsc2UgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJvYmplY3RcIikge1xuICAgICAgICAgIGNvbnN0IHN1YnNldCA9IChiIGFzIGxvb3NlKVtrZXldO1xuICAgICAgICAgIGlmICgodHlwZW9mIHN1YnNldCA9PT0gXCJvYmplY3RcIikgJiYgKHN1YnNldCkpIHtcbiAgICAgICAgICAgIC8vIFdoZW4gYm90aCBvcGVyYW5kcyBhcmUgbWFwcywgYnVpbGQgYSBmaWx0ZXJlZCBtYXAgd2l0aCBjb21tb24ga2V5cyBhbmQgZmlsdGVyIG5lc3RlZCBvYmplY3RzIGluc2lkZVxuICAgICAgICAgICAgaWYgKCh2YWx1ZSBpbnN0YW5jZW9mIE1hcCkgJiYgKHN1YnNldCBpbnN0YW5jZW9mIE1hcCkpIHtcbiAgICAgICAgICAgICAgZmlsdGVyZWRba2V5XSA9IG5ldyBNYXAoXG4gICAgICAgICAgICAgICAgWy4uLnZhbHVlXS5maWx0ZXIoKFtrXSkgPT4gc3Vic2V0LmhhcyhrKSkubWFwKChcbiAgICAgICAgICAgICAgICAgIFtrLCB2XSxcbiAgICAgICAgICAgICAgICApID0+IFtrLCB0eXBlb2YgdiA9PT0gXCJvYmplY3RcIiA/IGZuKHYsIHN1YnNldC5nZXQoaykpIDogdl0pLFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIFdoZW4gYm90aCBvcGVyYW5kcyBhcmUgc2V0LCBidWlsZCBhIGZpbHRlcmVkIHNldCB3aXRoIGNvbW1vbiB2YWx1ZXNcbiAgICAgICAgICAgIGlmICgodmFsdWUgaW5zdGFuY2VvZiBTZXQpICYmIChzdWJzZXQgaW5zdGFuY2VvZiBTZXQpKSB7XG4gICAgICAgICAgICAgIGZpbHRlcmVkW2tleV0gPSBuZXcgU2V0KFsuLi52YWx1ZV0uZmlsdGVyKCh2KSA9PiBzdWJzZXQuaGFzKHYpKSk7XG4gICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZmlsdGVyZWRba2V5XSA9IGZuKHZhbHVlIGFzIGxvb3NlLCBzdWJzZXQgYXMgbG9vc2UpO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGZpbHRlcmVkW2tleV0gPSB2YWx1ZTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBmaWx0ZXJlZDtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGFzc2VydEVxdWFscyhcbiAgICAvLyBnZXQgdGhlIGludGVyc2VjdGlvbiBvZiBcImFjdHVhbFwiIGFuZCBcImV4cGVjdGVkXCJcbiAgICAvLyBzaWRlIGVmZmVjdDogYWxsIHRoZSBpbnN0YW5jZXMnIGNvbnN0cnVjdG9yIGZpZWxkIGlzIFwiT2JqZWN0XCIgbm93LlxuICAgIGZpbHRlcihhY3R1YWwsIGV4cGVjdGVkKSxcbiAgICAvLyBzZXQgKG5lc3RlZCkgaW5zdGFuY2VzJyBjb25zdHJ1Y3RvciBmaWVsZCB0byBiZSBcIk9iamVjdFwiIHdpdGhvdXQgY2hhbmdpbmcgZXhwZWN0ZWQgdmFsdWUuXG4gICAgLy8gc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9kZW5vbGFuZC9kZW5vX3N0ZC9wdWxsLzE0MTlcbiAgICBmaWx0ZXIoZXhwZWN0ZWQsIGV4cGVjdGVkKSxcbiAgKTtcbn1cblxuLyoqXG4gKiBGb3JjZWZ1bGx5IHRocm93cyBhIGZhaWxlZCBhc3NlcnRpb25cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGZhaWwobXNnPzogc3RyaW5nKTogbmV2ZXIge1xuICBhc3NlcnQoZmFsc2UsIGBGYWlsZWQgYXNzZXJ0aW9uJHttc2cgPyBgOiAke21zZ31gIDogXCIuXCJ9YCk7XG59XG5cbi8qKlxuICogTWFrZSBhbiBhc3NlcnRpb24gdGhhdCBgZXJyb3JgIGlzIGFuIGBFcnJvcmAuXG4gKiBJZiBub3QgdGhlbiBhbiBlcnJvciB3aWxsIGJlIHRocm93bi5cbiAqIEFuIGVycm9yIGNsYXNzIGFuZCBhIHN0cmluZyB0aGF0IHNob3VsZCBiZSBpbmNsdWRlZCBpbiB0aGVcbiAqIGVycm9yIG1lc3NhZ2UgY2FuIGFsc28gYmUgYXNzZXJ0ZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRJc0Vycm9yPEUgZXh0ZW5kcyBFcnJvciA9IEVycm9yPihcbiAgZXJyb3I6IHVua25vd24sXG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIEVycm9yQ2xhc3M/OiBuZXcgKC4uLmFyZ3M6IGFueVtdKSA9PiBFLFxuICBtc2dJbmNsdWRlcz86IHN0cmluZyxcbiAgbXNnPzogc3RyaW5nLFxuKTogYXNzZXJ0cyBlcnJvciBpcyBFIHtcbiAgaWYgKGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPT09IGZhbHNlKSB7XG4gICAgdGhyb3cgbmV3IEFzc2VydGlvbkVycm9yKGBFeHBlY3RlZCBcImVycm9yXCIgdG8gYmUgYW4gRXJyb3Igb2JqZWN0LmApO1xuICB9XG4gIGlmIChFcnJvckNsYXNzICYmICEoZXJyb3IgaW5zdGFuY2VvZiBFcnJvckNsYXNzKSkge1xuICAgIG1zZyA9IGBFeHBlY3RlZCBlcnJvciB0byBiZSBpbnN0YW5jZSBvZiBcIiR7RXJyb3JDbGFzcy5uYW1lfVwiLCBidXQgd2FzIFwiJHtcbiAgICAgIHR5cGVvZiBlcnJvciA9PT0gXCJvYmplY3RcIiA/IGVycm9yPy5jb25zdHJ1Y3Rvcj8ubmFtZSA6IFwiW25vdCBhbiBvYmplY3RdXCJcbiAgICB9XCIke21zZyA/IGA6ICR7bXNnfWAgOiBcIi5cIn1gO1xuICAgIHRocm93IG5ldyBBc3NlcnRpb25FcnJvcihtc2cpO1xuICB9XG4gIGlmIChcbiAgICBtc2dJbmNsdWRlcyAmJiAoIShlcnJvciBpbnN0YW5jZW9mIEVycm9yKSB8fFxuICAgICAgIXN0cmlwQ29sb3IoZXJyb3IubWVzc2FnZSkuaW5jbHVkZXMoc3RyaXBDb2xvcihtc2dJbmNsdWRlcykpKVxuICApIHtcbiAgICBtc2cgPSBgRXhwZWN0ZWQgZXJyb3IgbWVzc2FnZSB0byBpbmNsdWRlIFwiJHttc2dJbmNsdWRlc31cIiwgYnV0IGdvdCBcIiR7XG4gICAgICBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFwiW25vdCBhbiBFcnJvcl1cIlxuICAgIH1cIiR7bXNnID8gYDogJHttc2d9YCA6IFwiLlwifWA7XG4gICAgdGhyb3cgbmV3IEFzc2VydGlvbkVycm9yKG1zZyk7XG4gIH1cbn1cblxuLyoqIEV4ZWN1dGVzIGEgZnVuY3Rpb24sIGV4cGVjdGluZyBpdCB0byB0aHJvdy4gSWYgaXQgZG9lcyBub3QsIHRoZW4gaXRcbiAqIHRocm93cy4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRUaHJvd3MoXG4gIGZuOiAoKSA9PiB1bmtub3duLFxuICBtc2c/OiBzdHJpbmcsXG4pOiB1bmtub3duO1xuLyoqIEV4ZWN1dGVzIGEgZnVuY3Rpb24sIGV4cGVjdGluZyBpdCB0byB0aHJvdy4gSWYgaXQgZG9lcyBub3QsIHRoZW4gaXRcbiAqIHRocm93cy4gQW4gZXJyb3IgY2xhc3MgYW5kIGEgc3RyaW5nIHRoYXQgc2hvdWxkIGJlIGluY2x1ZGVkIGluIHRoZVxuICogZXJyb3IgbWVzc2FnZSBjYW4gYWxzbyBiZSBhc3NlcnRlZC4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRUaHJvd3M8RSBleHRlbmRzIEVycm9yID0gRXJyb3I+KFxuICBmbjogKCkgPT4gdW5rbm93bixcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgRXJyb3JDbGFzczogbmV3ICguLi5hcmdzOiBhbnlbXSkgPT4gRSxcbiAgbXNnSW5jbHVkZXM/OiBzdHJpbmcsXG4gIG1zZz86IHN0cmluZyxcbik6IEU7XG4vKiogQGRlcHJlY2F0ZWQgVXNlIGFzc2VydFRocm93cyhmbiwgbXNnKSBpbnN0ZWFkLCB3aGljaCBub3cgcmV0dXJucyB0aHJvd25cbiAqIHZhbHVlIGFuZCB5b3UgY2FuIGFzc2VydCBvbiBpdC4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRUaHJvd3MoXG4gIGZuOiAoKSA9PiB1bmtub3duLFxuICBlcnJvckNhbGxiYWNrOiAoZTogRXJyb3IpID0+IHVua25vd24sXG4gIG1zZz86IHN0cmluZyxcbik6IEVycm9yO1xuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydFRocm93czxFIGV4dGVuZHMgRXJyb3IgPSBFcnJvcj4oXG4gIGZuOiAoKSA9PiB1bmtub3duLFxuICBlcnJvckNsYXNzT3JDYWxsYmFja09yTXNnPzpcbiAgICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICAgIHwgKG5ldyAoLi4uYXJnczogYW55W10pID0+IEUpXG4gICAgfCAoKGU6IEVycm9yKSA9PiB1bmtub3duKVxuICAgIHwgc3RyaW5nLFxuICBtc2dJbmNsdWRlc09yTXNnPzogc3RyaW5nLFxuICBtc2c/OiBzdHJpbmcsXG4pOiBFIHwgRXJyb3IgfCB1bmtub3duIHtcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgbGV0IEVycm9yQ2xhc3M6IChuZXcgKC4uLmFyZ3M6IGFueVtdKSA9PiBFKSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcbiAgbGV0IG1zZ0luY2x1ZGVzOiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG4gIGxldCBlcnJvckNhbGxiYWNrOiAoKGU6IEVycm9yKSA9PiB1bmtub3duKSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcbiAgbGV0IGVycjtcblxuICBpZiAodHlwZW9mIGVycm9yQ2xhc3NPckNhbGxiYWNrT3JNc2cgIT09IFwic3RyaW5nXCIpIHtcbiAgICBpZiAoXG4gICAgICBlcnJvckNsYXNzT3JDYWxsYmFja09yTXNnID09PSB1bmRlZmluZWQgfHxcbiAgICAgIGVycm9yQ2xhc3NPckNhbGxiYWNrT3JNc2cucHJvdG90eXBlIGluc3RhbmNlb2YgRXJyb3IgfHxcbiAgICAgIGVycm9yQ2xhc3NPckNhbGxiYWNrT3JNc2cucHJvdG90eXBlID09PSBFcnJvci5wcm90b3R5cGVcbiAgICApIHtcbiAgICAgIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gICAgICBFcnJvckNsYXNzID0gZXJyb3JDbGFzc09yQ2FsbGJhY2tPck1zZyBhcyBuZXcgKC4uLmFyZ3M6IGFueVtdKSA9PiBFO1xuICAgICAgbXNnSW5jbHVkZXMgPSBtc2dJbmNsdWRlc09yTXNnO1xuICAgIH0gZWxzZSB7XG4gICAgICBlcnJvckNhbGxiYWNrID0gZXJyb3JDbGFzc09yQ2FsbGJhY2tPck1zZyBhcyAoZTogRXJyb3IpID0+IHVua25vd247XG4gICAgICBtc2cgPSBtc2dJbmNsdWRlc09yTXNnO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBtc2cgPSBlcnJvckNsYXNzT3JDYWxsYmFja09yTXNnO1xuICB9XG4gIGxldCBkb2VzVGhyb3cgPSBmYWxzZTtcbiAgY29uc3QgbXNnVG9BcHBlbmRUb0Vycm9yID0gbXNnID8gYDogJHttc2d9YCA6IFwiLlwiO1xuICB0cnkge1xuICAgIGZuKCk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgaWYgKEVycm9yQ2xhc3MgfHwgZXJyb3JDYWxsYmFjaykge1xuICAgICAgaWYgKGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPT09IGZhbHNlKSB7XG4gICAgICAgIHRocm93IG5ldyBBc3NlcnRpb25FcnJvcihcIkEgbm9uLUVycm9yIG9iamVjdCB3YXMgdGhyb3duLlwiKTtcbiAgICAgIH1cbiAgICAgIGFzc2VydElzRXJyb3IoXG4gICAgICAgIGVycm9yLFxuICAgICAgICBFcnJvckNsYXNzLFxuICAgICAgICBtc2dJbmNsdWRlcyxcbiAgICAgICAgbXNnLFxuICAgICAgKTtcbiAgICAgIGlmICh0eXBlb2YgZXJyb3JDYWxsYmFjayA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgIGVycm9yQ2FsbGJhY2soZXJyb3IpO1xuICAgICAgfVxuICAgIH1cbiAgICBlcnIgPSBlcnJvcjtcbiAgICBkb2VzVGhyb3cgPSB0cnVlO1xuICB9XG4gIGlmICghZG9lc1Rocm93KSB7XG4gICAgbXNnID0gYEV4cGVjdGVkIGZ1bmN0aW9uIHRvIHRocm93JHttc2dUb0FwcGVuZFRvRXJyb3J9YDtcbiAgICB0aHJvdyBuZXcgQXNzZXJ0aW9uRXJyb3IobXNnKTtcbiAgfVxuICByZXR1cm4gZXJyO1xufVxuXG4vKiogRXhlY3V0ZXMgYSBmdW5jdGlvbiB3aGljaCByZXR1cm5zIGEgcHJvbWlzZSwgZXhwZWN0aW5nIGl0IHRvIHJlamVjdC4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRSZWplY3RzKFxuICBmbjogKCkgPT4gUHJvbWlzZUxpa2U8dW5rbm93bj4sXG4gIG1zZz86IHN0cmluZyxcbik6IFByb21pc2U8dW5rbm93bj47XG4vKiogRXhlY3V0ZXMgYSBmdW5jdGlvbiB3aGljaCByZXR1cm5zIGEgcHJvbWlzZSwgZXhwZWN0aW5nIGl0IHRvIHJlamVjdC5cbiAqIElmIGl0IGRvZXMgbm90LCB0aGVuIGl0IHRocm93cy4gQW4gZXJyb3IgY2xhc3MgYW5kIGEgc3RyaW5nIHRoYXQgc2hvdWxkIGJlXG4gKiBpbmNsdWRlZCBpbiB0aGUgZXJyb3IgbWVzc2FnZSBjYW4gYWxzbyBiZSBhc3NlcnRlZC4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRSZWplY3RzPEUgZXh0ZW5kcyBFcnJvciA9IEVycm9yPihcbiAgZm46ICgpID0+IFByb21pc2VMaWtlPHVua25vd24+LFxuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICBFcnJvckNsYXNzOiBuZXcgKC4uLmFyZ3M6IGFueVtdKSA9PiBFLFxuICBtc2dJbmNsdWRlcz86IHN0cmluZyxcbiAgbXNnPzogc3RyaW5nLFxuKTogUHJvbWlzZTxFPjtcbi8qKiBAZGVwcmVjYXRlZCBVc2UgYXNzZXJ0UmVqZWN0cyhmbiwgbXNnKSBpbnN0ZWFkLCB3aGljaCBub3cgcmV0dXJucyByZWplY3RlZCB2YWx1ZVxuICogYW5kIHlvdSBjYW4gYXNzZXJ0IG9uIGl0LiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydFJlamVjdHMoXG4gIGZuOiAoKSA9PiBQcm9taXNlTGlrZTx1bmtub3duPixcbiAgZXJyb3JDYWxsYmFjazogKGU6IEVycm9yKSA9PiB1bmtub3duLFxuICBtc2c/OiBzdHJpbmcsXG4pOiBQcm9taXNlPEVycm9yPjtcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBhc3NlcnRSZWplY3RzPEUgZXh0ZW5kcyBFcnJvciA9IEVycm9yPihcbiAgZm46ICgpID0+IFByb21pc2VMaWtlPHVua25vd24+LFxuICBlcnJvckNsYXNzT3JDYWxsYmFja09yTXNnPzpcbiAgICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICAgIHwgKG5ldyAoLi4uYXJnczogYW55W10pID0+IEUpXG4gICAgfCAoKGU6IEVycm9yKSA9PiB1bmtub3duKVxuICAgIHwgc3RyaW5nLFxuICBtc2dJbmNsdWRlc09yTXNnPzogc3RyaW5nLFxuICBtc2c/OiBzdHJpbmcsXG4pOiBQcm9taXNlPEUgfCBFcnJvciB8IHVua25vd24+IHtcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgbGV0IEVycm9yQ2xhc3M6IChuZXcgKC4uLmFyZ3M6IGFueVtdKSA9PiBFKSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcbiAgbGV0IG1zZ0luY2x1ZGVzOiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG4gIGxldCBlcnJvckNhbGxiYWNrOiAoKGU6IEVycm9yKSA9PiB1bmtub3duKSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcbiAgbGV0IGVycjtcblxuICBpZiAodHlwZW9mIGVycm9yQ2xhc3NPckNhbGxiYWNrT3JNc2cgIT09IFwic3RyaW5nXCIpIHtcbiAgICBpZiAoXG4gICAgICBlcnJvckNsYXNzT3JDYWxsYmFja09yTXNnID09PSB1bmRlZmluZWQgfHxcbiAgICAgIGVycm9yQ2xhc3NPckNhbGxiYWNrT3JNc2cucHJvdG90eXBlIGluc3RhbmNlb2YgRXJyb3IgfHxcbiAgICAgIGVycm9yQ2xhc3NPckNhbGxiYWNrT3JNc2cucHJvdG90eXBlID09PSBFcnJvci5wcm90b3R5cGVcbiAgICApIHtcbiAgICAgIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gICAgICBFcnJvckNsYXNzID0gZXJyb3JDbGFzc09yQ2FsbGJhY2tPck1zZyBhcyBuZXcgKC4uLmFyZ3M6IGFueVtdKSA9PiBFO1xuICAgICAgbXNnSW5jbHVkZXMgPSBtc2dJbmNsdWRlc09yTXNnO1xuICAgIH0gZWxzZSB7XG4gICAgICBlcnJvckNhbGxiYWNrID0gZXJyb3JDbGFzc09yQ2FsbGJhY2tPck1zZyBhcyAoZTogRXJyb3IpID0+IHVua25vd247XG4gICAgICBtc2cgPSBtc2dJbmNsdWRlc09yTXNnO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBtc2cgPSBlcnJvckNsYXNzT3JDYWxsYmFja09yTXNnO1xuICB9XG4gIGxldCBkb2VzVGhyb3cgPSBmYWxzZTtcbiAgbGV0IGlzUHJvbWlzZVJldHVybmVkID0gZmFsc2U7XG4gIGNvbnN0IG1zZ1RvQXBwZW5kVG9FcnJvciA9IG1zZyA/IGA6ICR7bXNnfWAgOiBcIi5cIjtcbiAgdHJ5IHtcbiAgICBjb25zdCBwb3NzaWJsZVByb21pc2UgPSBmbigpO1xuICAgIGlmIChcbiAgICAgIHBvc3NpYmxlUHJvbWlzZSAmJlxuICAgICAgdHlwZW9mIHBvc3NpYmxlUHJvbWlzZSA9PT0gXCJvYmplY3RcIiAmJlxuICAgICAgdHlwZW9mIHBvc3NpYmxlUHJvbWlzZS50aGVuID09PSBcImZ1bmN0aW9uXCJcbiAgICApIHtcbiAgICAgIGlzUHJvbWlzZVJldHVybmVkID0gdHJ1ZTtcbiAgICAgIGF3YWl0IHBvc3NpYmxlUHJvbWlzZTtcbiAgICB9XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgaWYgKCFpc1Byb21pc2VSZXR1cm5lZCkge1xuICAgICAgdGhyb3cgbmV3IEFzc2VydGlvbkVycm9yKFxuICAgICAgICBgRnVuY3Rpb24gdGhyb3dzIHdoZW4gZXhwZWN0ZWQgdG8gcmVqZWN0JHttc2dUb0FwcGVuZFRvRXJyb3J9YCxcbiAgICAgICk7XG4gICAgfVxuICAgIGlmIChFcnJvckNsYXNzIHx8IGVycm9yQ2FsbGJhY2spIHtcbiAgICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIEVycm9yID09PSBmYWxzZSkge1xuICAgICAgICB0aHJvdyBuZXcgQXNzZXJ0aW9uRXJyb3IoXCJBIG5vbi1FcnJvciBvYmplY3Qgd2FzIHJlamVjdGVkLlwiKTtcbiAgICAgIH1cbiAgICAgIGFzc2VydElzRXJyb3IoXG4gICAgICAgIGVycm9yLFxuICAgICAgICBFcnJvckNsYXNzLFxuICAgICAgICBtc2dJbmNsdWRlcyxcbiAgICAgICAgbXNnLFxuICAgICAgKTtcbiAgICAgIGlmICh0eXBlb2YgZXJyb3JDYWxsYmFjayA9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgZXJyb3JDYWxsYmFjayhlcnJvcik7XG4gICAgICB9XG4gICAgfVxuICAgIGVyciA9IGVycm9yO1xuICAgIGRvZXNUaHJvdyA9IHRydWU7XG4gIH1cbiAgaWYgKCFkb2VzVGhyb3cpIHtcbiAgICB0aHJvdyBuZXcgQXNzZXJ0aW9uRXJyb3IoXG4gICAgICBgRXhwZWN0ZWQgZnVuY3Rpb24gdG8gcmVqZWN0JHttc2dUb0FwcGVuZFRvRXJyb3J9YCxcbiAgICApO1xuICB9XG4gIHJldHVybiBlcnI7XG59XG5cbi8qKiBVc2UgdGhpcyB0byBzdHViIG91dCBtZXRob2RzIHRoYXQgd2lsbCB0aHJvdyB3aGVuIGludm9rZWQuICovXG5leHBvcnQgZnVuY3Rpb24gdW5pbXBsZW1lbnRlZChtc2c/OiBzdHJpbmcpOiBuZXZlciB7XG4gIHRocm93IG5ldyBBc3NlcnRpb25FcnJvcihtc2cgfHwgXCJ1bmltcGxlbWVudGVkXCIpO1xufVxuXG4vKiogVXNlIHRoaXMgdG8gYXNzZXJ0IHVucmVhY2hhYmxlIGNvZGUuICovXG5leHBvcnQgZnVuY3Rpb24gdW5yZWFjaGFibGUoKTogbmV2ZXIge1xuICB0aHJvdyBuZXcgQXNzZXJ0aW9uRXJyb3IoXCJ1bnJlYWNoYWJsZVwiKTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwRUFBMEU7QUFDMUUsOEVBQThFO0FBQzlFLDJDQUEyQztBQUUzQyxTQUFTLEdBQUcsRUFBRSxVQUFVLFFBQVEsbUJBQW1CO0FBQ25ELFNBQVMsWUFBWSxFQUFFLElBQUksRUFBRSxPQUFPLFFBQVEsYUFBYTtBQUN6RCxTQUFTLE1BQU0sUUFBUSxlQUFlO0FBRXRDLE1BQU0sa0JBQWtCO0FBRXhCLE9BQU8sTUFBTSx1QkFBdUI7RUFDekIsT0FBTyxpQkFBaUI7RUFDakMsWUFBWSxPQUFlLENBQUU7SUFDM0IsS0FBSyxDQUFDO0VBQ1I7QUFDRjtBQUVBLFNBQVMsa0JBQWtCLENBQVU7RUFDbkMsT0FBTztJQUFDLE9BQU8sUUFBUTtJQUFFO0dBQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFNLEtBQU07QUFDdEQ7QUFFQTs7OztDQUlDLEdBQ0QsT0FBTyxTQUFTLE1BQU0sQ0FBVSxFQUFFLENBQVU7RUFDMUMsTUFBTSxPQUFPLElBQUk7RUFDakIsT0FBTyxBQUFDLFNBQVMsUUFBUSxDQUFVLEVBQUUsQ0FBVTtJQUM3QyxxREFBcUQ7SUFDckQsbUNBQW1DO0lBQ25DLElBQ0UsS0FDQSxLQUNBLENBQUMsQUFBQyxhQUFhLFVBQVUsYUFBYSxVQUNuQyxhQUFhLE9BQU8sYUFBYSxHQUFJLEdBQ3hDO01BQ0EsT0FBTyxPQUFPLE9BQU8sT0FBTztJQUM5QjtJQUNBLElBQUksYUFBYSxRQUFRLGFBQWEsTUFBTTtNQUMxQyxNQUFNLFFBQVEsRUFBRSxPQUFPO01BQ3ZCLE1BQU0sUUFBUSxFQUFFLE9BQU87TUFDdkIsbURBQW1EO01BQ25ELG1CQUFtQjtNQUNuQixJQUFJLE9BQU8sS0FBSyxDQUFDLFVBQVUsT0FBTyxLQUFLLENBQUMsUUFBUTtRQUM5QyxPQUFPO01BQ1Q7TUFDQSxPQUFPLFVBQVU7SUFD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
// denoCacheMetadata=1374932950557945197,8261251729933853211