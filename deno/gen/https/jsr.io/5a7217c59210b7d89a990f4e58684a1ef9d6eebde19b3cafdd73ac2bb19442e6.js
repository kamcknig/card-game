/**
 * A counting semaphore for async functions that manages available permits.
 * Semaphores are mainly used to limit the number of concurrent async tasks.
 *
 * Each `acquire` operation takes a permit or waits until one is available.
 * Each `release` operation adds a permit, potentially allowing a waiting task to proceed.
 *
 * The semaphore ensures fairness by maintaining a FIFO (First In, First Out) order for acquirers.
 *
 * @example
 * const sema = new Semaphore(2);
 *
 * async function task() {
 *   await sema.acquire();
 *   try {
 *     // This code can only be executed by two tasks at the same time
 *   } finally {
 *     sema.release();
 *   }
 * }
 *
 * task();
 * task();
 * task(); // This task will wait until one of the previous tasks releases the semaphore.
 */ export class Semaphore {
  /**
   * The maximum number of concurrent operations allowed.
   * @type {number}
   */ capacity;
  /**
   * The number of available permits.
   * @type {number}
   */ available;
  deferredTasks = [];
  /**
   * Creates an instance of Semaphore.
   * @param {number} capacity - The maximum number of concurrent operations allowed.
   *
   * @example
   * const sema = new Semaphore(3); // Allows up to 3 concurrent operations.
   */ constructor(capacity){
    this.capacity = capacity;
    this.available = capacity;
  }
  /**
   * Acquires a semaphore, blocking if necessary until one is available.
   * @returns {Promise<void>} A promise that resolves when the semaphore is acquired.
   *
   * @example
   * const sema = new Semaphore(1);
   *
   * async function criticalSection() {
   *   await sema.acquire();
   *   try {
   *     // This code section cannot be executed simultaneously
   *   } finally {
   *     sema.release();
   *   }
   * }
   */ async acquire() {
    if (this.available > 0) {
      this.available--;
      return;
    }
    return new Promise((resolve)=>{
      this.deferredTasks.push(resolve);
    });
  }
  /**
   * Releases a semaphore, allowing one more operation to proceed.
   *
   * @example
   * const sema = new Semaphore(1);
   *
   * async function task() {
   *   await sema.acquire();
   *   try {
   *     // This code can only be executed by two tasks at the same time
   *   } finally {
   *     sema.release(); // Allows another waiting task to proceed.
   *   }
   * }
   */ release() {
    const deferredTask = this.deferredTasks.shift();
    if (deferredTask != null) {
      deferredTask();
      return;
    }
    if (this.available < this.capacity) {
      this.available++;
    }
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9wcm9taXNlL3NlbWFwaG9yZS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEEgY291bnRpbmcgc2VtYXBob3JlIGZvciBhc3luYyBmdW5jdGlvbnMgdGhhdCBtYW5hZ2VzIGF2YWlsYWJsZSBwZXJtaXRzLlxuICogU2VtYXBob3JlcyBhcmUgbWFpbmx5IHVzZWQgdG8gbGltaXQgdGhlIG51bWJlciBvZiBjb25jdXJyZW50IGFzeW5jIHRhc2tzLlxuICpcbiAqIEVhY2ggYGFjcXVpcmVgIG9wZXJhdGlvbiB0YWtlcyBhIHBlcm1pdCBvciB3YWl0cyB1bnRpbCBvbmUgaXMgYXZhaWxhYmxlLlxuICogRWFjaCBgcmVsZWFzZWAgb3BlcmF0aW9uIGFkZHMgYSBwZXJtaXQsIHBvdGVudGlhbGx5IGFsbG93aW5nIGEgd2FpdGluZyB0YXNrIHRvIHByb2NlZWQuXG4gKlxuICogVGhlIHNlbWFwaG9yZSBlbnN1cmVzIGZhaXJuZXNzIGJ5IG1haW50YWluaW5nIGEgRklGTyAoRmlyc3QgSW4sIEZpcnN0IE91dCkgb3JkZXIgZm9yIGFjcXVpcmVycy5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3Qgc2VtYSA9IG5ldyBTZW1hcGhvcmUoMik7XG4gKlxuICogYXN5bmMgZnVuY3Rpb24gdGFzaygpIHtcbiAqICAgYXdhaXQgc2VtYS5hY3F1aXJlKCk7XG4gKiAgIHRyeSB7XG4gKiAgICAgLy8gVGhpcyBjb2RlIGNhbiBvbmx5IGJlIGV4ZWN1dGVkIGJ5IHR3byB0YXNrcyBhdCB0aGUgc2FtZSB0aW1lXG4gKiAgIH0gZmluYWxseSB7XG4gKiAgICAgc2VtYS5yZWxlYXNlKCk7XG4gKiAgIH1cbiAqIH1cbiAqXG4gKiB0YXNrKCk7XG4gKiB0YXNrKCk7XG4gKiB0YXNrKCk7IC8vIFRoaXMgdGFzayB3aWxsIHdhaXQgdW50aWwgb25lIG9mIHRoZSBwcmV2aW91cyB0YXNrcyByZWxlYXNlcyB0aGUgc2VtYXBob3JlLlxuICovXG5leHBvcnQgY2xhc3MgU2VtYXBob3JlIHtcbiAgLyoqXG4gICAqIFRoZSBtYXhpbXVtIG51bWJlciBvZiBjb25jdXJyZW50IG9wZXJhdGlvbnMgYWxsb3dlZC5cbiAgICogQHR5cGUge251bWJlcn1cbiAgICovXG4gIHB1YmxpYyBjYXBhY2l0eTogbnVtYmVyO1xuXG4gIC8qKlxuICAgKiBUaGUgbnVtYmVyIG9mIGF2YWlsYWJsZSBwZXJtaXRzLlxuICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgKi9cbiAgcHVibGljIGF2YWlsYWJsZTogbnVtYmVyO1xuICBwcml2YXRlIGRlZmVycmVkVGFza3M6IEFycmF5PCgpID0+IHZvaWQ+ID0gW107XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYW4gaW5zdGFuY2Ugb2YgU2VtYXBob3JlLlxuICAgKiBAcGFyYW0ge251bWJlcn0gY2FwYWNpdHkgLSBUaGUgbWF4aW11bSBudW1iZXIgb2YgY29uY3VycmVudCBvcGVyYXRpb25zIGFsbG93ZWQuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGNvbnN0IHNlbWEgPSBuZXcgU2VtYXBob3JlKDMpOyAvLyBBbGxvd3MgdXAgdG8gMyBjb25jdXJyZW50IG9wZXJhdGlvbnMuXG4gICAqL1xuICBjb25zdHJ1Y3RvcihjYXBhY2l0eTogbnVtYmVyKSB7XG4gICAgdGhpcy5jYXBhY2l0eSA9IGNhcGFjaXR5O1xuICAgIHRoaXMuYXZhaWxhYmxlID0gY2FwYWNpdHk7XG4gIH1cblxuICAvKipcbiAgICogQWNxdWlyZXMgYSBzZW1hcGhvcmUsIGJsb2NraW5nIGlmIG5lY2Vzc2FyeSB1bnRpbCBvbmUgaXMgYXZhaWxhYmxlLlxuICAgKiBAcmV0dXJucyB7UHJvbWlzZTx2b2lkPn0gQSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2hlbiB0aGUgc2VtYXBob3JlIGlzIGFjcXVpcmVkLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBjb25zdCBzZW1hID0gbmV3IFNlbWFwaG9yZSgxKTtcbiAgICpcbiAgICogYXN5bmMgZnVuY3Rpb24gY3JpdGljYWxTZWN0aW9uKCkge1xuICAgKiAgIGF3YWl0IHNlbWEuYWNxdWlyZSgpO1xuICAgKiAgIHRyeSB7XG4gICAqICAgICAvLyBUaGlzIGNvZGUgc2VjdGlvbiBjYW5ub3QgYmUgZXhlY3V0ZWQgc2ltdWx0YW5lb3VzbHlcbiAgICogICB9IGZpbmFsbHkge1xuICAgKiAgICAgc2VtYS5yZWxlYXNlKCk7XG4gICAqICAgfVxuICAgKiB9XG4gICAqL1xuICBhc3luYyBhY3F1aXJlKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGlmICh0aGlzLmF2YWlsYWJsZSA+IDApIHtcbiAgICAgIHRoaXMuYXZhaWxhYmxlLS07XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4ge1xuICAgICAgdGhpcy5kZWZlcnJlZFRhc2tzLnB1c2gocmVzb2x2ZSk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogUmVsZWFzZXMgYSBzZW1hcGhvcmUsIGFsbG93aW5nIG9uZSBtb3JlIG9wZXJhdGlvbiB0byBwcm9jZWVkLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBjb25zdCBzZW1hID0gbmV3IFNlbWFwaG9yZSgxKTtcbiAgICpcbiAgICogYXN5bmMgZnVuY3Rpb24gdGFzaygpIHtcbiAgICogICBhd2FpdCBzZW1hLmFjcXVpcmUoKTtcbiAgICogICB0cnkge1xuICAgKiAgICAgLy8gVGhpcyBjb2RlIGNhbiBvbmx5IGJlIGV4ZWN1dGVkIGJ5IHR3byB0YXNrcyBhdCB0aGUgc2FtZSB0aW1lXG4gICAqICAgfSBmaW5hbGx5IHtcbiAgICogICAgIHNlbWEucmVsZWFzZSgpOyAvLyBBbGxvd3MgYW5vdGhlciB3YWl0aW5nIHRhc2sgdG8gcHJvY2VlZC5cbiAgICogICB9XG4gICAqIH1cbiAgICovXG4gIHJlbGVhc2UoKTogdm9pZCB7XG4gICAgY29uc3QgZGVmZXJyZWRUYXNrID0gdGhpcy5kZWZlcnJlZFRhc2tzLnNoaWZ0KCk7XG5cbiAgICBpZiAoZGVmZXJyZWRUYXNrICE9IG51bGwpIHtcbiAgICAgIGRlZmVycmVkVGFzaygpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmF2YWlsYWJsZSA8IHRoaXMuY2FwYWNpdHkpIHtcbiAgICAgIHRoaXMuYXZhaWxhYmxlKys7XG4gICAgfVxuICB9XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQXdCQyxHQUNELE9BQU8sTUFBTTtFQUNYOzs7R0FHQyxHQUNELEFBQU8sU0FBaUI7RUFFeEI7OztHQUdDLEdBQ0QsQUFBTyxVQUFrQjtFQUNqQixnQkFBbUMsRUFBRSxDQUFDO0VBRTlDOzs7Ozs7R0FNQyxHQUNELFlBQVksUUFBZ0IsQ0FBRTtJQUM1QixJQUFJLENBQUMsUUFBUSxHQUFHO0lBQ2hCLElBQUksQ0FBQyxTQUFTLEdBQUc7RUFDbkI7RUFFQTs7Ozs7Ozs7Ozs7Ozs7O0dBZUMsR0FDRCxNQUFNLFVBQXlCO0lBQzdCLElBQUksSUFBSSxDQUFDLFNBQVMsR0FBRyxHQUFHO01BQ3RCLElBQUksQ0FBQyxTQUFTO01BQ2Q7SUFDRjtJQUVBLE9BQU8sSUFBSSxRQUFjLENBQUE7TUFDdkIsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUM7SUFDMUI7RUFDRjtFQUVBOzs7Ozs7Ozs7Ozs7OztHQWNDLEdBQ0QsVUFBZ0I7SUFDZCxNQUFNLGVBQWUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLO0lBRTdDLElBQUksZ0JBQWdCLE1BQU07TUFDeEI7TUFDQTtJQUNGO0lBRUEsSUFBSSxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxRQUFRLEVBQUU7TUFDbEMsSUFBSSxDQUFDLFNBQVM7SUFDaEI7RUFDRjtBQUNGIn0=
// denoCacheMetadata=12650498207050728242,17041212722854222775