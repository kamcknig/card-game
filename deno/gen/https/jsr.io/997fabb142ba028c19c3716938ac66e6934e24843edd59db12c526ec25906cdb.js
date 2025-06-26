import { flatten } from './flatten.ts';
/**
 * Maps each element in the array using the iteratee function and flattens the result up to the specified depth.
 *
 * @template T - The type of elements within the array.
 * @template U - The type of elements within the returned array from the iteratee function.
 * @template D - The depth to which the array should be flattened.
 * @param {T[]} arr - The array to flatten.
 * @param {(item: T) => U} iteratee - The function that produces the new array elements.
 * @param {D} depth - The depth level specifying how deep a nested array structure should be flattened. Defaults to 1.
 * @returns {Array<FlatArray<U[], D>>} The new array with the mapped and flattened elements.
 *
 * @example
 * const arr = [1, 2, 3];
 *
 * flatMap(arr, (item: number) => [item, item]);
 * // [1, 1, 2, 2, 3, 3]
 *
 * flatMap(arr, (item: number) => [[item, item]], 2);
 * // [1, 1, 2, 2, 3, 3]
 */ export function flatMap(arr, iteratee, depth = 1) {
  return flatten(arr.map((item)=>iteratee(item)), depth);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9hcnJheS9mbGF0TWFwLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGZsYXR0ZW4gfSBmcm9tICcuL2ZsYXR0ZW4udHMnO1xuXG4vKipcbiAqIE1hcHMgZWFjaCBlbGVtZW50IGluIHRoZSBhcnJheSB1c2luZyB0aGUgaXRlcmF0ZWUgZnVuY3Rpb24gYW5kIGZsYXR0ZW5zIHRoZSByZXN1bHQgdXAgdG8gdGhlIHNwZWNpZmllZCBkZXB0aC5cbiAqXG4gKiBAdGVtcGxhdGUgVCAtIFRoZSB0eXBlIG9mIGVsZW1lbnRzIHdpdGhpbiB0aGUgYXJyYXkuXG4gKiBAdGVtcGxhdGUgVSAtIFRoZSB0eXBlIG9mIGVsZW1lbnRzIHdpdGhpbiB0aGUgcmV0dXJuZWQgYXJyYXkgZnJvbSB0aGUgaXRlcmF0ZWUgZnVuY3Rpb24uXG4gKiBAdGVtcGxhdGUgRCAtIFRoZSBkZXB0aCB0byB3aGljaCB0aGUgYXJyYXkgc2hvdWxkIGJlIGZsYXR0ZW5lZC5cbiAqIEBwYXJhbSB7VFtdfSBhcnIgLSBUaGUgYXJyYXkgdG8gZmxhdHRlbi5cbiAqIEBwYXJhbSB7KGl0ZW06IFQpID0+IFV9IGl0ZXJhdGVlIC0gVGhlIGZ1bmN0aW9uIHRoYXQgcHJvZHVjZXMgdGhlIG5ldyBhcnJheSBlbGVtZW50cy5cbiAqIEBwYXJhbSB7RH0gZGVwdGggLSBUaGUgZGVwdGggbGV2ZWwgc3BlY2lmeWluZyBob3cgZGVlcCBhIG5lc3RlZCBhcnJheSBzdHJ1Y3R1cmUgc2hvdWxkIGJlIGZsYXR0ZW5lZC4gRGVmYXVsdHMgdG8gMS5cbiAqIEByZXR1cm5zIHtBcnJheTxGbGF0QXJyYXk8VVtdLCBEPj59IFRoZSBuZXcgYXJyYXkgd2l0aCB0aGUgbWFwcGVkIGFuZCBmbGF0dGVuZWQgZWxlbWVudHMuXG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IGFyciA9IFsxLCAyLCAzXTtcbiAqXG4gKiBmbGF0TWFwKGFyciwgKGl0ZW06IG51bWJlcikgPT4gW2l0ZW0sIGl0ZW1dKTtcbiAqIC8vIFsxLCAxLCAyLCAyLCAzLCAzXVxuICpcbiAqIGZsYXRNYXAoYXJyLCAoaXRlbTogbnVtYmVyKSA9PiBbW2l0ZW0sIGl0ZW1dXSwgMik7XG4gKiAvLyBbMSwgMSwgMiwgMiwgMywgM11cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGZsYXRNYXA8VCwgVSwgRCBleHRlbmRzIG51bWJlciA9IDE+KFxuICBhcnI6IHJlYWRvbmx5IFRbXSxcbiAgaXRlcmF0ZWU6IChpdGVtOiBUKSA9PiBVLFxuICBkZXB0aDogRCA9IDEgYXMgRFxuKTogQXJyYXk8RmxhdEFycmF5PFVbXSwgRD4+IHtcbiAgcmV0dXJuIGZsYXR0ZW4oXG4gICAgYXJyLm1hcChpdGVtID0+IGl0ZXJhdGVlKGl0ZW0pKSxcbiAgICBkZXB0aFxuICApO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsT0FBTyxRQUFRLGVBQWU7QUFFdkM7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FtQkMsR0FDRCxPQUFPLFNBQVMsUUFDZCxHQUFpQixFQUNqQixRQUF3QixFQUN4QixRQUFXLENBQU07RUFFakIsT0FBTyxRQUNMLElBQUksR0FBRyxDQUFDLENBQUEsT0FBUSxTQUFTLFFBQ3pCO0FBRUoifQ==
// denoCacheMetadata=6193431355055135251,13510553099728597283