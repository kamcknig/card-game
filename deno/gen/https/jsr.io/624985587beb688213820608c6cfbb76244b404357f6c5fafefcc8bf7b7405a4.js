/**
 * Returns the intersection of two arrays based on a mapping function.
 *
 * This function takes two arrays and a mapping function. It returns a new array containing
 * the elements from the first array that, when mapped using the provided function, have matching
 * mapped elements in the second array. It effectively filters out any elements from the first array
 * that do not have corresponding mapped values in the second array.
 *
 * @template T - The type of elements in the first array.
 * @template U - The type of elements in the second array.
 * @param {T[]} firstArr - The first array to compare.
 * @param {U[]} secondArr - The second array to compare.
 * @param {(item: T | U) => unknown} mapper - A function to map the elements of both arrays for comparison.
 * @returns {T[]} A new array containing the elements from the first array that have corresponding mapped values in the second array.
 *
 * @example
 * const array1 = [{ id: 1 }, { id: 2 }, { id: 3 }];
 * const array2 = [{ id: 2 }, { id: 4 }];
 * const mapper = item => item.id;
 * const result = intersectionBy(array1, array2, mapper);
 * // result will be [{ id: 2 }] since only this element has a matching id in both arrays.
 *
 * @example
 * const array1 = [
 *   { id: 1, name: 'jane' },
 *   { id: 2, name: 'amy' },
 *   { id: 3, name: 'michael' },
 * ];
 * const array2 = [2, 4];
 * const mapper = item => (typeof item === 'object' ? item.id : item);
 * const result = intersectionBy(array1, array2, mapper);
 * // result will be [{ id: 2, name: 'amy' }] since only this element has a matching id that is equal to seconds array's element.
 */ export function intersectionBy(firstArr, secondArr, mapper) {
  const mappedSecondSet = new Set(secondArr.map(mapper));
  return firstArr.filter((item)=>mappedSecondSet.has(mapper(item)));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9hcnJheS9pbnRlcnNlY3Rpb25CeS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFJldHVybnMgdGhlIGludGVyc2VjdGlvbiBvZiB0d28gYXJyYXlzIGJhc2VkIG9uIGEgbWFwcGluZyBmdW5jdGlvbi5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIHRha2VzIHR3byBhcnJheXMgYW5kIGEgbWFwcGluZyBmdW5jdGlvbi4gSXQgcmV0dXJucyBhIG5ldyBhcnJheSBjb250YWluaW5nXG4gKiB0aGUgZWxlbWVudHMgZnJvbSB0aGUgZmlyc3QgYXJyYXkgdGhhdCwgd2hlbiBtYXBwZWQgdXNpbmcgdGhlIHByb3ZpZGVkIGZ1bmN0aW9uLCBoYXZlIG1hdGNoaW5nXG4gKiBtYXBwZWQgZWxlbWVudHMgaW4gdGhlIHNlY29uZCBhcnJheS4gSXQgZWZmZWN0aXZlbHkgZmlsdGVycyBvdXQgYW55IGVsZW1lbnRzIGZyb20gdGhlIGZpcnN0IGFycmF5XG4gKiB0aGF0IGRvIG5vdCBoYXZlIGNvcnJlc3BvbmRpbmcgbWFwcGVkIHZhbHVlcyBpbiB0aGUgc2Vjb25kIGFycmF5LlxuICpcbiAqIEB0ZW1wbGF0ZSBUIC0gVGhlIHR5cGUgb2YgZWxlbWVudHMgaW4gdGhlIGZpcnN0IGFycmF5LlxuICogQHRlbXBsYXRlIFUgLSBUaGUgdHlwZSBvZiBlbGVtZW50cyBpbiB0aGUgc2Vjb25kIGFycmF5LlxuICogQHBhcmFtIHtUW119IGZpcnN0QXJyIC0gVGhlIGZpcnN0IGFycmF5IHRvIGNvbXBhcmUuXG4gKiBAcGFyYW0ge1VbXX0gc2Vjb25kQXJyIC0gVGhlIHNlY29uZCBhcnJheSB0byBjb21wYXJlLlxuICogQHBhcmFtIHsoaXRlbTogVCB8IFUpID0+IHVua25vd259IG1hcHBlciAtIEEgZnVuY3Rpb24gdG8gbWFwIHRoZSBlbGVtZW50cyBvZiBib3RoIGFycmF5cyBmb3IgY29tcGFyaXNvbi5cbiAqIEByZXR1cm5zIHtUW119IEEgbmV3IGFycmF5IGNvbnRhaW5pbmcgdGhlIGVsZW1lbnRzIGZyb20gdGhlIGZpcnN0IGFycmF5IHRoYXQgaGF2ZSBjb3JyZXNwb25kaW5nIG1hcHBlZCB2YWx1ZXMgaW4gdGhlIHNlY29uZCBhcnJheS5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgYXJyYXkxID0gW3sgaWQ6IDEgfSwgeyBpZDogMiB9LCB7IGlkOiAzIH1dO1xuICogY29uc3QgYXJyYXkyID0gW3sgaWQ6IDIgfSwgeyBpZDogNCB9XTtcbiAqIGNvbnN0IG1hcHBlciA9IGl0ZW0gPT4gaXRlbS5pZDtcbiAqIGNvbnN0IHJlc3VsdCA9IGludGVyc2VjdGlvbkJ5KGFycmF5MSwgYXJyYXkyLCBtYXBwZXIpO1xuICogLy8gcmVzdWx0IHdpbGwgYmUgW3sgaWQ6IDIgfV0gc2luY2Ugb25seSB0aGlzIGVsZW1lbnQgaGFzIGEgbWF0Y2hpbmcgaWQgaW4gYm90aCBhcnJheXMuXG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IGFycmF5MSA9IFtcbiAqICAgeyBpZDogMSwgbmFtZTogJ2phbmUnIH0sXG4gKiAgIHsgaWQ6IDIsIG5hbWU6ICdhbXknIH0sXG4gKiAgIHsgaWQ6IDMsIG5hbWU6ICdtaWNoYWVsJyB9LFxuICogXTtcbiAqIGNvbnN0IGFycmF5MiA9IFsyLCA0XTtcbiAqIGNvbnN0IG1hcHBlciA9IGl0ZW0gPT4gKHR5cGVvZiBpdGVtID09PSAnb2JqZWN0JyA/IGl0ZW0uaWQgOiBpdGVtKTtcbiAqIGNvbnN0IHJlc3VsdCA9IGludGVyc2VjdGlvbkJ5KGFycmF5MSwgYXJyYXkyLCBtYXBwZXIpO1xuICogLy8gcmVzdWx0IHdpbGwgYmUgW3sgaWQ6IDIsIG5hbWU6ICdhbXknIH1dIHNpbmNlIG9ubHkgdGhpcyBlbGVtZW50IGhhcyBhIG1hdGNoaW5nIGlkIHRoYXQgaXMgZXF1YWwgdG8gc2Vjb25kcyBhcnJheSdzIGVsZW1lbnQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpbnRlcnNlY3Rpb25CeTxULCBVPihcbiAgZmlyc3RBcnI6IHJlYWRvbmx5IFRbXSxcbiAgc2Vjb25kQXJyOiByZWFkb25seSBVW10sXG4gIG1hcHBlcjogKGl0ZW06IFQgfCBVKSA9PiB1bmtub3duXG4pOiBUW10ge1xuICBjb25zdCBtYXBwZWRTZWNvbmRTZXQgPSBuZXcgU2V0KHNlY29uZEFyci5tYXAobWFwcGVyKSk7XG4gIHJldHVybiBmaXJzdEFyci5maWx0ZXIoaXRlbSA9PiBtYXBwZWRTZWNvbmRTZXQuaGFzKG1hcHBlcihpdGVtKSkpO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQWdDQyxHQUNELE9BQU8sU0FBUyxlQUNkLFFBQXNCLEVBQ3RCLFNBQXVCLEVBQ3ZCLE1BQWdDO0VBRWhDLE1BQU0sa0JBQWtCLElBQUksSUFBSSxVQUFVLEdBQUcsQ0FBQztFQUM5QyxPQUFPLFNBQVMsTUFBTSxDQUFDLENBQUEsT0FBUSxnQkFBZ0IsR0FBRyxDQUFDLE9BQU87QUFDNUQifQ==
// denoCacheMetadata=8360048309884311092,13969425114099362731