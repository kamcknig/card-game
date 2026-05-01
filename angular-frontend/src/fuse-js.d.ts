// Local module declaration for fuse.js. The Angular compiler plugin for
// esbuild does not resolve fuse.js's bundled type declarations through the
// package.json `typings` field, even though standalone tsc resolves them
// correctly. Declaring the module here (inside src/, which tsconfig.app.json
// includes via "src/**/*.d.ts") guarantees the Angular compiler picks up the
// minimal set of types the app actually uses. Vite still bundles the real
// fuse.js package from node_modules at runtime.
declare module 'fuse.js' {
  interface IFuseOptions<T> {
    /** Array of keys (property names of T) to search. */
    keys?: Array<keyof T & string>;
    /** Determines how fuzzy a search is; 0 = exact, 1 = any match. Default 0.6. */
    threshold?: number;
    /** When true, the location of a match in the string does not affect score. */
    ignoreLocation?: boolean;
    /** Minimum number of characters in the search pattern before matching. */
    minMatchCharLength?: number;
  }

  interface FuseResult<T> {
    item: T;
    refIndex: number;
    score?: number;
  }

  class Fuse<T> {
    constructor(list: ReadonlyArray<T>, options?: IFuseOptions<T>);
    search(pattern: string): FuseResult<T>[];
  }

  export default Fuse;
  export { IFuseOptions, FuseResult };
}
