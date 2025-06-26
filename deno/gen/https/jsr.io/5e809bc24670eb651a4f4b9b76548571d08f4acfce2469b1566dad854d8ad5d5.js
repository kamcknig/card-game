/**
 * Returns a random element from an array.
 *
 * This function takes an array and returns a single element selected randomly from the array.
 *
 * @template T - The type of elements in the array.
 * @param {T[]} arr - The array to sample from.
 * @returns {T} A random element from the array.
 *
 * @example
 * const array = [1, 2, 3, 4, 5];
 * const randomElement = sample(array);
 * // randomElement will be one of the elements from the array, selected randomly.
 */ export function sample(arr) {
  const randomIndex = Math.floor(Math.random() * arr.length);
  return arr[randomIndex];
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9hcnJheS9zYW1wbGUudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBSZXR1cm5zIGEgcmFuZG9tIGVsZW1lbnQgZnJvbSBhbiBhcnJheS5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIHRha2VzIGFuIGFycmF5IGFuZCByZXR1cm5zIGEgc2luZ2xlIGVsZW1lbnQgc2VsZWN0ZWQgcmFuZG9tbHkgZnJvbSB0aGUgYXJyYXkuXG4gKlxuICogQHRlbXBsYXRlIFQgLSBUaGUgdHlwZSBvZiBlbGVtZW50cyBpbiB0aGUgYXJyYXkuXG4gKiBAcGFyYW0ge1RbXX0gYXJyIC0gVGhlIGFycmF5IHRvIHNhbXBsZSBmcm9tLlxuICogQHJldHVybnMge1R9IEEgcmFuZG9tIGVsZW1lbnQgZnJvbSB0aGUgYXJyYXkuXG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IGFycmF5ID0gWzEsIDIsIDMsIDQsIDVdO1xuICogY29uc3QgcmFuZG9tRWxlbWVudCA9IHNhbXBsZShhcnJheSk7XG4gKiAvLyByYW5kb21FbGVtZW50IHdpbGwgYmUgb25lIG9mIHRoZSBlbGVtZW50cyBmcm9tIHRoZSBhcnJheSwgc2VsZWN0ZWQgcmFuZG9tbHkuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzYW1wbGU8VD4oYXJyOiByZWFkb25seSBUW10pOiBUIHtcbiAgY29uc3QgcmFuZG9tSW5kZXggPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBhcnIubGVuZ3RoKTtcbiAgcmV0dXJuIGFycltyYW5kb21JbmRleF07XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7Ozs7Ozs7Q0FhQyxHQUNELE9BQU8sU0FBUyxPQUFVLEdBQWlCO0VBQ3pDLE1BQU0sY0FBYyxLQUFLLEtBQUssQ0FBQyxLQUFLLE1BQU0sS0FBSyxJQUFJLE1BQU07RUFDekQsT0FBTyxHQUFHLENBQUMsWUFBWTtBQUN6QiJ9
// denoCacheMetadata=10637732582140797227,3052482988870625619