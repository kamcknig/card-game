import { keysIn } from '../object/keysIn.ts';
/**
 * Converts value to a plain object flattening inherited enumerable string keyed properties of value to own properties of the plain object.
 *
 * @param {any} value The value to convert.
 * @returns {Record<string, any>} Returns the converted plain object.
 *
 * @example
 * function Foo() {
 *   this.b = 2;
 * }
 * Foo.prototype.c = 3;
 * toPlainObject(new Foo()); // { b: 2, c: 3 }
 */ export function toPlainObject(value) {
  const plainObject = {};
  const valueKeys = keysIn(value);
  for(let i = 0; i < valueKeys.length; i++){
    const key = valueKeys[i];
    const objValue = value[key];
    if (key === '__proto__') {
      Object.defineProperty(plainObject, key, {
        configurable: true,
        enumerable: true,
        value: objValue,
        writable: true
      });
    } else {
      plainObject[key] = objValue;
    }
  }
  return plainObject;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvdXRpbC90b1BsYWluT2JqZWN0LnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGtleXNJbiB9IGZyb20gJy4uL29iamVjdC9rZXlzSW4udHMnO1xuXG4vKipcbiAqIENvbnZlcnRzIHZhbHVlIHRvIGEgcGxhaW4gb2JqZWN0IGZsYXR0ZW5pbmcgaW5oZXJpdGVkIGVudW1lcmFibGUgc3RyaW5nIGtleWVkIHByb3BlcnRpZXMgb2YgdmFsdWUgdG8gb3duIHByb3BlcnRpZXMgb2YgdGhlIHBsYWluIG9iamVjdC5cbiAqXG4gKiBAcGFyYW0ge2FueX0gdmFsdWUgVGhlIHZhbHVlIHRvIGNvbnZlcnQuXG4gKiBAcmV0dXJucyB7UmVjb3JkPHN0cmluZywgYW55Pn0gUmV0dXJucyB0aGUgY29udmVydGVkIHBsYWluIG9iamVjdC5cbiAqXG4gKiBAZXhhbXBsZVxuICogZnVuY3Rpb24gRm9vKCkge1xuICogICB0aGlzLmIgPSAyO1xuICogfVxuICogRm9vLnByb3RvdHlwZS5jID0gMztcbiAqIHRvUGxhaW5PYmplY3QobmV3IEZvbygpKTsgLy8geyBiOiAyLCBjOiAzIH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRvUGxhaW5PYmplY3QodmFsdWU6IGFueSk6IFJlY29yZDxzdHJpbmcsIGFueT4ge1xuICBjb25zdCBwbGFpbk9iamVjdDogUmVjb3JkPHN0cmluZywgYW55PiA9IHt9O1xuICBjb25zdCB2YWx1ZUtleXMgPSBrZXlzSW4odmFsdWUpO1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgdmFsdWVLZXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3Qga2V5ID0gdmFsdWVLZXlzW2ldO1xuICAgIGNvbnN0IG9ialZhbHVlID0gKHZhbHVlIGFzIGFueSlba2V5XTtcbiAgICBpZiAoa2V5ID09PSAnX19wcm90b19fJykge1xuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHBsYWluT2JqZWN0LCBrZXksIHtcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICB2YWx1ZTogb2JqVmFsdWUsXG4gICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHBsYWluT2JqZWN0W2tleV0gPSBvYmpWYWx1ZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHBsYWluT2JqZWN0O1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsTUFBTSxRQUFRLHNCQUFzQjtBQUU3Qzs7Ozs7Ozs7Ozs7O0NBWUMsR0FDRCxPQUFPLFNBQVMsY0FBYyxLQUFVO0VBQ3RDLE1BQU0sY0FBbUMsQ0FBQztFQUMxQyxNQUFNLFlBQVksT0FBTztFQUV6QixJQUFLLElBQUksSUFBSSxHQUFHLElBQUksVUFBVSxNQUFNLEVBQUUsSUFBSztJQUN6QyxNQUFNLE1BQU0sU0FBUyxDQUFDLEVBQUU7SUFDeEIsTUFBTSxXQUFXLEFBQUMsS0FBYSxDQUFDLElBQUk7SUFDcEMsSUFBSSxRQUFRLGFBQWE7TUFDdkIsT0FBTyxjQUFjLENBQUMsYUFBYSxLQUFLO1FBQ3RDLGNBQWM7UUFDZCxZQUFZO1FBQ1osT0FBTztRQUNQLFVBQVU7TUFDWjtJQUNGLE9BQU87TUFDTCxXQUFXLENBQUMsSUFBSSxHQUFHO0lBQ3JCO0VBQ0Y7RUFDQSxPQUFPO0FBQ1QifQ==
// denoCacheMetadata=12501009450700297462,1733304248750547363