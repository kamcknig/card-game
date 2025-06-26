/**
 * es-toolkit
 * ====================================
 * A modern JavaScript utility library that's 2-3 times faster and up to 97% smaller—a major upgrade to lodash.
 *
 * es-toolkit is a state-of-the-art, high-performance JavaScript utility library
 * with a small bundle size and strong type annotations.
 *
 * - es-toolkit offers a variety of everyday utility functions with modern implementations, such as [debounce](https://es-toolkit.slash.page/reference/function/debounce.html), [delay](https://es-toolkit.slash.page/reference/promise/delay.html), [chunk](https://es-toolkit.slash.page/reference/array/chunk.html), [sum](https://es-toolkit.slash.page/reference/math/sum.html), and [pick](https://es-toolkit.slash.page/reference/object/pick.html).
 * - Designed with performance in mind, es-toolkit achieves [2-3× better performance](https://es-toolkit.slash.page/performance.html) in modern JavaScript environments.
 * - es-toolkit supports tree shaking out of the box, and [reduces JavaScript code by up to 97%](https://es-toolkit.slash.page/bundle-size.html) compared to other libraries.
 * - es-toolkit includes built-in TypeScript support, with straightforward yet robust types. It also provides useful type guards such as [isNotNil](https://es-toolkit.slash.page/reference/predicate/isNotNil.html).
 * - es-toolkit is battle-tested with 100% test coverage, ensuring reliability and robustness.
 *
 * ## Features
 *
 * Here are some of the features es-toolkit offers:
 *
 * - **Array**: Utilities for array manipulation, such as [uniq](https://es-toolkit.slash.page/reference/array/uniq.html) and [difference](https://es-toolkit.slash.page/reference/array/difference.html).
 * - **Function**: Tools for controlling function execution, including [debounce](https://es-toolkit.slash.page/reference/function/debounce.html) and [throttle](https://es-toolkit.slash.page/reference/function/throttle.html).
 * - **Math**: Numerical utilities like [sum](https://es-toolkit.slash.page/reference/math/sum.html) and [round](https://es-toolkit.slash.page/reference/math/round.html).
 * - **Object**: Tools for manipulating JavaScript objects, such as [pick](https://es-toolkit.slash.page/reference/object/pick.html) and [omit](https://es-toolkit.slash.page/reference/object/omit.html).
 * - **Predicate**: Type guard functions like [isNotNil](https://es-toolkit.slash.page/reference/predicate/isNotNil.html).
 * - **Promise**: Asynchronous utilities like [delay](https://es-toolkit.slash.page/reference/promise/delay.html).
 * - **String**: Utilities for string manipulation, such as [snakeCase](https://es-toolkit.slash.page/reference/string/snakeCase.html)
 *
 * ## Examples
 *
 * ```typescript
 * // import from '@es-toolkit/es-toolkit' in jsr.
 * import { debounce, chunk } from 'es-toolkit';
 *
 * const debouncedLog = debounce(message => {
 *   console.log(message);
 * }, 300);
 *
 * // This call will be debounced
 * debouncedLog('Hello, world!');
 *
 * const array = [1, 2, 3, 4, 5, 6];
 * const chunkedArray = chunk(array, 2);
 *
 * console.log(chunkedArray);
 * // Output: [[1, 2], [3, 4], [5, 6]]
 * ```
 *
 * ## Resources
 *
 * If you want to know more about the project, please take a look at the
 * following resources:
 *
 * - [GitHub](https://github.com/toss/es-toolkit)
 * - [Documentation](https://es-toolkit.slash.page)
 *
 * @module
 */ export * from './array/index.ts';
