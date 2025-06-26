import { CASE_SPLIT_PATTERN } from '../../string/words.ts';
import { toString } from '../util/toString.ts';
/**
 * Splits `string` into an array of its words.
 *
 * @param {string | object} str - The string or object that is to be split into words.
 * @param {RegExp | string} [pattern] - The pattern to match words.
 * @returns {string[]} - Returns the words of `string`.
 *
 * @example
 * const wordsArray1 = words('fred, barney, & pebbles');
 * // => ['fred', 'barney', 'pebbles']
 *
 */ export function words(str, pattern = CASE_SPLIT_PATTERN) {
  const input = toString(str);
  const words1 = Array.from(input.match(pattern) ?? []);
  return words1.filter((x)=>x !== '');
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvc3RyaW5nL3dvcmRzLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENBU0VfU1BMSVRfUEFUVEVSTiB9IGZyb20gJy4uLy4uL3N0cmluZy93b3Jkcy50cyc7XG5pbXBvcnQgeyB0b1N0cmluZyB9IGZyb20gJy4uL3V0aWwvdG9TdHJpbmcudHMnO1xuXG4vKipcbiAqIFNwbGl0cyBgc3RyaW5nYCBpbnRvIGFuIGFycmF5IG9mIGl0cyB3b3Jkcy5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZyB8IG9iamVjdH0gc3RyIC0gVGhlIHN0cmluZyBvciBvYmplY3QgdGhhdCBpcyB0byBiZSBzcGxpdCBpbnRvIHdvcmRzLlxuICogQHBhcmFtIHtSZWdFeHAgfCBzdHJpbmd9IFtwYXR0ZXJuXSAtIFRoZSBwYXR0ZXJuIHRvIG1hdGNoIHdvcmRzLlxuICogQHJldHVybnMge3N0cmluZ1tdfSAtIFJldHVybnMgdGhlIHdvcmRzIG9mIGBzdHJpbmdgLlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCB3b3Jkc0FycmF5MSA9IHdvcmRzKCdmcmVkLCBiYXJuZXksICYgcGViYmxlcycpO1xuICogLy8gPT4gWydmcmVkJywgJ2Jhcm5leScsICdwZWJibGVzJ11cbiAqXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB3b3JkcyhzdHI/OiBzdHJpbmcgfCBvYmplY3QsIHBhdHRlcm46IFJlZ0V4cCB8IHN0cmluZyA9IENBU0VfU1BMSVRfUEFUVEVSTik6IHN0cmluZ1tdIHtcbiAgY29uc3QgaW5wdXQgPSB0b1N0cmluZyhzdHIpO1xuXG4gIGNvbnN0IHdvcmRzID0gQXJyYXkuZnJvbShpbnB1dC5tYXRjaChwYXR0ZXJuKSA/PyBbXSk7XG5cbiAgcmV0dXJuIHdvcmRzLmZpbHRlcih4ID0+IHggIT09ICcnKTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLGtCQUFrQixRQUFRLHdCQUF3QjtBQUMzRCxTQUFTLFFBQVEsUUFBUSxzQkFBc0I7QUFFL0M7Ozs7Ozs7Ozs7O0NBV0MsR0FDRCxPQUFPLFNBQVMsTUFBTSxHQUFxQixFQUFFLFVBQTJCLGtCQUFrQjtFQUN4RixNQUFNLFFBQVEsU0FBUztFQUV2QixNQUFNLFNBQVEsTUFBTSxJQUFJLENBQUMsTUFBTSxLQUFLLENBQUMsWUFBWSxFQUFFO0VBRW5ELE9BQU8sT0FBTSxNQUFNLENBQUMsQ0FBQSxJQUFLLE1BQU07QUFDakMifQ==
// denoCacheMetadata=12437214854867145774,18104855015276938246