/**
 * Checks if a given value is a plain object.
 *
 * @param {object} value - The value to check.
 * @returns {value is Record<PropertyKey, any>} - True if the value is a plain object, otherwise false.
 *
 * @example
 * ```typescript
 * // ✅👇 True
 *
 * isPlainObject({ });                       // ✅
 * isPlainObject({ key: 'value' });          // ✅
 * isPlainObject({ key: new Date() });       // ✅
 * isPlainObject(new Object());              // ✅
 * isPlainObject(Object.create(null));       // ✅
 * isPlainObject({ nested: { key: true} });  // ✅
 * isPlainObject(new Proxy({}, {}));         // ✅
 * isPlainObject({ [Symbol('tag')]: 'A' });  // ✅
 *
 * // ✅👇 (cross-realms, node context, workers, ...)
 * const runInNewContext = await import('node:vm').then(
 *     (mod) => mod.runInNewContext
 * );
 * isPlainObject(runInNewContext('({})'));   // ✅
 *
 * // ❌👇 False
 *
 * class Test { };
 * isPlainObject(new Test())           // ❌
 * isPlainObject(10);                  // ❌
 * isPlainObject(null);                // ❌
 * isPlainObject('hello');             // ❌
 * isPlainObject([]);                  // ❌
 * isPlainObject(new Date());          // ❌
 * isPlainObject(new Uint8Array([1])); // ❌
 * isPlainObject(Buffer.from('ABC'));  // ❌
 * isPlainObject(Promise.resolve({})); // ❌
 * isPlainObject(Object.create({}));   // ❌
 * isPlainObject(new (class Cls {}));  // ❌
 * isPlainObject(globalThis);          // ❌,
 * ```
 */ export function isPlainObject(value) {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  const hasObjectPrototype = proto === null || proto === Object.prototype || // Required to support node:vm.runInNewContext({})
  Object.getPrototypeOf(proto) === null;
  if (!hasObjectPrototype) {
    return false;
  }
  return Object.prototype.toString.call(value) === '[object Object]';
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9wcmVkaWNhdGUvaXNQbGFpbk9iamVjdC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIENoZWNrcyBpZiBhIGdpdmVuIHZhbHVlIGlzIGEgcGxhaW4gb2JqZWN0LlxuICpcbiAqIEBwYXJhbSB7b2JqZWN0fSB2YWx1ZSAtIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHt2YWx1ZSBpcyBSZWNvcmQ8UHJvcGVydHlLZXksIGFueT59IC0gVHJ1ZSBpZiB0aGUgdmFsdWUgaXMgYSBwbGFpbiBvYmplY3QsIG90aGVyd2lzZSBmYWxzZS5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogLy8g4pyF8J+RhyBUcnVlXG4gKlxuICogaXNQbGFpbk9iamVjdCh7IH0pOyAgICAgICAgICAgICAgICAgICAgICAgLy8g4pyFXG4gKiBpc1BsYWluT2JqZWN0KHsga2V5OiAndmFsdWUnIH0pOyAgICAgICAgICAvLyDinIVcbiAqIGlzUGxhaW5PYmplY3QoeyBrZXk6IG5ldyBEYXRlKCkgfSk7ICAgICAgIC8vIOKchVxuICogaXNQbGFpbk9iamVjdChuZXcgT2JqZWN0KCkpOyAgICAgICAgICAgICAgLy8g4pyFXG4gKiBpc1BsYWluT2JqZWN0KE9iamVjdC5jcmVhdGUobnVsbCkpOyAgICAgICAvLyDinIVcbiAqIGlzUGxhaW5PYmplY3QoeyBuZXN0ZWQ6IHsga2V5OiB0cnVlfSB9KTsgIC8vIOKchVxuICogaXNQbGFpbk9iamVjdChuZXcgUHJveHkoe30sIHt9KSk7ICAgICAgICAgLy8g4pyFXG4gKiBpc1BsYWluT2JqZWN0KHsgW1N5bWJvbCgndGFnJyldOiAnQScgfSk7ICAvLyDinIVcbiAqXG4gKiAvLyDinIXwn5GHIChjcm9zcy1yZWFsbXMsIG5vZGUgY29udGV4dCwgd29ya2VycywgLi4uKVxuICogY29uc3QgcnVuSW5OZXdDb250ZXh0ID0gYXdhaXQgaW1wb3J0KCdub2RlOnZtJykudGhlbihcbiAqICAgICAobW9kKSA9PiBtb2QucnVuSW5OZXdDb250ZXh0XG4gKiApO1xuICogaXNQbGFpbk9iamVjdChydW5Jbk5ld0NvbnRleHQoJyh7fSknKSk7ICAgLy8g4pyFXG4gKlxuICogLy8g4p2M8J+RhyBGYWxzZVxuICpcbiAqIGNsYXNzIFRlc3QgeyB9O1xuICogaXNQbGFpbk9iamVjdChuZXcgVGVzdCgpKSAgICAgICAgICAgLy8g4p2MXG4gKiBpc1BsYWluT2JqZWN0KDEwKTsgICAgICAgICAgICAgICAgICAvLyDinYxcbiAqIGlzUGxhaW5PYmplY3QobnVsbCk7ICAgICAgICAgICAgICAgIC8vIOKdjFxuICogaXNQbGFpbk9iamVjdCgnaGVsbG8nKTsgICAgICAgICAgICAgLy8g4p2MXG4gKiBpc1BsYWluT2JqZWN0KFtdKTsgICAgICAgICAgICAgICAgICAvLyDinYxcbiAqIGlzUGxhaW5PYmplY3QobmV3IERhdGUoKSk7ICAgICAgICAgIC8vIOKdjFxuICogaXNQbGFpbk9iamVjdChuZXcgVWludDhBcnJheShbMV0pKTsgLy8g4p2MXG4gKiBpc1BsYWluT2JqZWN0KEJ1ZmZlci5mcm9tKCdBQkMnKSk7ICAvLyDinYxcbiAqIGlzUGxhaW5PYmplY3QoUHJvbWlzZS5yZXNvbHZlKHt9KSk7IC8vIOKdjFxuICogaXNQbGFpbk9iamVjdChPYmplY3QuY3JlYXRlKHt9KSk7ICAgLy8g4p2MXG4gKiBpc1BsYWluT2JqZWN0KG5ldyAoY2xhc3MgQ2xzIHt9KSk7ICAvLyDinYxcbiAqIGlzUGxhaW5PYmplY3QoZ2xvYmFsVGhpcyk7ICAgICAgICAgIC8vIOKdjCxcbiAqIGBgYFxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNQbGFpbk9iamVjdCh2YWx1ZTogdW5rbm93bik6IHZhbHVlIGlzIFJlY29yZDxQcm9wZXJ0eUtleSwgYW55PiB7XG4gIGlmICghdmFsdWUgfHwgdHlwZW9mIHZhbHVlICE9PSAnb2JqZWN0Jykge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGNvbnN0IHByb3RvID0gT2JqZWN0LmdldFByb3RvdHlwZU9mKHZhbHVlKSBhcyB0eXBlb2YgT2JqZWN0LnByb3RvdHlwZSB8IG51bGw7XG5cbiAgY29uc3QgaGFzT2JqZWN0UHJvdG90eXBlID1cbiAgICBwcm90byA9PT0gbnVsbCB8fFxuICAgIHByb3RvID09PSBPYmplY3QucHJvdG90eXBlIHx8XG4gICAgLy8gUmVxdWlyZWQgdG8gc3VwcG9ydCBub2RlOnZtLnJ1bkluTmV3Q29udGV4dCh7fSlcbiAgICBPYmplY3QuZ2V0UHJvdG90eXBlT2YocHJvdG8pID09PSBudWxsO1xuXG4gIGlmICghaGFzT2JqZWN0UHJvdG90eXBlKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh2YWx1ZSkgPT09ICdbb2JqZWN0IE9iamVjdF0nO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQXlDQyxHQUNELE9BQU8sU0FBUyxjQUFjLEtBQWM7RUFDMUMsSUFBSSxDQUFDLFNBQVMsT0FBTyxVQUFVLFVBQVU7SUFDdkMsT0FBTztFQUNUO0VBRUEsTUFBTSxRQUFRLE9BQU8sY0FBYyxDQUFDO0VBRXBDLE1BQU0scUJBQ0osVUFBVSxRQUNWLFVBQVUsT0FBTyxTQUFTLElBQzFCLGtEQUFrRDtFQUNsRCxPQUFPLGNBQWMsQ0FBQyxXQUFXO0VBRW5DLElBQUksQ0FBQyxvQkFBb0I7SUFDdkIsT0FBTztFQUNUO0VBRUEsT0FBTyxPQUFPLFNBQVMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFdBQVc7QUFDbkQifQ==
// denoCacheMetadata=16180482259360331661,113551790138181550