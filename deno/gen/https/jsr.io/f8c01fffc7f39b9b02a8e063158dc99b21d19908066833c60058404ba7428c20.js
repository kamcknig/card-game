import { invoke } from './invoke.ts';
/**
 * Creates a function that invokes the method at a given path of `object` with the provided arguments.
 *
 * @param {object} object - The object to query.
 * @param {...any} args - The arguments to invoke the method with.
 * @returns {(path: PropertyKey | PropertyKey[]) => any} - Returns a new function that takes a path and invokes the method at `path` with `args`.
 *
 * @example
 * const object = {
 *  a: {
 *   b: function (x, y) {
 *    return x + y;
 *    }
 *   }
 * };
 *
 * const add = methodOf(object, 1, 2);
 * console.log(add('a.b')); // => 3
 */ export function methodOf(object, ...args) {
  return function(path) {
    return invoke(object, path, args);
  };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvdXRpbC9tZXRob2RPZi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBpbnZva2UgfSBmcm9tICcuL2ludm9rZS50cyc7XG5cbi8qKlxuICogQ3JlYXRlcyBhIGZ1bmN0aW9uIHRoYXQgaW52b2tlcyB0aGUgbWV0aG9kIGF0IGEgZ2l2ZW4gcGF0aCBvZiBgb2JqZWN0YCB3aXRoIHRoZSBwcm92aWRlZCBhcmd1bWVudHMuXG4gKlxuICogQHBhcmFtIHtvYmplY3R9IG9iamVjdCAtIFRoZSBvYmplY3QgdG8gcXVlcnkuXG4gKiBAcGFyYW0gey4uLmFueX0gYXJncyAtIFRoZSBhcmd1bWVudHMgdG8gaW52b2tlIHRoZSBtZXRob2Qgd2l0aC5cbiAqIEByZXR1cm5zIHsocGF0aDogUHJvcGVydHlLZXkgfCBQcm9wZXJ0eUtleVtdKSA9PiBhbnl9IC0gUmV0dXJucyBhIG5ldyBmdW5jdGlvbiB0aGF0IHRha2VzIGEgcGF0aCBhbmQgaW52b2tlcyB0aGUgbWV0aG9kIGF0IGBwYXRoYCB3aXRoIGBhcmdzYC5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3Qgb2JqZWN0ID0ge1xuICogIGE6IHtcbiAqICAgYjogZnVuY3Rpb24gKHgsIHkpIHtcbiAqICAgIHJldHVybiB4ICsgeTtcbiAqICAgIH1cbiAqICAgfVxuICogfTtcbiAqXG4gKiBjb25zdCBhZGQgPSBtZXRob2RPZihvYmplY3QsIDEsIDIpO1xuICogY29uc29sZS5sb2coYWRkKCdhLmInKSk7IC8vID0+IDNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1ldGhvZE9mKG9iamVjdDogb2JqZWN0LCAuLi5hcmdzOiBhbnlbXSk6IChwYXRoOiBQcm9wZXJ0eUtleSB8IFByb3BlcnR5S2V5W10pID0+IGFueSB7XG4gIHJldHVybiBmdW5jdGlvbiAocGF0aDogUHJvcGVydHlLZXkgfCBQcm9wZXJ0eUtleVtdKSB7XG4gICAgcmV0dXJuIGludm9rZShvYmplY3QsIHBhdGgsIGFyZ3MpO1xuICB9O1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsTUFBTSxRQUFRLGNBQWM7QUFFckM7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQWtCQyxHQUNELE9BQU8sU0FBUyxTQUFTLE1BQWMsRUFBRSxHQUFHLElBQVc7RUFDckQsT0FBTyxTQUFVLElBQWlDO0lBQ2hELE9BQU8sT0FBTyxRQUFRLE1BQU07RUFDOUI7QUFDRiJ9
// denoCacheMetadata=2838559453761735120,10654899866076070673