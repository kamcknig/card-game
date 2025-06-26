import { Semaphore } from './semaphore.ts';
/**
 * A Mutex (mutual exclusion lock) for async functions.
 * It allows only one async task to access a critical section at a time.
 *
 * @example
 * const mutex = new Mutex();
 *
 * async function criticalSection() {
 *   await mutex.acquire();
 *   try {
 *     // This code section cannot be executed simultaneously
 *   } finally {
 *     mutex.release();
 *   }
 * }
 *
 * criticalSection();
 * criticalSection(); // This call will wait until the first call releases the mutex.
 */ export class Mutex {
  semaphore = new Semaphore(1);
  /**
   * Checks if the mutex is currently locked.
   * @returns {boolean} True if the mutex is locked, false otherwise.
   *
   * @example
   * const mutex = new Mutex();
   * console.log(mutex.isLocked); // false
   * await mutex.acquire();
   * console.log(mutex.isLocked); // true
   * mutex.release();
   * console.log(mutex.isLocked); // false
   */ get isLocked() {
    return this.semaphore.available === 0;
  }
  /**
   * Acquires the mutex, blocking if necessary until it is available.
   * @returns {Promise<void>} A promise that resolves when the mutex is acquired.
   *
   * @example
   * const mutex = new Mutex();
   * await mutex.acquire();
   * try {
   *   // This code section cannot be executed simultaneously
   * } finally {
   *   mutex.release();
   * }
   */ async acquire() {
    return this.semaphore.acquire();
  }
  /**
   * Releases the mutex, allowing another waiting task to proceed.
   *
   * @example
   * const mutex = new Mutex();
   * await mutex.acquire();
   * try {
   *   // This code section cannot be executed simultaneously
   * } finally {
   *   mutex.release(); // Allows another waiting task to proceed.
   * }
   */ release() {
    this.semaphore.release();
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9wcm9taXNlL211dGV4LnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFNlbWFwaG9yZSB9IGZyb20gJy4vc2VtYXBob3JlLnRzJztcblxuLyoqXG4gKiBBIE11dGV4IChtdXR1YWwgZXhjbHVzaW9uIGxvY2spIGZvciBhc3luYyBmdW5jdGlvbnMuXG4gKiBJdCBhbGxvd3Mgb25seSBvbmUgYXN5bmMgdGFzayB0byBhY2Nlc3MgYSBjcml0aWNhbCBzZWN0aW9uIGF0IGEgdGltZS5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgbXV0ZXggPSBuZXcgTXV0ZXgoKTtcbiAqXG4gKiBhc3luYyBmdW5jdGlvbiBjcml0aWNhbFNlY3Rpb24oKSB7XG4gKiAgIGF3YWl0IG11dGV4LmFjcXVpcmUoKTtcbiAqICAgdHJ5IHtcbiAqICAgICAvLyBUaGlzIGNvZGUgc2VjdGlvbiBjYW5ub3QgYmUgZXhlY3V0ZWQgc2ltdWx0YW5lb3VzbHlcbiAqICAgfSBmaW5hbGx5IHtcbiAqICAgICBtdXRleC5yZWxlYXNlKCk7XG4gKiAgIH1cbiAqIH1cbiAqXG4gKiBjcml0aWNhbFNlY3Rpb24oKTtcbiAqIGNyaXRpY2FsU2VjdGlvbigpOyAvLyBUaGlzIGNhbGwgd2lsbCB3YWl0IHVudGlsIHRoZSBmaXJzdCBjYWxsIHJlbGVhc2VzIHRoZSBtdXRleC5cbiAqL1xuZXhwb3J0IGNsYXNzIE11dGV4IHtcbiAgcHJpdmF0ZSBzZW1hcGhvcmUgPSBuZXcgU2VtYXBob3JlKDEpO1xuXG4gIC8qKlxuICAgKiBDaGVja3MgaWYgdGhlIG11dGV4IGlzIGN1cnJlbnRseSBsb2NrZWQuXG4gICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHRoZSBtdXRleCBpcyBsb2NrZWQsIGZhbHNlIG90aGVyd2lzZS5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogY29uc3QgbXV0ZXggPSBuZXcgTXV0ZXgoKTtcbiAgICogY29uc29sZS5sb2cobXV0ZXguaXNMb2NrZWQpOyAvLyBmYWxzZVxuICAgKiBhd2FpdCBtdXRleC5hY3F1aXJlKCk7XG4gICAqIGNvbnNvbGUubG9nKG11dGV4LmlzTG9ja2VkKTsgLy8gdHJ1ZVxuICAgKiBtdXRleC5yZWxlYXNlKCk7XG4gICAqIGNvbnNvbGUubG9nKG11dGV4LmlzTG9ja2VkKTsgLy8gZmFsc2VcbiAgICovXG4gIGdldCBpc0xvY2tlZCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5zZW1hcGhvcmUuYXZhaWxhYmxlID09PSAwO1xuICB9XG5cbiAgLyoqXG4gICAqIEFjcXVpcmVzIHRoZSBtdXRleCwgYmxvY2tpbmcgaWYgbmVjZXNzYXJ5IHVudGlsIGl0IGlzIGF2YWlsYWJsZS5cbiAgICogQHJldHVybnMge1Byb21pc2U8dm9pZD59IEEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHdoZW4gdGhlIG11dGV4IGlzIGFjcXVpcmVkLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBjb25zdCBtdXRleCA9IG5ldyBNdXRleCgpO1xuICAgKiBhd2FpdCBtdXRleC5hY3F1aXJlKCk7XG4gICAqIHRyeSB7XG4gICAqICAgLy8gVGhpcyBjb2RlIHNlY3Rpb24gY2Fubm90IGJlIGV4ZWN1dGVkIHNpbXVsdGFuZW91c2x5XG4gICAqIH0gZmluYWxseSB7XG4gICAqICAgbXV0ZXgucmVsZWFzZSgpO1xuICAgKiB9XG4gICAqL1xuICBhc3luYyBhY3F1aXJlKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHJldHVybiB0aGlzLnNlbWFwaG9yZS5hY3F1aXJlKCk7XG4gIH1cblxuICAvKipcbiAgICogUmVsZWFzZXMgdGhlIG11dGV4LCBhbGxvd2luZyBhbm90aGVyIHdhaXRpbmcgdGFzayB0byBwcm9jZWVkLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBjb25zdCBtdXRleCA9IG5ldyBNdXRleCgpO1xuICAgKiBhd2FpdCBtdXRleC5hY3F1aXJlKCk7XG4gICAqIHRyeSB7XG4gICAqICAgLy8gVGhpcyBjb2RlIHNlY3Rpb24gY2Fubm90IGJlIGV4ZWN1dGVkIHNpbXVsdGFuZW91c2x5XG4gICAqIH0gZmluYWxseSB7XG4gICAqICAgbXV0ZXgucmVsZWFzZSgpOyAvLyBBbGxvd3MgYW5vdGhlciB3YWl0aW5nIHRhc2sgdG8gcHJvY2VlZC5cbiAgICogfVxuICAgKi9cbiAgcmVsZWFzZSgpOiB2b2lkIHtcbiAgICB0aGlzLnNlbWFwaG9yZS5yZWxlYXNlKCk7XG4gIH1cbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLFNBQVMsUUFBUSxpQkFBaUI7QUFFM0M7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQWtCQyxHQUNELE9BQU8sTUFBTTtFQUNILFlBQVksSUFBSSxVQUFVLEdBQUc7RUFFckM7Ozs7Ozs7Ozs7O0dBV0MsR0FDRCxJQUFJLFdBQW9CO0lBQ3RCLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLEtBQUs7RUFDdEM7RUFFQTs7Ozs7Ozs7Ozs7O0dBWUMsR0FDRCxNQUFNLFVBQXlCO0lBQzdCLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPO0VBQy9CO0VBRUE7Ozs7Ozs7Ozs7O0dBV0MsR0FDRCxVQUFnQjtJQUNkLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTztFQUN4QjtBQUNGIn0=
// denoCacheMetadata=13556678288300853381,5505320138974911235