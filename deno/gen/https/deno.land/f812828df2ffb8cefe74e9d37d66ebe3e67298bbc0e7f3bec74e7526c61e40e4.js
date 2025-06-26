// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
/** The options for creating a test suite with the describe function. */ /** Optional test definition keys. */ const optionalTestDefinitionKeys = [
  "only",
  "permissions",
  "ignore",
  "sanitizeExit",
  "sanitizeOps",
  "sanitizeResources"
];
/** Optional test step definition keys. */ const optionalTestStepDefinitionKeys = [
  "ignore",
  "sanitizeExit",
  "sanitizeOps",
  "sanitizeResources"
];
/**
 * An internal representation of a group of tests.
 */ export class TestSuiteInternal {
  symbol;
  describe;
  steps;
  hasOnlyStep;
  constructor(describe){
    this.describe = describe;
    this.steps = [];
    this.hasOnlyStep = false;
    const { suite } = describe;
    if (suite && !TestSuiteInternal.suites.has(suite.symbol)) {
      throw new Error("suite does not represent a registered test suite");
    }
    const testSuite = suite ? TestSuiteInternal.suites.get(suite.symbol) : TestSuiteInternal.current;
    this.symbol = Symbol();
    TestSuiteInternal.suites.set(this.symbol, this);
    const { fn } = describe;
    if (fn) {
      const temp = TestSuiteInternal.current;
      TestSuiteInternal.current = this;
      try {
        fn();
      } finally{
        TestSuiteInternal.current = temp;
      }
    }
    if (testSuite) {
      TestSuiteInternal.addStep(testSuite, this);
    } else {
      const { name, ignore, permissions, sanitizeExit, sanitizeOps, sanitizeResources } = describe;
      let { only } = describe;
      if (!ignore && this.hasOnlyStep) {
        only = true;
      }
      TestSuiteInternal.registerTest({
        name,
        ignore,
        only,
        permissions,
        sanitizeExit,
        sanitizeOps,
        sanitizeResources,
        fn: async (t)=>{
          TestSuiteInternal.runningCount++;
          try {
            const context = {};
            const { beforeAll } = this.describe;
            if (typeof beforeAll === "function") {
              await beforeAll.call(context);
            } else if (beforeAll) {
              for (const hook of beforeAll){
                await hook.call(context);
              }
            }
            try {
              TestSuiteInternal.active.push(this.symbol);
              await TestSuiteInternal.run(this, context, t);
            } finally{
              TestSuiteInternal.active.pop();
              const { afterAll } = this.describe;
              if (typeof afterAll === "function") {
                await afterAll.call(context);
              } else if (afterAll) {
                for (const hook of afterAll){
                  await hook.call(context);
                }
              }
            }
          } finally{
            TestSuiteInternal.runningCount--;
          }
        }
      });
    }
  }
  /** Stores how many test suites are executing. */ static runningCount = 0;
  /** If a test has been registered yet. Block adding global hooks if a test has been registered. */ static started = false;
  /** A map of all test suites by symbol. */ // deno-lint-ignore no-explicit-any
  static suites = new Map();
  /** The current test suite being registered. */ // deno-lint-ignore no-explicit-any
  static current = null;
  /** The stack of tests that are actively running. */ static active = [];
  /** This is used internally for testing this module. */ static reset() {
    TestSuiteInternal.runningCount = 0;
    TestSuiteInternal.started = false;
    TestSuiteInternal.current = null;
    TestSuiteInternal.active = [];
  }
  /** This is used internally to register tests. */ static registerTest(options) {
    options = {
      ...options
    };
    optionalTestDefinitionKeys.forEach((key)=>{
      if (typeof options[key] === "undefined") delete options[key];
    });
    Deno.test(options);
  }
  /** Updates all steps within top level suite to have ignore set to true if only is not set to true on step. */ static addingOnlyStep(suite) {
    if (!suite.hasOnlyStep) {
      for(let i = 0; i < suite.steps.length; i++){
        const step = suite.steps[i];
        if (!(step instanceof TestSuiteInternal) && !step.only) {
          suite.steps.splice(i--, 1);
        }
      }
      suite.hasOnlyStep = true;
    }
    const parentSuite = suite.describe.suite;
    const parentTestSuite = parentSuite && TestSuiteInternal.suites.get(parentSuite.symbol);
    if (parentTestSuite) {
      TestSuiteInternal.addingOnlyStep(parentTestSuite);
    }
  }
  /** This is used internally to add steps to a test suite. */ static addStep(suite, step) {
    if (!suite.hasOnlyStep) {
      if (step instanceof TestSuiteInternal) {
        if (step.hasOnlyStep || step.describe.only) {
          TestSuiteInternal.addingOnlyStep(suite);
        }
      } else {
        if (step.only) TestSuiteInternal.addingOnlyStep(suite);
      }
    }
    if (!(suite.hasOnlyStep && !(step instanceof TestSuiteInternal) && !step.only)) {
      suite.steps.push(step);
    }
  }
  /** This is used internally to add hooks to a test suite. */ static setHook(suite, name, fn) {
    if (suite.describe[name]) {
      if (typeof suite.describe[name] === "function") {
        suite.describe[name] = [
          suite.describe[name]
        ];
      }
      suite.describe[name].push(fn);
    } else {
      suite.describe[name] = fn;
    }
  }
  /** This is used internally to run all steps for a test suite. */ static async run(suite, context, t) {
    const hasOnly = suite.hasOnlyStep || suite.describe.only || false;
    for (const step of suite.steps){
      if (hasOnly && step instanceof TestSuiteInternal && !(step.hasOnlyStep || step.describe.only || false)) {
        continue;
      }
      const { name, fn, ignore, permissions, sanitizeExit, sanitizeOps, sanitizeResources } = step instanceof TestSuiteInternal ? step.describe : step;
      const options = {
        name,
        ignore,
        sanitizeExit,
        sanitizeOps,
        sanitizeResources,
        fn: async (t)=>{
          if (permissions) {
            throw new Error("permissions option not available for nested tests");
          }
          context = {
            ...context
          };
          if (step instanceof TestSuiteInternal) {
            const { beforeAll } = step.describe;
            if (typeof beforeAll === "function") {
              await beforeAll.call(context);
            } else if (beforeAll) {
              for (const hook of beforeAll){
                await hook.call(context);
              }
            }
            try {
              TestSuiteInternal.active.push(step.symbol);
              await TestSuiteInternal.run(step, context, t);
            } finally{
              TestSuiteInternal.active.pop();
              const { afterAll } = step.describe;
              if (typeof afterAll === "function") {
                await afterAll.call(context);
              } else if (afterAll) {
                for (const hook of afterAll){
                  await hook.call(context);
                }
              }
            }
          } else {
            await TestSuiteInternal.runTest(t, fn, context);
          }
        }
      };
      optionalTestStepDefinitionKeys.forEach((key)=>{
        if (typeof options[key] === "undefined") delete options[key];
      });
      await t.step(options);
    }
  }
  static async runTest(t, fn, context, activeIndex = 0) {
    const suite = TestSuiteInternal.active[activeIndex];
    const testSuite = suite && TestSuiteInternal.suites.get(suite);
    if (testSuite) {
      if (activeIndex === 0) context = {
        ...context
      };
      const { beforeEach } = testSuite.describe;
      if (typeof beforeEach === "function") {
        await beforeEach.call(context);
      } else if (beforeEach) {
        for (const hook of beforeEach){
          await hook.call(context);
        }
      }
      try {
        await TestSuiteInternal.runTest(t, fn, context, activeIndex + 1);
      } finally{
        const { afterEach } = testSuite.describe;
        if (typeof afterEach === "function") {
          await afterEach.call(context);
        } else if (afterEach) {
          for (const hook of afterEach){
            await hook.call(context);
          }
        }
      }
    } else {
      await fn.call(context, t);
    }
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE1MC4wL3Rlc3RpbmcvX3Rlc3Rfc3VpdGUudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMiB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cbi8qKiBUaGUgb3B0aW9ucyBmb3IgY3JlYXRpbmcgYSB0ZXN0IHN1aXRlIHdpdGggdGhlIGRlc2NyaWJlIGZ1bmN0aW9uLiAqL1xuZXhwb3J0IGludGVyZmFjZSBEZXNjcmliZURlZmluaXRpb248VD4gZXh0ZW5kcyBPbWl0PERlbm8uVGVzdERlZmluaXRpb24sIFwiZm5cIj4ge1xuICBmbj86ICgpID0+IHZvaWQ7XG4gIC8qKlxuICAgKiBUaGUgYGRlc2NyaWJlYCBmdW5jdGlvbiByZXR1cm5zIGEgYFRlc3RTdWl0ZWAgcmVwcmVzZW50aW5nIHRoZSBncm91cCBvZiB0ZXN0cy5cbiAgICogSWYgYGRlc2NyaWJlYCBpcyBjYWxsZWQgd2l0aGluIGFub3RoZXIgYGRlc2NyaWJlYCBjYWxscyBgZm5gLCB0aGUgc3VpdGUgd2lsbCBkZWZhdWx0IHRvIHRoYXQgcGFyZW50IGBkZXNjcmliZWAgY2FsbHMgcmV0dXJuZWQgYFRlc3RTdWl0ZWAuXG4gICAqIElmIGBkZXNjcmliZWAgaXMgbm90IGNhbGxlZCB3aXRoaW4gYW5vdGhlciBgZGVzY3JpYmVgIGNhbGxzIGBmbmAsIHRoZSBzdWl0ZSB3aWxsIGRlZmF1bHQgdG8gdGhlIGBUZXN0U3VpdGVgIHJlcHJlc2VudGluZyB0aGUgZ2xvYmFsIGdyb3VwIG9mIHRlc3RzLlxuICAgKi9cbiAgc3VpdGU/OiBUZXN0U3VpdGU8VD47XG4gIC8qKiBSdW4gc29tZSBzaGFyZWQgc2V0dXAgYmVmb3JlIGFsbCBvZiB0aGUgdGVzdHMgaW4gdGhlIHN1aXRlLiAqL1xuICBiZWZvcmVBbGw/OlxuICAgIHwgKCh0aGlzOiBUKSA9PiB2b2lkIHwgUHJvbWlzZTx2b2lkPilcbiAgICB8ICgodGhpczogVCkgPT4gdm9pZCB8IFByb21pc2U8dm9pZD4pW107XG4gIC8qKiBSdW4gc29tZSBzaGFyZWQgdGVhcmRvd24gYWZ0ZXIgYWxsIG9mIHRoZSB0ZXN0cyBpbiB0aGUgc3VpdGUuICovXG4gIGFmdGVyQWxsPzpcbiAgICB8ICgodGhpczogVCkgPT4gdm9pZCB8IFByb21pc2U8dm9pZD4pXG4gICAgfCAoKHRoaXM6IFQpID0+IHZvaWQgfCBQcm9taXNlPHZvaWQ+KVtdO1xuICAvKiogUnVuIHNvbWUgc2hhcmVkIHNldHVwIGJlZm9yZSBlYWNoIHRlc3QgaW4gdGhlIHN1aXRlLiAqL1xuICBiZWZvcmVFYWNoPzpcbiAgICB8ICgodGhpczogVCkgPT4gdm9pZCB8IFByb21pc2U8dm9pZD4pXG4gICAgfCAoKHRoaXM6IFQpID0+IHZvaWQgfCBQcm9taXNlPHZvaWQ+KVtdO1xuICAvKiogUnVuIHNvbWUgc2hhcmVkIHRlYXJkb3duIGFmdGVyIGVhY2ggdGVzdCBpbiB0aGUgc3VpdGUuICovXG4gIGFmdGVyRWFjaD86XG4gICAgfCAoKHRoaXM6IFQpID0+IHZvaWQgfCBQcm9taXNlPHZvaWQ+KVxuICAgIHwgKCh0aGlzOiBUKSA9PiB2b2lkIHwgUHJvbWlzZTx2b2lkPilbXTtcbn1cblxuLyoqIFRoZSBvcHRpb25zIGZvciBjcmVhdGluZyBhbiBpbmRpdmlkdWFsIHRlc3QgY2FzZSB3aXRoIHRoZSBpdCBmdW5jdGlvbi4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSXREZWZpbml0aW9uPFQ+IGV4dGVuZHMgT21pdDxEZW5vLlRlc3REZWZpbml0aW9uLCBcImZuXCI+IHtcbiAgZm46ICh0aGlzOiBULCB0OiBEZW5vLlRlc3RDb250ZXh0KSA9PiB2b2lkIHwgUHJvbWlzZTx2b2lkPjtcbiAgLyoqXG4gICAqIFRoZSBgZGVzY3JpYmVgIGZ1bmN0aW9uIHJldHVybnMgYSBgVGVzdFN1aXRlYCByZXByZXNlbnRpbmcgdGhlIGdyb3VwIG9mIHRlc3RzLlxuICAgKiBJZiBgaXRgIGlzIGNhbGxlZCB3aXRoaW4gYSBgZGVzY3JpYmVgIGNhbGxzIGBmbmAsIHRoZSBzdWl0ZSB3aWxsIGRlZmF1bHQgdG8gdGhhdCBwYXJlbnQgYGRlc2NyaWJlYCBjYWxscyByZXR1cm5lZCBgVGVzdFN1aXRlYC5cbiAgICogSWYgYGl0YCBpcyBub3QgY2FsbGVkIHdpdGhpbiBhIGBkZXNjcmliZWAgY2FsbHMgYGZuYCwgdGhlIHN1aXRlIHdpbGwgZGVmYXVsdCB0byB0aGUgYFRlc3RTdWl0ZWAgcmVwcmVzZW50aW5nIHRoZSBnbG9iYWwgZ3JvdXAgb2YgdGVzdHMuXG4gICAqL1xuICBzdWl0ZT86IFRlc3RTdWl0ZTxUPjtcbn1cblxuLyoqIFRoZSBuYW1lcyBvZiBhbGwgdGhlIGRpZmZlcmVudCB0eXBlcyBvZiBob29rcy4gKi9cbmV4cG9ydCB0eXBlIEhvb2tOYW1lcyA9IFwiYmVmb3JlQWxsXCIgfCBcImFmdGVyQWxsXCIgfCBcImJlZm9yZUVhY2hcIiB8IFwiYWZ0ZXJFYWNoXCI7XG5cbi8qKiBPcHRpb25hbCB0ZXN0IGRlZmluaXRpb24ga2V5cy4gKi9cbmNvbnN0IG9wdGlvbmFsVGVzdERlZmluaXRpb25LZXlzOiAoa2V5b2YgRGVuby5UZXN0RGVmaW5pdGlvbilbXSA9IFtcbiAgXCJvbmx5XCIsXG4gIFwicGVybWlzc2lvbnNcIixcbiAgXCJpZ25vcmVcIixcbiAgXCJzYW5pdGl6ZUV4aXRcIixcbiAgXCJzYW5pdGl6ZU9wc1wiLFxuICBcInNhbml0aXplUmVzb3VyY2VzXCIsXG5dO1xuXG4vKiogT3B0aW9uYWwgdGVzdCBzdGVwIGRlZmluaXRpb24ga2V5cy4gKi9cbmNvbnN0IG9wdGlvbmFsVGVzdFN0ZXBEZWZpbml0aW9uS2V5czogKGtleW9mIERlbm8uVGVzdFN0ZXBEZWZpbml0aW9uKVtdID0gW1xuICBcImlnbm9yZVwiLFxuICBcInNhbml0aXplRXhpdFwiLFxuICBcInNhbml0aXplT3BzXCIsXG4gIFwic2FuaXRpemVSZXNvdXJjZXNcIixcbl07XG5cbi8qKlxuICogQSBncm91cCBvZiB0ZXN0cy5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBUZXN0U3VpdGU8VD4ge1xuICBzeW1ib2w6IHN5bWJvbDtcbn1cblxuLyoqXG4gKiBBbiBpbnRlcm5hbCByZXByZXNlbnRhdGlvbiBvZiBhIGdyb3VwIG9mIHRlc3RzLlxuICovXG5leHBvcnQgY2xhc3MgVGVzdFN1aXRlSW50ZXJuYWw8VD4gaW1wbGVtZW50cyBUZXN0U3VpdGU8VD4ge1xuICBzeW1ib2w6IHN5bWJvbDtcbiAgcHJvdGVjdGVkIGRlc2NyaWJlOiBEZXNjcmliZURlZmluaXRpb248VD47XG4gIHByb3RlY3RlZCBzdGVwczogKFRlc3RTdWl0ZUludGVybmFsPFQ+IHwgSXREZWZpbml0aW9uPFQ+KVtdO1xuICBwcm90ZWN0ZWQgaGFzT25seVN0ZXA6IGJvb2xlYW47XG5cbiAgY29uc3RydWN0b3IoZGVzY3JpYmU6IERlc2NyaWJlRGVmaW5pdGlvbjxUPikge1xuICAgIHRoaXMuZGVzY3JpYmUgPSBkZXNjcmliZTtcbiAgICB0aGlzLnN0ZXBzID0gW107XG4gICAgdGhpcy5oYXNPbmx5U3RlcCA9IGZhbHNlO1xuXG4gICAgY29uc3QgeyBzdWl0ZSB9ID0gZGVzY3JpYmU7XG4gICAgaWYgKHN1aXRlICYmICFUZXN0U3VpdGVJbnRlcm5hbC5zdWl0ZXMuaGFzKHN1aXRlLnN5bWJvbCkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcInN1aXRlIGRvZXMgbm90IHJlcHJlc2VudCBhIHJlZ2lzdGVyZWQgdGVzdCBzdWl0ZVwiKTtcbiAgICB9XG4gICAgY29uc3QgdGVzdFN1aXRlID0gc3VpdGVcbiAgICAgID8gVGVzdFN1aXRlSW50ZXJuYWwuc3VpdGVzLmdldChzdWl0ZS5zeW1ib2wpXG4gICAgICA6IFRlc3RTdWl0ZUludGVybmFsLmN1cnJlbnQ7XG4gICAgdGhpcy5zeW1ib2wgPSBTeW1ib2woKTtcbiAgICBUZXN0U3VpdGVJbnRlcm5hbC5zdWl0ZXMuc2V0KHRoaXMuc3ltYm9sLCB0aGlzKTtcblxuICAgIGNvbnN0IHsgZm4gfSA9IGRlc2NyaWJlO1xuICAgIGlmIChmbikge1xuICAgICAgY29uc3QgdGVtcCA9IFRlc3RTdWl0ZUludGVybmFsLmN1cnJlbnQ7XG4gICAgICBUZXN0U3VpdGVJbnRlcm5hbC5jdXJyZW50ID0gdGhpcztcbiAgICAgIHRyeSB7XG4gICAgICAgIGZuKCk7XG4gICAgICB9IGZpbmFsbHkge1xuICAgICAgICBUZXN0U3VpdGVJbnRlcm5hbC5jdXJyZW50ID0gdGVtcDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAodGVzdFN1aXRlKSB7XG4gICAgICBUZXN0U3VpdGVJbnRlcm5hbC5hZGRTdGVwKHRlc3RTdWl0ZSwgdGhpcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHtcbiAgICAgICAgbmFtZSxcbiAgICAgICAgaWdub3JlLFxuICAgICAgICBwZXJtaXNzaW9ucyxcbiAgICAgICAgc2FuaXRpemVFeGl0LFxuICAgICAgICBzYW5pdGl6ZU9wcyxcbiAgICAgICAgc2FuaXRpemVSZXNvdXJjZXMsXG4gICAgICB9ID0gZGVzY3JpYmU7XG4gICAgICBsZXQgeyBvbmx5IH0gPSBkZXNjcmliZTtcbiAgICAgIGlmICghaWdub3JlICYmIHRoaXMuaGFzT25seVN0ZXApIHtcbiAgICAgICAgb25seSA9IHRydWU7XG4gICAgICB9XG4gICAgICBUZXN0U3VpdGVJbnRlcm5hbC5yZWdpc3RlclRlc3Qoe1xuICAgICAgICBuYW1lLFxuICAgICAgICBpZ25vcmUsXG4gICAgICAgIG9ubHksXG4gICAgICAgIHBlcm1pc3Npb25zLFxuICAgICAgICBzYW5pdGl6ZUV4aXQsXG4gICAgICAgIHNhbml0aXplT3BzLFxuICAgICAgICBzYW5pdGl6ZVJlc291cmNlcyxcbiAgICAgICAgZm46IGFzeW5jICh0KSA9PiB7XG4gICAgICAgICAgVGVzdFN1aXRlSW50ZXJuYWwucnVubmluZ0NvdW50Kys7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGNvbnRleHQgPSB7fSBhcyBUO1xuICAgICAgICAgICAgY29uc3QgeyBiZWZvcmVBbGwgfSA9IHRoaXMuZGVzY3JpYmU7XG4gICAgICAgICAgICBpZiAodHlwZW9mIGJlZm9yZUFsbCA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICAgIGF3YWl0IGJlZm9yZUFsbC5jYWxsKGNvbnRleHQpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChiZWZvcmVBbGwpIHtcbiAgICAgICAgICAgICAgZm9yIChjb25zdCBob29rIG9mIGJlZm9yZUFsbCkge1xuICAgICAgICAgICAgICAgIGF3YWl0IGhvb2suY2FsbChjb250ZXh0KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgVGVzdFN1aXRlSW50ZXJuYWwuYWN0aXZlLnB1c2godGhpcy5zeW1ib2wpO1xuICAgICAgICAgICAgICBhd2FpdCBUZXN0U3VpdGVJbnRlcm5hbC5ydW4odGhpcywgY29udGV4dCwgdCk7XG4gICAgICAgICAgICB9IGZpbmFsbHkge1xuICAgICAgICAgICAgICBUZXN0U3VpdGVJbnRlcm5hbC5hY3RpdmUucG9wKCk7XG4gICAgICAgICAgICAgIGNvbnN0IHsgYWZ0ZXJBbGwgfSA9IHRoaXMuZGVzY3JpYmU7XG4gICAgICAgICAgICAgIGlmICh0eXBlb2YgYWZ0ZXJBbGwgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgICAgIGF3YWl0IGFmdGVyQWxsLmNhbGwoY29udGV4dCk7XG4gICAgICAgICAgICAgIH0gZWxzZSBpZiAoYWZ0ZXJBbGwpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGhvb2sgb2YgYWZ0ZXJBbGwpIHtcbiAgICAgICAgICAgICAgICAgIGF3YWl0IGhvb2suY2FsbChjb250ZXh0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGZpbmFsbHkge1xuICAgICAgICAgICAgVGVzdFN1aXRlSW50ZXJuYWwucnVubmluZ0NvdW50LS07XG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqIFN0b3JlcyBob3cgbWFueSB0ZXN0IHN1aXRlcyBhcmUgZXhlY3V0aW5nLiAqL1xuICBzdGF0aWMgcnVubmluZ0NvdW50ID0gMDtcblxuICAvKiogSWYgYSB0ZXN0IGhhcyBiZWVuIHJlZ2lzdGVyZWQgeWV0LiBCbG9jayBhZGRpbmcgZ2xvYmFsIGhvb2tzIGlmIGEgdGVzdCBoYXMgYmVlbiByZWdpc3RlcmVkLiAqL1xuICBzdGF0aWMgc3RhcnRlZCA9IGZhbHNlO1xuXG4gIC8qKiBBIG1hcCBvZiBhbGwgdGVzdCBzdWl0ZXMgYnkgc3ltYm9sLiAqL1xuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICBzdGF0aWMgc3VpdGVzID0gbmV3IE1hcDxzeW1ib2wsIFRlc3RTdWl0ZUludGVybmFsPGFueT4+KCk7XG5cbiAgLyoqIFRoZSBjdXJyZW50IHRlc3Qgc3VpdGUgYmVpbmcgcmVnaXN0ZXJlZC4gKi9cbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgc3RhdGljIGN1cnJlbnQ6IFRlc3RTdWl0ZUludGVybmFsPGFueT4gfCBudWxsID0gbnVsbDtcblxuICAvKiogVGhlIHN0YWNrIG9mIHRlc3RzIHRoYXQgYXJlIGFjdGl2ZWx5IHJ1bm5pbmcuICovXG4gIHN0YXRpYyBhY3RpdmU6IHN5bWJvbFtdID0gW107XG5cbiAgLyoqIFRoaXMgaXMgdXNlZCBpbnRlcm5hbGx5IGZvciB0ZXN0aW5nIHRoaXMgbW9kdWxlLiAqL1xuICBzdGF0aWMgcmVzZXQoKTogdm9pZCB7XG4gICAgVGVzdFN1aXRlSW50ZXJuYWwucnVubmluZ0NvdW50ID0gMDtcbiAgICBUZXN0U3VpdGVJbnRlcm5hbC5zdGFydGVkID0gZmFsc2U7XG4gICAgVGVzdFN1aXRlSW50ZXJuYWwuY3VycmVudCA9IG51bGw7XG4gICAgVGVzdFN1aXRlSW50ZXJuYWwuYWN0aXZlID0gW107XG4gIH1cblxuICAvKiogVGhpcyBpcyB1c2VkIGludGVybmFsbHkgdG8gcmVnaXN0ZXIgdGVzdHMuICovXG4gIHN0YXRpYyByZWdpc3RlclRlc3Qob3B0aW9uczogRGVuby5UZXN0RGVmaW5pdGlvbik6IHZvaWQge1xuICAgIG9wdGlvbnMgPSB7IC4uLm9wdGlvbnMgfTtcbiAgICBvcHRpb25hbFRlc3REZWZpbml0aW9uS2V5cy5mb3JFYWNoKChrZXkpID0+IHtcbiAgICAgIGlmICh0eXBlb2Ygb3B0aW9uc1trZXldID09PSBcInVuZGVmaW5lZFwiKSBkZWxldGUgb3B0aW9uc1trZXldO1xuICAgIH0pO1xuICAgIERlbm8udGVzdChvcHRpb25zKTtcbiAgfVxuXG4gIC8qKiBVcGRhdGVzIGFsbCBzdGVwcyB3aXRoaW4gdG9wIGxldmVsIHN1aXRlIHRvIGhhdmUgaWdub3JlIHNldCB0byB0cnVlIGlmIG9ubHkgaXMgbm90IHNldCB0byB0cnVlIG9uIHN0ZXAuICovXG4gIHN0YXRpYyBhZGRpbmdPbmx5U3RlcDxUPihzdWl0ZTogVGVzdFN1aXRlSW50ZXJuYWw8VD4pIHtcbiAgICBpZiAoIXN1aXRlLmhhc09ubHlTdGVwKSB7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN1aXRlLnN0ZXBzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IHN0ZXAgPSBzdWl0ZS5zdGVwc1tpXSE7XG4gICAgICAgIGlmICghKHN0ZXAgaW5zdGFuY2VvZiBUZXN0U3VpdGVJbnRlcm5hbCkgJiYgIXN0ZXAub25seSkge1xuICAgICAgICAgIHN1aXRlLnN0ZXBzLnNwbGljZShpLS0sIDEpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBzdWl0ZS5oYXNPbmx5U3RlcCA9IHRydWU7XG4gICAgfVxuXG4gICAgY29uc3QgcGFyZW50U3VpdGUgPSBzdWl0ZS5kZXNjcmliZS5zdWl0ZTtcbiAgICBjb25zdCBwYXJlbnRUZXN0U3VpdGUgPSBwYXJlbnRTdWl0ZSAmJlxuICAgICAgVGVzdFN1aXRlSW50ZXJuYWwuc3VpdGVzLmdldChwYXJlbnRTdWl0ZS5zeW1ib2wpO1xuICAgIGlmIChwYXJlbnRUZXN0U3VpdGUpIHtcbiAgICAgIFRlc3RTdWl0ZUludGVybmFsLmFkZGluZ09ubHlTdGVwKHBhcmVudFRlc3RTdWl0ZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqIFRoaXMgaXMgdXNlZCBpbnRlcm5hbGx5IHRvIGFkZCBzdGVwcyB0byBhIHRlc3Qgc3VpdGUuICovXG4gIHN0YXRpYyBhZGRTdGVwPFQ+KFxuICAgIHN1aXRlOiBUZXN0U3VpdGVJbnRlcm5hbDxUPixcbiAgICBzdGVwOiBUZXN0U3VpdGVJbnRlcm5hbDxUPiB8IEl0RGVmaW5pdGlvbjxUPixcbiAgKTogdm9pZCB7XG4gICAgaWYgKCFzdWl0ZS5oYXNPbmx5U3RlcCkge1xuICAgICAgaWYgKHN0ZXAgaW5zdGFuY2VvZiBUZXN0U3VpdGVJbnRlcm5hbCkge1xuICAgICAgICBpZiAoc3RlcC5oYXNPbmx5U3RlcCB8fCBzdGVwLmRlc2NyaWJlLm9ubHkpIHtcbiAgICAgICAgICBUZXN0U3VpdGVJbnRlcm5hbC5hZGRpbmdPbmx5U3RlcChzdWl0ZSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChzdGVwLm9ubHkpIFRlc3RTdWl0ZUludGVybmFsLmFkZGluZ09ubHlTdGVwKHN1aXRlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoXG4gICAgICAhKHN1aXRlLmhhc09ubHlTdGVwICYmICEoc3RlcCBpbnN0YW5jZW9mIFRlc3RTdWl0ZUludGVybmFsKSAmJiAhc3RlcC5vbmx5KVxuICAgICkge1xuICAgICAgc3VpdGUuc3RlcHMucHVzaChzdGVwKTtcbiAgICB9XG4gIH1cblxuICAvKiogVGhpcyBpcyB1c2VkIGludGVybmFsbHkgdG8gYWRkIGhvb2tzIHRvIGEgdGVzdCBzdWl0ZS4gKi9cbiAgc3RhdGljIHNldEhvb2s8VD4oXG4gICAgc3VpdGU6IFRlc3RTdWl0ZUludGVybmFsPFQ+LFxuICAgIG5hbWU6IEhvb2tOYW1lcyxcbiAgICBmbjogKHRoaXM6IFQpID0+IHZvaWQgfCBQcm9taXNlPHZvaWQ+LFxuICApOiB2b2lkIHtcbiAgICBpZiAoc3VpdGUuZGVzY3JpYmVbbmFtZV0pIHtcbiAgICAgIGlmICh0eXBlb2Ygc3VpdGUuZGVzY3JpYmVbbmFtZV0gPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICBzdWl0ZS5kZXNjcmliZVtuYW1lXSA9IFtcbiAgICAgICAgICBzdWl0ZS5kZXNjcmliZVtuYW1lXSBhcyAoKHRoaXM6IFQpID0+IHZvaWQgfCBQcm9taXNlPHZvaWQ+KSxcbiAgICAgICAgXTtcbiAgICAgIH1cbiAgICAgIChzdWl0ZS5kZXNjcmliZVtuYW1lXSBhcyAoKHRoaXM6IFQpID0+IHZvaWQgfCBQcm9taXNlPHZvaWQ+KVtdKS5wdXNoKGZuKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc3VpdGUuZGVzY3JpYmVbbmFtZV0gPSBmbjtcbiAgICB9XG4gIH1cblxuICAvKiogVGhpcyBpcyB1c2VkIGludGVybmFsbHkgdG8gcnVuIGFsbCBzdGVwcyBmb3IgYSB0ZXN0IHN1aXRlLiAqL1xuICBzdGF0aWMgYXN5bmMgcnVuPFQ+KFxuICAgIHN1aXRlOiBUZXN0U3VpdGVJbnRlcm5hbDxUPixcbiAgICBjb250ZXh0OiBULFxuICAgIHQ6IERlbm8uVGVzdENvbnRleHQsXG4gICk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGhhc09ubHkgPSBzdWl0ZS5oYXNPbmx5U3RlcCB8fCBzdWl0ZS5kZXNjcmliZS5vbmx5IHx8IGZhbHNlO1xuICAgIGZvciAoY29uc3Qgc3RlcCBvZiBzdWl0ZS5zdGVwcykge1xuICAgICAgaWYgKFxuICAgICAgICBoYXNPbmx5ICYmIHN0ZXAgaW5zdGFuY2VvZiBUZXN0U3VpdGVJbnRlcm5hbCAmJlxuICAgICAgICAhKHN0ZXAuaGFzT25seVN0ZXAgfHwgc3RlcC5kZXNjcmliZS5vbmx5IHx8IGZhbHNlKVxuICAgICAgKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBjb25zdCB7XG4gICAgICAgIG5hbWUsXG4gICAgICAgIGZuLFxuICAgICAgICBpZ25vcmUsXG4gICAgICAgIHBlcm1pc3Npb25zLFxuICAgICAgICBzYW5pdGl6ZUV4aXQsXG4gICAgICAgIHNhbml0aXplT3BzLFxuICAgICAgICBzYW5pdGl6ZVJlc291cmNlcyxcbiAgICAgIH0gPSBzdGVwIGluc3RhbmNlb2YgVGVzdFN1aXRlSW50ZXJuYWwgPyBzdGVwLmRlc2NyaWJlIDogc3RlcDtcblxuICAgICAgY29uc3Qgb3B0aW9uczogRGVuby5UZXN0U3RlcERlZmluaXRpb24gPSB7XG4gICAgICAgIG5hbWUsXG4gICAgICAgIGlnbm9yZSxcbiAgICAgICAgc2FuaXRpemVFeGl0LFxuICAgICAgICBzYW5pdGl6ZU9wcyxcbiAgICAgICAgc2FuaXRpemVSZXNvdXJjZXMsXG4gICAgICAgIGZuOiBhc3luYyAodCkgPT4ge1xuICAgICAgICAgIGlmIChwZXJtaXNzaW9ucykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgICBcInBlcm1pc3Npb25zIG9wdGlvbiBub3QgYXZhaWxhYmxlIGZvciBuZXN0ZWQgdGVzdHNcIixcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnRleHQgPSB7IC4uLmNvbnRleHQgfTtcbiAgICAgICAgICBpZiAoc3RlcCBpbnN0YW5jZW9mIFRlc3RTdWl0ZUludGVybmFsKSB7XG4gICAgICAgICAgICBjb25zdCB7IGJlZm9yZUFsbCB9ID0gc3RlcC5kZXNjcmliZTtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgYmVmb3JlQWxsID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgICAgYXdhaXQgYmVmb3JlQWxsLmNhbGwoY29udGV4dCk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGJlZm9yZUFsbCkge1xuICAgICAgICAgICAgICBmb3IgKGNvbnN0IGhvb2sgb2YgYmVmb3JlQWxsKSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgaG9vay5jYWxsKGNvbnRleHQpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICBUZXN0U3VpdGVJbnRlcm5hbC5hY3RpdmUucHVzaChzdGVwLnN5bWJvbCk7XG4gICAgICAgICAgICAgIGF3YWl0IFRlc3RTdWl0ZUludGVybmFsLnJ1bihzdGVwLCBjb250ZXh0LCB0KTtcbiAgICAgICAgICAgIH0gZmluYWxseSB7XG4gICAgICAgICAgICAgIFRlc3RTdWl0ZUludGVybmFsLmFjdGl2ZS5wb3AoKTtcbiAgICAgICAgICAgICAgY29uc3QgeyBhZnRlckFsbCB9ID0gc3RlcC5kZXNjcmliZTtcbiAgICAgICAgICAgICAgaWYgKHR5cGVvZiBhZnRlckFsbCA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgYWZ0ZXJBbGwuY2FsbChjb250ZXh0KTtcbiAgICAgICAgICAgICAgfSBlbHNlIGlmIChhZnRlckFsbCkge1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgaG9vayBvZiBhZnRlckFsbCkge1xuICAgICAgICAgICAgICAgICAgYXdhaXQgaG9vay5jYWxsKGNvbnRleHQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhd2FpdCBUZXN0U3VpdGVJbnRlcm5hbC5ydW5UZXN0KHQsIGZuISwgY29udGV4dCk7XG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgfTtcbiAgICAgIG9wdGlvbmFsVGVzdFN0ZXBEZWZpbml0aW9uS2V5cy5mb3JFYWNoKChrZXkpID0+IHtcbiAgICAgICAgaWYgKHR5cGVvZiBvcHRpb25zW2tleV0gPT09IFwidW5kZWZpbmVkXCIpIGRlbGV0ZSBvcHRpb25zW2tleV07XG4gICAgICB9KTtcbiAgICAgIGF3YWl0IHQuc3RlcChvcHRpb25zKTtcbiAgICB9XG4gIH1cblxuICBzdGF0aWMgYXN5bmMgcnVuVGVzdDxUPihcbiAgICB0OiBEZW5vLlRlc3RDb250ZXh0LFxuICAgIGZuOiAodGhpczogVCwgdDogRGVuby5UZXN0Q29udGV4dCkgPT4gdm9pZCB8IFByb21pc2U8dm9pZD4sXG4gICAgY29udGV4dDogVCxcbiAgICBhY3RpdmVJbmRleCA9IDAsXG4gICkge1xuICAgIGNvbnN0IHN1aXRlID0gVGVzdFN1aXRlSW50ZXJuYWwuYWN0aXZlW2FjdGl2ZUluZGV4XTtcbiAgICBjb25zdCB0ZXN0U3VpdGUgPSBzdWl0ZSAmJiBUZXN0U3VpdGVJbnRlcm5hbC5zdWl0ZXMuZ2V0KHN1aXRlKTtcbiAgICBpZiAodGVzdFN1aXRlKSB7XG4gICAgICBpZiAoYWN0aXZlSW5kZXggPT09IDApIGNvbnRleHQgPSB7IC4uLmNvbnRleHQgfTtcbiAgICAgIGNvbnN0IHsgYmVmb3JlRWFjaCB9ID0gdGVzdFN1aXRlLmRlc2NyaWJlO1xuICAgICAgaWYgKHR5cGVvZiBiZWZvcmVFYWNoID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgYXdhaXQgYmVmb3JlRWFjaC5jYWxsKGNvbnRleHQpO1xuICAgICAgfSBlbHNlIGlmIChiZWZvcmVFYWNoKSB7XG4gICAgICAgIGZvciAoY29uc3QgaG9vayBvZiBiZWZvcmVFYWNoKSB7XG4gICAgICAgICAgYXdhaXQgaG9vay5jYWxsKGNvbnRleHQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0cnkge1xuICAgICAgICBhd2FpdCBUZXN0U3VpdGVJbnRlcm5hbC5ydW5UZXN0KHQsIGZuLCBjb250ZXh0LCBhY3RpdmVJbmRleCArIDEpO1xuICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgY29uc3QgeyBhZnRlckVhY2ggfSA9IHRlc3RTdWl0ZS5kZXNjcmliZTtcbiAgICAgICAgaWYgKHR5cGVvZiBhZnRlckVhY2ggPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgIGF3YWl0IGFmdGVyRWFjaC5jYWxsKGNvbnRleHQpO1xuICAgICAgICB9IGVsc2UgaWYgKGFmdGVyRWFjaCkge1xuICAgICAgICAgIGZvciAoY29uc3QgaG9vayBvZiBhZnRlckVhY2gpIHtcbiAgICAgICAgICAgIGF3YWl0IGhvb2suY2FsbChjb250ZXh0KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgYXdhaXQgZm4uY2FsbChjb250ZXh0LCB0KTtcbiAgICB9XG4gIH1cbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwRUFBMEU7QUFDMUUsc0VBQXNFLEdBeUN0RSxtQ0FBbUMsR0FDbkMsTUFBTSw2QkFBNEQ7RUFDaEU7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0NBQ0Q7QUFFRCx3Q0FBd0MsR0FDeEMsTUFBTSxpQ0FBb0U7RUFDeEU7RUFDQTtFQUNBO0VBQ0E7Q0FDRDtBQVNEOztDQUVDLEdBQ0QsT0FBTyxNQUFNO0VBQ1gsT0FBZTtFQUNMLFNBQWdDO0VBQ2hDLE1BQWtEO0VBQ2xELFlBQXFCO0VBRS9CLFlBQVksUUFBK0IsQ0FBRTtJQUMzQyxJQUFJLENBQUMsUUFBUSxHQUFHO0lBQ2hCLElBQUksQ0FBQyxLQUFLLEdBQUcsRUFBRTtJQUNmLElBQUksQ0FBQyxXQUFXLEdBQUc7SUFFbkIsTUFBTSxFQUFFLEtBQUssRUFBRSxHQUFHO0lBQ2xCLElBQUksU0FBUyxDQUFDLGtCQUFrQixNQUFNLENBQUMsR0FBRyxDQUFDLE1BQU0sTUFBTSxHQUFHO01BQ3hELE1BQU0sSUFBSSxNQUFNO0lBQ2xCO0lBQ0EsTUFBTSxZQUFZLFFBQ2Qsa0JBQWtCLE1BQU0sQ0FBQyxHQUFHLENBQUMsTUFBTSxNQUFNLElBQ3pDLGtCQUFrQixPQUFPO0lBQzdCLElBQUksQ0FBQyxNQUFNLEdBQUc7SUFDZCxrQkFBa0IsTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLElBQUk7SUFFOUMsTUFBTSxFQUFFLEVBQUUsRUFBRSxHQUFHO0lBQ2YsSUFBSSxJQUFJO01BQ04sTUFBTSxPQUFPLGtCQUFr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
// denoCacheMetadata=16828291575759211986,13419201144195708268