export * from './error/index.ts';
export * from './function/index.ts';
export * from './math/index.ts';
export * from './object/index.ts';
export * from './predicate/index.ts';
export * from './promise/index.ts';
export * from './string/index.ts';
export * from './util/index.ts';
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9pbmRleC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIGVzLXRvb2xraXRcbiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogQSBtb2Rlcm4gSmF2YVNjcmlwdCB1dGlsaXR5IGxpYnJhcnkgdGhhdCdzIDItMyB0aW1lcyBmYXN0ZXIgYW5kIHVwIHRvIDk3JSBzbWFsbGVy4oCUYSBtYWpvciB1cGdyYWRlIHRvIGxvZGFzaC5cbiAqXG4gKiBlcy10b29sa2l0IGlzIGEgc3RhdGUtb2YtdGhlLWFydCwgaGlnaC1wZXJmb3JtYW5jZSBKYXZhU2NyaXB0IHV0aWxpdHkgbGlicmFyeVxuICogd2l0aCBhIHNtYWxsIGJ1bmRsZSBzaXplIGFuZCBzdHJvbmcgdHlwZSBhbm5vdGF0aW9ucy5cbiAqXG4gKiAtIGVzLXRvb2xraXQgb2ZmZXJzIGEgdmFyaWV0eSBvZiBldmVyeWRheSB1dGlsaXR5IGZ1bmN0aW9ucyB3aXRoIG1vZGVybiBpbXBsZW1lbnRhdGlvbnMsIHN1Y2ggYXMgW2RlYm91bmNlXShodHRwczovL2VzLXRvb2xraXQuc2xhc2gucGFnZS9yZWZlcmVuY2UvZnVuY3Rpb24vZGVib3VuY2UuaHRtbCksIFtkZWxheV0oaHR0cHM6Ly9lcy10b29sa2l0LnNsYXNoLnBhZ2UvcmVmZXJlbmNlL3Byb21pc2UvZGVsYXkuaHRtbCksIFtjaHVua10oaHR0cHM6Ly9lcy10b29sa2l0LnNsYXNoLnBhZ2UvcmVmZXJlbmNlL2FycmF5L2NodW5rLmh0bWwpLCBbc3VtXShodHRwczovL2VzLXRvb2xraXQuc2xhc2gucGFnZS9yZWZlcmVuY2UvbWF0aC9zdW0uaHRtbCksIGFuZCBbcGlja10oaHR0cHM6Ly9lcy10b29sa2l0LnNsYXNoLnBhZ2UvcmVmZXJlbmNlL29iamVjdC9waWNrLmh0bWwpLlxuICogLSBEZXNpZ25lZCB3aXRoIHBlcmZvcm1hbmNlIGluIG1pbmQsIGVzLXRvb2xraXQgYWNoaWV2ZXMgWzItM8OXIGJldHRlciBwZXJmb3JtYW5jZV0oaHR0cHM6Ly9lcy10b29sa2l0LnNsYXNoLnBhZ2UvcGVyZm9ybWFuY2UuaHRtbCkgaW4gbW9kZXJuIEphdmFTY3JpcHQgZW52aXJvbm1lbnRzLlxuICogLSBlcy10b29sa2l0IHN1cHBvcnRzIHRyZWUgc2hha2luZyBvdXQgb2YgdGhlIGJveCwgYW5kIFtyZWR1Y2VzIEphdmFTY3JpcHQgY29kZSBieSB1cCB0byA5NyVdKGh0dHBzOi8vZXMtdG9vbGtpdC5zbGFzaC5wYWdlL2J1bmRsZS1zaXplLmh0bWwpIGNvbXBhcmVkIHRvIG90aGVyIGxpYnJhcmllcy5cbiAqIC0gZXMtdG9vbGtpdCBpbmNsdWRlcyBidWlsdC1pbiBUeXBlU2NyaXB0IHN1cHBvcnQsIHdpdGggc3RyYWlnaHRmb3J3YXJkIHlldCByb2J1c3QgdHlwZXMuIEl0IGFsc28gcHJvdmlkZXMgdXNlZnVsIHR5cGUgZ3VhcmRzIHN1Y2ggYXMgW2lzTm90TmlsXShodHRwczovL2VzLXRvb2xraXQuc2xhc2gucGFnZS9yZWZlcmVuY2UvcHJlZGljYXRlL2lzTm90TmlsLmh0bWwpLlxuICogLSBlcy10b29sa2l0IGlzIGJhdHRsZS10ZXN0ZWQgd2l0aCAxMDAlIHRlc3QgY292ZXJhZ2UsIGVuc3VyaW5nIHJlbGlhYmlsaXR5IGFuZCByb2J1c3RuZXNzLlxuICpcbiAqICMjIEZlYXR1cmVzXG4gKlxuICogSGVyZSBhcmUgc29tZSBvZiB0aGUgZmVhdHVyZXMgZXMtdG9vbGtpdCBvZmZlcnM6XG4gKlxuICogLSAqKkFycmF5Kio6IFV0aWxpdGllcyBmb3IgYXJyYXkgbWFuaXB1bGF0aW9uLCBzdWNoIGFzIFt1bmlxXShodHRwczovL2VzLXRvb2xraXQuc2xhc2gucGFnZS9yZWZlcmVuY2UvYXJyYXkvdW5pcS5odG1sKSBhbmQgW2RpZmZlcmVuY2VdKGh0dHBzOi8vZXMtdG9vbGtpdC5zbGFzaC5wYWdlL3JlZmVyZW5jZS9hcnJheS9kaWZmZXJlbmNlLmh0bWwpLlxuICogLSAqKkZ1bmN0aW9uKio6IFRvb2xzIGZvciBjb250cm9sbGluZyBmdW5jdGlvbiBleGVjdXRpb24sIGluY2x1ZGluZyBbZGVib3VuY2VdKGh0dHBzOi8vZXMtdG9vbGtpdC5zbGFzaC5wYWdlL3JlZmVyZW5jZS9mdW5jdGlvbi9kZWJvdW5jZS5odG1sKSBhbmQgW3Rocm90dGxlXShodHRwczovL2VzLXRvb2xraXQuc2xhc2gucGFnZS9yZWZlcmVuY2UvZnVuY3Rpb24vdGhyb3R0bGUuaHRtbCkuXG4gKiAtICoqTWF0aCoqOiBOdW1lcmljYWwgdXRpbGl0aWVzIGxpa2UgW3N1bV0oaHR0cHM6Ly9lcy10b29sa2l0LnNsYXNoLnBhZ2UvcmVmZXJlbmNlL21hdGgvc3VtLmh0bWwpIGFuZCBbcm91bmRdKGh0dHBzOi8vZXMtdG9vbGtpdC5zbGFzaC5wYWdlL3JlZmVyZW5jZS9tYXRoL3JvdW5kLmh0bWwpLlxuICogLSAqKk9iamVjdCoqOiBUb29scyBmb3IgbWFuaXB1bGF0aW5nIEphdmFTY3JpcHQgb2JqZWN0cywgc3VjaCBhcyBbcGlja10oaHR0cHM6Ly9lcy10b29sa2l0LnNsYXNoLnBhZ2UvcmVmZXJlbmNlL29iamVjdC9waWNrLmh0bWwpIGFuZCBbb21pdF0oaHR0cHM6Ly9lcy10b29sa2l0LnNsYXNoLnBhZ2UvcmVmZXJlbmNlL29iamVjdC9vbWl0Lmh0bWwpLlxuICogLSAqKlByZWRpY2F0ZSoqOiBUeXBlIGd1YXJkIGZ1bmN0aW9ucyBsaWtlIFtpc05vdE5pbF0oaHR0cHM6Ly9lcy10b29sa2l0LnNsYXNoLnBhZ2UvcmVmZXJlbmNlL3ByZWRpY2F0ZS9pc05vdE5pbC5odG1sKS5cbiAqIC0gKipQcm9taXNlKio6IEFzeW5jaHJvbm91cyB1dGlsaXRpZXMgbGlrZSBbZGVsYXldKGh0dHBzOi8vZXMtdG9vbGtpdC5zbGFzaC5wYWdlL3JlZmVyZW5jZS9wcm9taXNlL2RlbGF5Lmh0bWwpLlxuICogLSAqKlN0cmluZyoqOiBVdGlsaXRpZXMgZm9yIHN0cmluZyBtYW5pcHVsYXRpb24sIHN1Y2ggYXMgW3NuYWtlQ2FzZV0oaHR0cHM6Ly9lcy10b29sa2l0LnNsYXNoLnBhZ2UvcmVmZXJlbmNlL3N0cmluZy9zbmFrZUNhc2UuaHRtbClcbiAqXG4gKiAjIyBFeGFtcGxlc1xuICpcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIC8vIGltcG9ydCBmcm9tICdAZXMtdG9vbGtpdC9lcy10b29sa2l0JyBpbiBqc3IuXG4gKiBpbXBvcnQgeyBkZWJvdW5jZSwgY2h1bmsgfSBmcm9tICdlcy10b29sa2l0JztcbiAqXG4gKiBjb25zdCBkZWJvdW5jZWRMb2cgPSBkZWJvdW5jZShtZXNzYWdlID0+IHtcbiAqICAgY29uc29sZS5sb2cobWVzc2FnZSk7XG4gKiB9LCAzMDApO1xuICpcbiAqIC8vIFRoaXMgY2FsbCB3aWxsIGJlIGRlYm91bmNlZFxuICogZGVib3VuY2VkTG9nKCdIZWxsbywgd29ybGQhJyk7XG4gKlxuICogY29uc3QgYXJyYXkgPSBbMSwgMiwgMywgNCwgNSwgNl07XG4gKiBjb25zdCBjaHVua2VkQXJyYXkgPSBjaHVuayhhcnJheSwgMik7XG4gKlxuICogY29uc29sZS5sb2coY2h1bmtlZEFycmF5KTtcbiAqIC8vIE91dHB1dDogW1sxLCAyXSwgWzMsIDRdLCBbNSwgNl1dXG4gKiBgYGBcbiAqXG4gKiAjIyBSZXNvdXJjZXNcbiAqXG4gKiBJZiB5b3Ugd2FudCB0byBrbm93IG1vcmUgYWJvdXQgdGhlIHByb2plY3QsIHBsZWFzZSB0YWtlIGEgbG9vayBhdCB0aGVcbiAqIGZvbGxvd2luZyByZXNvdXJjZXM6XG4gKlxuICogLSBbR2l0SHViXShodHRwczovL2dpdGh1Yi5jb20vdG9zcy9lcy10b29sa2l0KVxuICogLSBbRG9jdW1lbnRhdGlvbl0oaHR0cHM6Ly9lcy10b29sa2l0LnNsYXNoLnBhZ2UpXG4gKlxuICogQG1vZHVsZVxuICovXG5leHBvcnQgKiBmcm9tICcuL2FycmF5L2luZGV4LnRzJztcbmV4cG9ydCAqIGZyb20gJy4vZXJyb3IvaW5kZXgudHMnO1xuZXhwb3J0ICogZnJvbSAnLi9mdW5jdGlvbi9pbmRleC50cyc7XG5leHBvcnQgKiBmcm9tICcuL21hdGgvaW5kZXgudHMnO1xuZXhwb3J0ICogZnJvbSAnLi9vYmplY3QvaW5kZXgudHMnO1xuZXhwb3J0ICogZnJvbSAnLi9wcmVkaWNhdGUvaW5kZXgudHMnO1xuZXhwb3J0ICogZnJvbSAnLi9wcm9taXNlL2luZGV4LnRzJztcbmV4cG9ydCAqIGZyb20gJy4vc3RyaW5nL2luZGV4LnRzJztcbmV4cG9ydCAqIGZyb20gJy4vdXRpbC9pbmRleC50cyc7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0F1REMsR0FDRCxjQUFjLG1CQUFtQjtBQUNqQyxjQUFjLG1CQUFtQjtBQUNqQyxjQUFjLHNCQUFzQjtBQUNwQyxjQUFjLGtCQUFrQjtBQUNoQyxjQUFjLG9CQUFvQjtBQUNsQyxjQUFjLHVCQUF1QjtBQUNyQyxjQUFjLHFCQUFxQjtBQUNuQyxjQUFjLG9CQUFvQjtBQUNsQyxjQUFjLGtCQUFrQiJ9
// denoCacheMetadata=10482288907846077629,1035721351590575005