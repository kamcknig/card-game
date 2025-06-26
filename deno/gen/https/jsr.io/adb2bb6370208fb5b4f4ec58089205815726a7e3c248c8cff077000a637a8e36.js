import { toPath } from './toPath.ts';
import { toKey } from '../_internal/toKey.ts';
import { last } from '../array/last.ts';
import { get } from '../object/get.ts';
/**
 * Invokes the method at `path` of `object` with the given arguments.
 *
 * @param {unknown} object - The object to query.
 * @param {PropertyKey | PropertyKey[]} path - The path of the method to invoke.
 * @param {any[]} args - The arguments to invoke the method with.
 * @returns {any} - Returns the result of the invoked method.
 *
 * @example
 * const object = {
 *   a: {
 *     b: function (x, y) {
 *       return x + y;
 *     }
 *   }
 * };
 *
 * invoke(object, 'a.b', [1, 2]); // => 3
 * invoke(object, ['a', 'b'], [1, 2]); // => 3
 */ export function invoke(object, path, args = []) {
  if (object == null) {
    return;
  }
  switch(typeof path){
    case 'string':
      {
        if (typeof object === 'object' && Object.hasOwn(object, path)) {
          return invokeImpl(object, [
            path
          ], args);
        }
        return invokeImpl(object, toPath(path), args);
      }
    case 'number':
    case 'symbol':
      {
        return invokeImpl(object, [
          path
        ], args);
      }
    default:
      {
        if (Array.isArray(path)) {
          return invokeImpl(object, path, args);
        } else {
          return invokeImpl(object, [
            path
          ], args);
        }
      }
  }
}
function invokeImpl(object, path, args) {
  const parent = get(object, path.slice(0, -1), object);
  if (parent == null) {
    return undefined;
  }
  let lastKey = last(path);
  let lastValue = lastKey?.valueOf();
  if (typeof lastValue === 'number') {
    lastKey = toKey(lastValue);
  } else {
    lastKey = String(lastKey);
  }
  const func = get(parent, lastKey);
  return func?.apply(parent, args);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvdXRpbC9pbnZva2UudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgdG9QYXRoIH0gZnJvbSAnLi90b1BhdGgudHMnO1xuaW1wb3J0IHsgdG9LZXkgfSBmcm9tICcuLi9faW50ZXJuYWwvdG9LZXkudHMnO1xuaW1wb3J0IHsgbGFzdCB9IGZyb20gJy4uL2FycmF5L2xhc3QudHMnO1xuaW1wb3J0IHsgZ2V0IH0gZnJvbSAnLi4vb2JqZWN0L2dldC50cyc7XG5cbi8qKlxuICogSW52b2tlcyB0aGUgbWV0aG9kIGF0IGBwYXRoYCBvZiBgb2JqZWN0YCB3aXRoIHRoZSBnaXZlbiBhcmd1bWVudHMuXG4gKlxuICogQHBhcmFtIHt1bmtub3dufSBvYmplY3QgLSBUaGUgb2JqZWN0IHRvIHF1ZXJ5LlxuICogQHBhcmFtIHtQcm9wZXJ0eUtleSB8IFByb3BlcnR5S2V5W119IHBhdGggLSBUaGUgcGF0aCBvZiB0aGUgbWV0aG9kIHRvIGludm9rZS5cbiAqIEBwYXJhbSB7YW55W119IGFyZ3MgLSBUaGUgYXJndW1lbnRzIHRvIGludm9rZSB0aGUgbWV0aG9kIHdpdGguXG4gKiBAcmV0dXJucyB7YW55fSAtIFJldHVybnMgdGhlIHJlc3VsdCBvZiB0aGUgaW52b2tlZCBtZXRob2QuXG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IG9iamVjdCA9IHtcbiAqICAgYToge1xuICogICAgIGI6IGZ1bmN0aW9uICh4LCB5KSB7XG4gKiAgICAgICByZXR1cm4geCArIHk7XG4gKiAgICAgfVxuICogICB9XG4gKiB9O1xuICpcbiAqIGludm9rZShvYmplY3QsICdhLmInLCBbMSwgMl0pOyAvLyA9PiAzXG4gKiBpbnZva2Uob2JqZWN0LCBbJ2EnLCAnYiddLCBbMSwgMl0pOyAvLyA9PiAzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpbnZva2Uob2JqZWN0OiB1bmtub3duLCBwYXRoOiBQcm9wZXJ0eUtleSB8IFByb3BlcnR5S2V5W10sIGFyZ3M6IGFueVtdID0gW10pOiBhbnkge1xuICBpZiAob2JqZWN0ID09IG51bGwpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICBzd2l0Y2ggKHR5cGVvZiBwYXRoKSB7XG4gICAgY2FzZSAnc3RyaW5nJzoge1xuICAgICAgaWYgKHR5cGVvZiBvYmplY3QgPT09ICdvYmplY3QnICYmIE9iamVjdC5oYXNPd24ob2JqZWN0LCBwYXRoKSkge1xuICAgICAgICByZXR1cm4gaW52b2tlSW1wbChvYmplY3QsIFtwYXRoXSwgYXJncyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gaW52b2tlSW1wbChvYmplY3QsIHRvUGF0aChwYXRoKSwgYXJncyk7XG4gICAgfVxuICAgIGNhc2UgJ251bWJlcic6XG4gICAgY2FzZSAnc3ltYm9sJzoge1xuICAgICAgcmV0dXJuIGludm9rZUltcGwob2JqZWN0LCBbcGF0aF0sIGFyZ3MpO1xuICAgIH1cbiAgICBkZWZhdWx0OiB7XG4gICAgICBpZiAoQXJyYXkuaXNBcnJheShwYXRoKSkge1xuICAgICAgICByZXR1cm4gaW52b2tlSW1wbChvYmplY3QsIHBhdGgsIGFyZ3MpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGludm9rZUltcGwob2JqZWN0LCBbcGF0aF0sIGFyZ3MpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBpbnZva2VJbXBsKG9iamVjdDogdW5rbm93biwgcGF0aDogUHJvcGVydHlLZXlbXSwgYXJnczogYW55W10pIHtcbiAgY29uc3QgcGFyZW50ID0gZ2V0KG9iamVjdCwgcGF0aC5zbGljZSgwLCAtMSksIG9iamVjdCk7XG5cbiAgaWYgKHBhcmVudCA9PSBudWxsKSB7XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxuXG4gIGxldCBsYXN0S2V5ID0gbGFzdChwYXRoKTtcbiAgbGV0IGxhc3RWYWx1ZSA9IGxhc3RLZXk/LnZhbHVlT2YoKTtcblxuICBpZiAodHlwZW9mIGxhc3RWYWx1ZSA9PT0gJ251bWJlcicpIHtcbiAgICBsYXN0S2V5ID0gdG9LZXkobGFzdFZhbHVlKTtcbiAgfSBlbHNlIHtcbiAgICBsYXN0S2V5ID0gU3RyaW5nKGxhc3RLZXkpO1xuICB9XG5cbiAgY29uc3QgZnVuYyA9IGdldChwYXJlbnQsIGxhc3RLZXkpO1xuXG4gIHJldHVybiBmdW5jPy5hcHBseShwYXJlbnQsIGFyZ3MpO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsTUFBTSxRQUFRLGNBQWM7QUFDckMsU0FBUyxLQUFLLFFBQVEsd0JBQXdCO0FBQzlDLFNBQVMsSUFBSSxRQUFRLG1CQUFtQjtBQUN4QyxTQUFTLEdBQUcsUUFBUSxtQkFBbUI7QUFFdkM7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FtQkMsR0FDRCxPQUFPLFNBQVMsT0FBTyxNQUFlLEVBQUUsSUFBaUMsRUFBRSxPQUFjLEVBQUU7RUFDekYsSUFBSSxVQUFVLE1BQU07SUFDbEI7RUFDRjtFQUVBLE9BQVEsT0FBTztJQUNiLEtBQUs7TUFBVTtRQUNiLElBQUksT0FBTyxXQUFXLFlBQVksT0FBTyxNQUFNLENBQUMsUUFBUSxPQUFPO1VBQzdELE9BQU8sV0FBVyxRQUFRO1lBQUM7V0FBSyxFQUFFO1FBQ3BDO1FBQ0EsT0FBTyxXQUFXLFFBQVEsT0FBTyxPQUFPO01BQzFDO0lBQ0EsS0FBSztJQUNMLEtBQUs7TUFBVTtRQUNiLE9BQU8sV0FBVyxRQUFRO1VBQUM7U0FBSyxFQUFFO01BQ3BDO0lBQ0E7TUFBUztRQUNQLElBQUksTUFBTSxPQUFPLENBQUMsT0FBTztVQUN2QixPQUFPLFdBQVcsUUFBUSxNQUFNO1FBQ2xDLE9BQU87VUFDTCxPQUFPLFdBQVcsUUFBUTtZQUFDO1dBQUssRUFBRTtRQUNwQztNQUNGO0VBQ0Y7QUFDRjtBQUVBLFNBQVMsV0FBVyxNQUFlLEVBQUUsSUFBbUIsRUFBRSxJQUFXO0VBQ25FLE1BQU0sU0FBUyxJQUFJLFFBQVEsS0FBSyxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUk7RUFFOUMsSUFBSSxVQUFVLE1BQU07SUFDbEIsT0FBTztFQUNUO0VBRUEsSUFBSSxVQUFVLEtBQUs7RUFDbkIsSUFBSSxZQUFZLFNBQVM7RUFFekIsSUFBSSxPQUFPLGNBQWMsVUFBVTtJQUNqQyxVQUFVLE1BQU07RUFDbEIsT0FBTztJQUNMLFVBQVUsT0FBTztFQUNuQjtFQUVBLE1BQU0sT0FBTyxJQUFJLFFBQVE7RUFFekIsT0FBTyxNQUFNLE1BQU0sUUFBUTtBQUM3QiJ9
// denoCacheMetadata=9031291612799896222,18240120615921078306