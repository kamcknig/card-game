/**
 * # Event
 *
 * Strictly typed event emitter with {@link Symbol.asyncIterator} support.
 *
 * Events should be defined as a literal object type where the key is the event
 * name, and the value is a tuple with any amount of elements of any type.
 *
 * The constructor takes an optional argument which defines the maximum amount of
 * listeners per event, which defaults to 10. If this limit is surpassed, an error
 * is thrown.
 *
 * ---
 *
 * > ⚠️ Events must be a type, and can't be an interface due to their design
 * > differences.
 *
 * ---
 *
 * @example
 *
 * ```ts
 * type Events = {
 *   foo: [string];
 *   bar: [number, boolean];
 * };
 *
 * class MyClass extends EventEmitter<Events> {}
 * const MyClassInstance = new MyClass();
 *
 * function listener(num, bool) {}
 *
 * // add a listener to the bar event
 * MyClassInstance.on("bar", listener);
 *
 * // remove a listener from the bar event
 * MyClassInstance.off("bar", listener);
 *
 * // remove all listeners from the bar event
 * MyClassInstance.off("bar");
 *
 * // remove all listeners from the event emitter
 * MyClassInstance.off();
 *
 * // add a one-time listener to the bar event
 * MyClassInstance.once("bar", listener);
 *
 * // on, once, and off are chainable
 * MyClassInstance.on("bar", listener).off("bar", listener);
 *
 * // emit the bar event with the wanted data
 * MyClassInstance.emit("bar", 42, true);
 *
 * // listen to all events with an async iterator
 * for await (const event of MyClassInstance) {
 *   if (event.name === "bar") {
 *     // event.value is of type [number, boolean]
 *   }
 * }
 *
 * // listen to a specific event with an async iterator
 * for await (const [num, bool] of MyClassInstance.on("bar")) {
 * }
 *
 * // removes all listeners and closes async iterators
 * MyClassInstance.close("bar");
 * ```
 *
 * @module
 */ // Copyright 2020-present the denosaurs team. All rights reserved. MIT license.
var _computedKey;
const isNullish = (value)=>value === null || value === undefined;
_computedKey = Symbol.asyncIterator;
/**
 * Strictly typed event emitter base class with {@link Symbol.asyncIterator} support.
 * 
 * @example
 *
 * ```ts
 * type Events = {
 *   foo: [string];
 *   bar: [number, boolean];
 * };
 *
 * class MyClass extends EventEmitter<Events> {}
 * const MyClassInstance = new MyClass();
 *
 * function listener(num, bool) {}
 *
 * // add a listener to the bar event
 * MyClassInstance.on("bar", listener);
 *
 * // remove a listener from the bar event
 * MyClassInstance.off("bar", listener);
 *
 * // remove all listeners from the bar event
 * MyClassInstance.off("bar");
 *
 * // remove all listeners from the event emitter
 * MyClassInstance.off();
 *
 * // add a one-time listener to the bar event
 * MyClassInstance.once("bar", listener);
 *
 * // on, once, and off are chainable
 * MyClassInstance.on("bar", listener).off("bar", listener);
 *
 * // emit the bar event with the wanted data
 * MyClassInstance.emit("bar", 42, true);
 *
 * // listen to all events with an async iterator
 * for await (const event of MyClassInstance) {
 *   if (event.name === "bar") {
 *     // event.value is of type [number, boolean]
 *   }
 * }
 *
 * // listen to a specific event with an async iterator
 * for await (const [num, bool] of MyClassInstance.on("bar")) {
 * }
 *
 * // removes all listeners and closes async iterators
 * MyClassInstance.close("bar");
 * ```
 */ export class EventEmitter {
  #listeners = {};
  #globalWriters = [];
  #onWriters = {};
  #limit;
  /**
   * @param maxListenersPerEvent - if set to 0, no limit is applied. defaults to 10
   */ constructor(maxListenersPerEvent){
    this.#limit = maxListenersPerEvent ?? 10;
  }
  on(eventName, listener) {
    if (listener) {
      if (!this.#listeners[eventName]) {
        this.#listeners[eventName] = [];
      }
      if (this.#limit !== 0 && this.#listeners[eventName].length >= this.#limit) {
        throw new TypeError("Listeners limit reached: limit is " + this.#limit);
      }
      this.#listeners[eventName].push({
        once: false,
        cb: listener
      });
      return this;
    } else {
      if (!this.#onWriters[eventName]) {
        this.#onWriters[eventName] = [];
      }
      if (this.#limit !== 0 && this.#onWriters[eventName].length >= this.#limit) {
        throw new TypeError("Listeners limit reached: limit is " + this.#limit);
      }
      const { readable, writable } = new TransformStream();
      this.#onWriters[eventName].push(writable.getWriter());
      return readable[Symbol.asyncIterator]();
    }
  }
  once(eventName, listener) {
    if (!this.#listeners[eventName]) {
      this.#listeners[eventName] = [];
    }
    if (this.#limit !== 0 && this.#listeners[eventName].length >= this.#limit) {
      throw new TypeError("Listeners limit reached: limit is " + this.#limit);
    }
    if (listener) {
      this.#listeners[eventName].push({
        once: true,
        cb: listener
      });
      return this;
    } else {
      return new Promise((res)=>{
        this.#listeners[eventName].push({
          once: true,
          cb: (...args)=>res(args)
        });
      });
    }
  }
  /**
   * Removes the listener from eventName.
   * If no listener is passed, all listeners will be removed from eventName,
   * this includes async listeners.
   * If no eventName is passed, all listeners will be removed from the EventEmitter,
   * including the async iterator for the class
   */ async off(eventName, listener) {
    if (!isNullish(eventName)) {
      if (listener) {
        this.#listeners[eventName] = this.#listeners[eventName]?.filter(({ cb })=>cb !== listener);
      } else {
        if (this.#onWriters[eventName]) {
          for (const writer of this.#onWriters[eventName]){
            await writer.close();
          }
          delete this.#onWriters[eventName];
        }
        delete this.#listeners[eventName];
      }
    } else {
      for (const writers of Object.values(this.#onWriters)){
        for (const writer of writers){
          await writer.close();
        }
      }
      this.#onWriters = {};
      for (const writer of this.#globalWriters){
        await writer.close();
      }
      this.#globalWriters = [];
      this.#listeners = {};
    }
    return this;
  }
  /**
   * Synchronously calls each of the listeners registered for the event named
   * eventName, in the order they were registered, passing the supplied
   * arguments to each.
   */ async emit(eventName, ...args) {
    const listeners = this.#listeners[eventName]?.slice() ?? [];
    for (const { cb, once } of listeners){
      cb(...args);
      if (once) {
        this.off(eventName, cb);
      }
    }
    if (this.#onWriters[eventName]) {
      for (const writer of this.#onWriters[eventName]){
        await writer.write(args);
      }
    }
    for (const writer of this.#globalWriters){
      await writer.write({
        name: eventName,
        value: args
      });
    }
  }
  [_computedKey]() {
    if (this.#limit !== 0 && this.#globalWriters.length >= this.#limit) {
      throw new TypeError("Listeners limit reached: limit is " + this.#limit);
    }
    const { readable, writable } = new TransformStream();
    this.#globalWriters.push(writable.getWriter());
    return readable[Symbol.asyncIterator]();
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0BkZW5vc2F1cnMvZXZlbnQvMi4wLjIvbW9kLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogIyBFdmVudFxuICpcbiAqIFN0cmljdGx5IHR5cGVkIGV2ZW50IGVtaXR0ZXIgd2l0aCB7QGxpbmsgU3ltYm9sLmFzeW5jSXRlcmF0b3J9IHN1cHBvcnQuXG4gKlxuICogRXZlbnRzIHNob3VsZCBiZSBkZWZpbmVkIGFzIGEgbGl0ZXJhbCBvYmplY3QgdHlwZSB3aGVyZSB0aGUga2V5IGlzIHRoZSBldmVudFxuICogbmFtZSwgYW5kIHRoZSB2YWx1ZSBpcyBhIHR1cGxlIHdpdGggYW55IGFtb3VudCBvZiBlbGVtZW50cyBvZiBhbnkgdHlwZS5cbiAqXG4gKiBUaGUgY29uc3RydWN0b3IgdGFrZXMgYW4gb3B0aW9uYWwgYXJndW1lbnQgd2hpY2ggZGVmaW5lcyB0aGUgbWF4aW11bSBhbW91bnQgb2ZcbiAqIGxpc3RlbmVycyBwZXIgZXZlbnQsIHdoaWNoIGRlZmF1bHRzIHRvIDEwLiBJZiB0aGlzIGxpbWl0IGlzIHN1cnBhc3NlZCwgYW4gZXJyb3JcbiAqIGlzIHRocm93bi5cbiAqXG4gKiAtLS1cbiAqXG4gKiA+IOKaoO+4jyBFdmVudHMgbXVzdCBiZSBhIHR5cGUsIGFuZCBjYW4ndCBiZSBhbiBpbnRlcmZhY2UgZHVlIHRvIHRoZWlyIGRlc2lnblxuICogPiBkaWZmZXJlbmNlcy5cbiAqXG4gKiAtLS1cbiAqXG4gKiBAZXhhbXBsZVxuICpcbiAqIGBgYHRzXG4gKiB0eXBlIEV2ZW50cyA9IHtcbiAqICAgZm9vOiBbc3RyaW5nXTtcbiAqICAgYmFyOiBbbnVtYmVyLCBib29sZWFuXTtcbiAqIH07XG4gKlxuICogY2xhc3MgTXlDbGFzcyBleHRlbmRzIEV2ZW50RW1pdHRlcjxFdmVudHM+IHt9XG4gKiBjb25zdCBNeUNsYXNzSW5zdGFuY2UgPSBuZXcgTXlDbGFzcygpO1xuICpcbiAqIGZ1bmN0aW9uIGxpc3RlbmVyKG51bSwgYm9vbCkge31cbiAqXG4gKiAvLyBhZGQgYSBsaXN0ZW5lciB0byB0aGUgYmFyIGV2ZW50XG4gKiBNeUNsYXNzSW5zdGFuY2Uub24oXCJiYXJcIiwgbGlzdGVuZXIpO1xuICpcbiAqIC8vIHJlbW92ZSBhIGxpc3RlbmVyIGZyb20gdGhlIGJhciBldmVudFxuICogTXlDbGFzc0luc3RhbmNlLm9mZihcImJhclwiLCBsaXN0ZW5lcik7XG4gKlxuICogLy8gcmVtb3ZlIGFsbCBsaXN0ZW5lcnMgZnJvbSB0aGUgYmFyIGV2ZW50XG4gKiBNeUNsYXNzSW5zdGFuY2Uub2ZmKFwiYmFyXCIpO1xuICpcbiAqIC8vIHJlbW92ZSBhbGwgbGlzdGVuZXJzIGZyb20gdGhlIGV2ZW50IGVtaXR0ZXJcbiAqIE15Q2xhc3NJbnN0YW5jZS5vZmYoKTtcbiAqXG4gKiAvLyBhZGQgYSBvbmUtdGltZSBsaXN0ZW5lciB0byB0aGUgYmFyIGV2ZW50XG4gKiBNeUNsYXNzSW5zdGFuY2Uub25jZShcImJhclwiLCBsaXN0ZW5lcik7XG4gKlxuICogLy8gb24sIG9uY2UsIGFuZCBvZmYgYXJlIGNoYWluYWJsZVxuICogTXlDbGFzc0luc3RhbmNlLm9uKFwiYmFyXCIsIGxpc3RlbmVyKS5vZmYoXCJiYXJcIiwgbGlzdGVuZXIpO1xuICpcbiAqIC8vIGVtaXQgdGhlIGJhciBldmVudCB3aXRoIHRoZSB3YW50ZWQgZGF0YVxuICogTXlDbGFzc0luc3RhbmNlLmVtaXQoXCJiYXJcIiwgNDIsIHRydWUpO1xuICpcbiAqIC8vIGxpc3RlbiB0byBhbGwgZXZlbnRzIHdpdGggYW4gYXN5bmMgaXRlcmF0b3JcbiAqIGZvciBhd2FpdCAoY29uc3QgZXZlbnQgb2YgTXlDbGFzc0luc3RhbmNlKSB7XG4gKiAgIGlmIChldmVudC5uYW1lID09PSBcImJhclwiKSB7XG4gKiAgICAgLy8gZXZlbnQudmFsdWUgaXMgb2YgdHlwZSBbbnVtYmVyLCBib29sZWFuXVxuICogICB9XG4gKiB9XG4gKlxuICogLy8gbGlzdGVuIHRvIGEgc3BlY2lmaWMgZXZlbnQgd2l0aCBhbiBhc3luYyBpdGVyYXRvclxuICogZm9yIGF3YWl0IChjb25zdCBbbnVtLCBib29sXSBvZiBNeUNsYXNzSW5zdGFuY2Uub24oXCJiYXJcIikpIHtcbiAqIH1cbiAqXG4gKiAvLyByZW1vdmVzIGFsbCBsaXN0ZW5lcnMgYW5kIGNsb3NlcyBhc3luYyBpdGVyYXRvcnNcbiAqIE15Q2xhc3NJbnN0YW5jZS5jbG9zZShcImJhclwiKTtcbiAqIGBgYFxuICpcbiAqIEBtb2R1bGVcbiAqL1xuXG4vLyBDb3B5cmlnaHQgMjAyMC1wcmVzZW50IHRoZSBkZW5vc2F1cnMgdGVhbS4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG5cbnR5cGUgRW50cnk8RSwgSyBleHRlbmRzIGtleW9mIEU+ID0ge1xuICBuYW1lOiBLO1xuICB2YWx1ZTogRVtLXTtcbn07XG5cbmNvbnN0IGlzTnVsbGlzaCA9ICh2YWx1ZTogdW5rbm93bik6IHZhbHVlIGlzIG51bGwgfCB1bmRlZmluZWQgPT5cbiAgdmFsdWUgPT09IG51bGwgfHwgdmFsdWUgPT09IHVuZGVmaW5lZDtcblxuLyoqXG4gKiBTdHJpY3RseSB0eXBlZCBldmVudCBlbWl0dGVyIGJhc2UgY2xhc3Mgd2l0aCB7QGxpbmsgU3ltYm9sLmFzeW5jSXRlcmF0b3J9IHN1cHBvcnQuXG4gKiBcbiAqIEBleGFtcGxlXG4gKlxuICogYGBgdHNcbiAqIHR5cGUgRXZlbnRzID0ge1xuICogICBmb286IFtzdHJpbmddO1xuICogICBiYXI6IFtudW1iZXIsIGJvb2xlYW5dO1xuICogfTtcbiAqXG4gKiBjbGFzcyBNeUNsYXNzIGV4dGVuZHMgRXZlbnRFbWl0dGVyPEV2ZW50cz4ge31cbiAqIGNvbnN0IE15Q2xhc3NJbnN0YW5jZSA9IG5ldyBNeUNsYXNzKCk7XG4gKlxuICogZnVuY3Rpb24gbGlzdGVuZXIobnVtLCBib29sKSB7fVxuICpcbiAqIC8vIGFkZCBhIGxpc3RlbmVyIHRvIHRoZSBiYXIgZXZlbnRcbiAqIE15Q2xhc3NJbnN0YW5jZS5vbihcImJhclwiLCBsaXN0ZW5lcik7XG4gKlxuICogLy8gcmVtb3ZlIGEgbGlzdGVuZXIgZnJvbSB0aGUgYmFyIGV2ZW50XG4gKiBNeUNsYXNzSW5zdGFuY2Uub2ZmKFwiYmFyXCIsIGxpc3RlbmVyKTtcbiAqXG4gKiAvLyByZW1vdmUgYWxsIGxpc3RlbmVycyBmcm9tIHRoZSBiYXIgZXZlbnRcbiAqIE15Q2xhc3NJbnN0YW5jZS5vZmYoXCJiYXJcIik7XG4gKlxuICogLy8gcmVtb3ZlIGFsbCBsaXN0ZW5lcnMgZnJvbSB0aGUgZXZlbnQgZW1pdHRlclxuICogTXlDbGFzc0luc3RhbmNlLm9mZigpO1xuICpcbiAqIC8vIGFkZCBhIG9uZS10aW1lIGxpc3RlbmVyIHRvIHRoZSBiYXIgZXZlbnRcbiAqIE15Q2xhc3NJbnN0YW5jZS5vbmNlKFwiYmFyXCIsIGxpc3RlbmVyKTtcbiAqXG4gKiAvLyBvbiwgb25jZSwgYW5kIG9mZiBhcmUgY2hhaW5hYmxlXG4gKiBNeUNsYXNzSW5zdGFuY2Uub24oXCJiYXJcIiwgbGlzdGVuZXIpLm9mZihcImJhclwiLCBsaXN0ZW5lcik7XG4gKlxuICogLy8gZW1pdCB0aGUgYmFyIGV2ZW50IHdpdGggdGhlIHdhbnRlZCBkYXRhXG4gKiBNeUNsYXNzSW5zdGFuY2UuZW1pdChcImJhclwiLCA0MiwgdHJ1ZSk7XG4gKlxuICogLy8gbGlzdGVuIHRvIGFsbCBldmVudHMgd2l0aCBhbiBhc3luYyBpdGVyYXRvclxuICogZm9yIGF3YWl0IChjb25zdCBldmVudCBvZiBNeUNsYXNzSW5zdGFuY2UpIHtcbiAqICAgaWYgKGV2ZW50Lm5hbWUgPT09IFwiYmFyXCIpIHtcbiAqICAgICAvLyBldmVudC52YWx1ZSBpcyBvZiB0eXBlIFtudW1iZXIsIGJvb2xlYW5dXG4gKiAgIH1cbiAqIH1cbiAqXG4gKiAvLyBsaXN0ZW4gdG8gYSBzcGVjaWZpYyBldmVudCB3aXRoIGFuIGFzeW5jIGl0ZXJhdG9yXG4gKiBmb3IgYXdhaXQgKGNvbnN0IFtudW0sIGJvb2xdIG9mIE15Q2xhc3NJbnN0YW5jZS5vbihcImJhclwiKSkge1xuICogfVxuICpcbiAqIC8vIHJlbW92ZXMgYWxsIGxpc3RlbmVycyBhbmQgY2xvc2VzIGFzeW5jIGl0ZXJhdG9yc1xuICogTXlDbGFzc0luc3RhbmNlLmNsb3NlKFwiYmFyXCIpO1xuICogYGBgXG4gKi9cbmV4cG9ydCBjbGFzcyBFdmVudEVtaXR0ZXI8RSBleHRlbmRzIFJlY29yZDxzdHJpbmcsIHVua25vd25bXT4+IHtcbiAgI2xpc3RlbmVyczoge1xuICAgIFtLIGluIGtleW9mIEVdPzogQXJyYXk8e1xuICAgICAgb25jZTogYm9vbGVhbjtcbiAgICAgIGNiOiAoLi4uYXJnczogRVtLXSkgPT4gdm9pZDtcbiAgICB9PjtcbiAgfSA9IHt9O1xuICAjZ2xvYmFsV3JpdGVyczogV3JpdGFibGVTdHJlYW1EZWZhdWx0V3JpdGVyPEVudHJ5PEUsIGtleW9mIEU+PltdID0gW107XG4gICNvbldyaXRlcnM6IHtcbiAgICBbSyBpbiBrZXlvZiBFXT86IFdyaXRhYmxlU3RyZWFtRGVmYXVsdFdyaXRlcjxFW0tdPltdO1xuICB9ID0ge307XG4gICNsaW1pdDogbnVtYmVyO1xuXG4gIC8qKlxuICAgKiBAcGFyYW0gbWF4TGlzdGVuZXJzUGVyRXZlbnQgLSBpZiBzZXQgdG8gMCwgbm8gbGltaXQgaXMgYXBwbGllZC4gZGVmYXVsdHMgdG8gMTBcbiAgICovXG4gIGNvbnN0cnVjdG9yKG1heExpc3RlbmVyc1BlckV2ZW50PzogbnVtYmVyKSB7XG4gICAgdGhpcy4jbGltaXQgPSBtYXhMaXN0ZW5lcnNQZXJFdmVudCA/PyAxMDtcbiAgfVxuXG4gIC8qKlxuICAgKiBBcHBlbmRzIHRoZSBsaXN0ZW5lciB0byB0aGUgbGlzdGVuZXJzIGFycmF5IG9mIHRoZSBjb3JyZXNwb25kaW5nIGV2ZW50TmFtZS5cbiAgICogTm8gY2hlY2tzIGFyZSBtYWRlIGlmIHRoZSBsaXN0ZW5lciB3YXMgYWxyZWFkeSBhZGRlZCwgc28gYWRkaW5nIG11bHRpcGxlXG4gICAqIGxpc3RlbmVycyB3aWxsIHJlc3VsdCBpbiB0aGUgbGlzdGVuZXIgYmVpbmcgY2FsbGVkIG11bHRpcGxlIHRpbWVzLlxuICAgKiBJZiBubyBsaXN0ZW5lciBpcyBwYXNzZWQsIGl0IHJldHVybnMgYW4gYXN5bmNJdGVyYXRvciB3aGljaCB3aWxsIGZpcmVcbiAgICogZXZlcnkgdGltZSBldmVudE5hbWUgaXMgZW1pdHRlZC5cbiAgICovXG4gIG9uPEsgZXh0ZW5kcyBrZXlvZiBFPihldmVudE5hbWU6IEssIGxpc3RlbmVyOiAoLi4uYXJnczogRVtLXSkgPT4gdm9pZCk6IHRoaXM7XG4gIG9uPEsgZXh0ZW5kcyBrZXlvZiBFPihldmVudE5hbWU6IEspOiBBc3luY0l0ZXJhYmxlSXRlcmF0b3I8RVtLXT47XG4gIG9uPEsgZXh0ZW5kcyBrZXlvZiBFPihcbiAgICBldmVudE5hbWU6IEssXG4gICAgbGlzdGVuZXI/OiAoLi4uYXJnczogRVtLXSkgPT4gdm9pZCxcbiAgKTogdGhpcyB8IEFzeW5jSXRlcmFibGVJdGVyYXRvcjxFW0tdPiB7XG4gICAgaWYgKGxpc3RlbmVyKSB7XG4gICAgICBpZiAoIXRoaXMuI2xpc3RlbmVyc1tldmVudE5hbWVdKSB7XG4gICAgICAgIHRoaXMuI2xpc3RlbmVyc1tldmVudE5hbWVdID0gW107XG4gICAgICB9XG4gICAgICBpZiAoXG4gICAgICAgIHRoaXMuI2xpbWl0ICE9PSAwICYmXG4gICAgICAgIHRoaXMuI2xpc3RlbmVyc1tldmVudE5hbWVdIS5sZW5ndGggPj0gdGhpcy4jbGltaXRcbiAgICAgICkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiTGlzdGVuZXJzIGxpbWl0IHJlYWNoZWQ6IGxpbWl0IGlzIFwiICsgdGhpcy4jbGltaXQpO1xuICAgICAgfVxuICAgICAgdGhpcy4jbGlzdGVuZXJzW2V2ZW50TmFtZV0hLnB1c2goe1xuICAgICAgICBvbmNlOiBmYWxzZSxcbiAgICAgICAgY2I6IGxpc3RlbmVyLFxuICAgICAgfSk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKCF0aGlzLiNvbldyaXRlcnNbZXZlbnROYW1lXSkge1xuICAgICAgICB0aGlzLiNvbldyaXRlcnNbZXZlbnROYW1lXSA9IFtdO1xuICAgICAgfVxuICAgICAgaWYgKFxuICAgICAgICB0aGlzLiNsaW1pdCAhPT0gMCAmJlxuICAgICAgICB0aGlzLiNvbldyaXRlcnNbZXZlbnROYW1lXSEubGVuZ3RoID49IHRoaXMuI2xpbWl0XG4gICAgICApIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkxpc3RlbmVycyBsaW1pdCByZWFjaGVkOiBsaW1pdCBpcyBcIiArIHRoaXMuI2xpbWl0KTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgeyByZWFkYWJsZSwgd3JpdGFibGUgfSA9IG5ldyBUcmFuc2Zvcm1TdHJlYW08RVtLXSwgRVtLXT4oKTtcbiAgICAgIHRoaXMuI29uV3JpdGVyc1tldmVudE5hbWVdIS5wdXNoKHdyaXRhYmxlLmdldFdyaXRlcigpKTtcbiAgICAgIHJldHVybiByZWFkYWJsZVtTeW1ib2wuYXN5bmNJdGVyYXRvcl0oKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQWRkcyBhIG9uZS10aW1lIGxpc3RlbmVyIGZ1bmN0aW9uIGZvciB0aGUgZXZlbnQgbmFtZWQgZXZlbnROYW1lLlxuICAgKiBUaGUgbmV4dCB0aW1lIGV2ZW50TmFtZSBpcyBlbWl0dGVkLCBsaXN0ZW5lciBpcyBjYWxsZWQgYW5kIHRoZW4gcmVtb3ZlZC5cbiAgICogSWYgbm8gbGlzdGVuZXIgaXMgcGFzc2VkLCBpdCByZXR1cm5zIGEgUHJvbWlzZSB0aGF0IHdpbGwgcmVzb2x2ZSBvbmNlXG4gICAqIGV2ZW50TmFtZSBpcyBlbWl0dGVkLlxuICAgKi9cbiAgb25jZTxLIGV4dGVuZHMga2V5b2YgRT4oXG4gICAgZXZlbnROYW1lOiBLLFxuICAgIGxpc3RlbmVyOiAoLi4uYXJnczogRVtLXSkgPT4gdm9pZCxcbiAgKTogdGhpcztcbiAgb25jZTxLIGV4dGVuZHMga2V5b2YgRT4oZXZlbnROYW1lOiBLKTogUHJvbWlzZTxFW0tdPjtcbiAgb25jZTxLIGV4dGVuZHMga2V5b2YgRT4oXG4gICAgZXZlbnROYW1lOiBLLFxuICAgIGxpc3RlbmVyPzogKC4uLmFyZ3M6IEVbS10pID0+IHZvaWQsXG4gICk6IHRoaXMgfCBQcm9taXNlPEVbS10+IHtcbiAgICBpZiAoIXRoaXMuI2xpc3RlbmVyc1tldmVudE5hbWVdKSB7XG4gICAgICB0aGlzLiNsaXN0ZW5lcnNbZXZlbnROYW1lXSA9IFtdO1xuICAgIH1cbiAgICBpZiAoXG4gICAgICB0aGlzLiNsaW1pdCAhPT0gMCAmJlxuICAgICAgdGhpcy4jbGlzdGVuZXJzW2V2ZW50TmFtZV0hLmxlbmd0aCA+PSB0aGlzLiNsaW1pdFxuICAgICkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkxpc3RlbmVycyBsaW1pdCByZWFjaGVkOiBsaW1pdCBpcyBcIiArIHRoaXMuI2xpbWl0KTtcbiAgICB9XG4gICAgaWYgKGxpc3RlbmVyKSB7XG4gICAgICB0aGlzLiNsaXN0ZW5lcnNbZXZlbnROYW1lXSEucHVzaCh7XG4gICAgICAgIG9uY2U6IHRydWUsXG4gICAgICAgIGNiOiBsaXN0ZW5lcixcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzKSA9PiB7XG4gICAgICAgIHRoaXMuI2xpc3RlbmVyc1tldmVudE5hbWVdIS5wdXNoKHtcbiAgICAgICAgICBvbmNlOiB0cnVlLFxuICAgICAgICAgIGNiOiAoLi4uYXJncykgPT4gcmVzKGFyZ3MpLFxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmVzIHRoZSBsaXN0ZW5lciBmcm9tIGV2ZW50TmFtZS5cbiAgICogSWYgbm8gbGlzdGVuZXIgaXMgcGFzc2VkLCBhbGwgbGlzdGVuZXJzIHdpbGwgYmUgcmVtb3ZlZCBmcm9tIGV2ZW50TmFtZSxcbiAgICogdGhpcyBpbmNsdWRlcyBhc3luYyBsaXN0ZW5lcnMuXG4gICAqIElmIG5vIGV2ZW50TmFtZSBpcyBwYXNzZWQsIGFsbCBsaXN0ZW5lcnMgd2lsbCBiZSByZW1vdmVkIGZyb20gdGhlIEV2ZW50RW1pdHRlcixcbiAgICogaW5jbHVkaW5nIHRoZSBhc3luYyBpdGVyYXRvciBmb3IgdGhlIGNsYXNzXG4gICAqL1xuICBhc3luYyBvZmY8SyBleHRlbmRzIGtleW9mIEU+KFxuICAgIGV2ZW50TmFtZT86IEssXG4gICAgbGlzdGVuZXI/OiAoLi4uYXJnczogRVtLXSkgPT4gdm9pZCxcbiAgKTogUHJvbWlzZTx0aGlzPiB7XG4gICAgaWYgKCFpc051bGxpc2goZXZlbnROYW1lKSkge1xuICAgICAgaWYgKGxpc3RlbmVyKSB7XG4gICAgICAgIHRoaXMuI2xpc3RlbmVyc1tldmVudE5hbWVdID0gdGhpcy4jbGlzdGVuZXJzW2V2ZW50TmFtZV0/LmZpbHRlcihcbiAgICAgICAgICAoeyBjYiB9KSA9PiBjYiAhPT0gbGlzdGVuZXIsXG4gICAgICAgICk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAodGhpcy4jb25Xcml0ZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgICBmb3IgKGNvbnN0IHdyaXRlciBvZiB0aGlzLiNvbldyaXRlcnNbZXZlbnROYW1lXSEpIHtcbiAgICAgICAgICAgIGF3YWl0IHdyaXRlci5jbG9zZSgpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBkZWxldGUgdGhpcy4jb25Xcml0ZXJzW2V2ZW50TmFtZV07XG4gICAgICAgIH1cblxuICAgICAgICBkZWxldGUgdGhpcy4jbGlzdGVuZXJzW2V2ZW50TmFtZV07XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGZvciAoXG4gICAgICAgIGNvbnN0IHdyaXRlcnMgb2YgT2JqZWN0LnZhbHVlcyhcbiAgICAgICAgICB0aGlzLiNvbldyaXRlcnMsXG4gICAgICAgICkgYXMgV3JpdGFibGVTdHJlYW1EZWZhdWx0V3JpdGVyPEVbS10+W11bXVxuICAgICAgKSB7XG4gICAgICAgIGZvciAoY29uc3Qgd3JpdGVyIG9mIHdyaXRlcnMpIHtcbiAgICAgICAgICBhd2FpdCB3cml0ZXIuY2xvc2UoKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhpcy4jb25Xcml0ZXJzID0ge307XG5cbiAgICAgIGZvciAoY29uc3Qgd3JpdGVyIG9mIHRoaXMuI2dsb2JhbFdyaXRlcnMpIHtcbiAgICAgICAgYXdhaXQgd3JpdGVyLmNsb3NlKCk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuI2dsb2JhbFdyaXRlcnMgPSBbXTtcbiAgICAgIHRoaXMuI2xpc3RlbmVycyA9IHt9O1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBTeW5jaHJvbm91c2x5IGNhbGxzIGVhY2ggb2YgdGhlIGxpc3RlbmVycyByZWdpc3RlcmVkIGZvciB0aGUgZXZlbnQgbmFtZWRcbiAgICogZXZlbnROYW1lLCBpbiB0aGUgb3JkZXIgdGhleSB3ZXJlIHJlZ2lzdGVyZWQsIHBhc3NpbmcgdGhlIHN1cHBsaWVkXG4gICAqIGFyZ3VtZW50cyB0byBlYWNoLlxuICAgKi9cbiAgYXN5bmMgZW1pdDxLIGV4dGVuZHMga2V5b2YgRT4oZXZlbnROYW1lOiBLLCAuLi5hcmdzOiBFW0tdKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgbGlzdGVuZXJzID0gdGhpcy4jbGlzdGVuZXJzW2V2ZW50TmFtZV0/LnNsaWNlKCkgPz8gW107XG4gICAgZm9yIChjb25zdCB7IGNiLCBvbmNlIH0gb2YgbGlzdGVuZXJzKSB7XG4gICAgICBjYiguLi5hcmdzKTtcblxuICAgICAgaWYgKG9uY2UpIHtcbiAgICAgICAgdGhpcy5vZmYoZXZlbnROYW1lLCBjYik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuI29uV3JpdGVyc1tldmVudE5hbWVdKSB7XG4gICAgICBmb3IgKGNvbnN0IHdyaXRlciBvZiB0aGlzLiNvbldyaXRlcnNbZXZlbnROYW1lXSEpIHtcbiAgICAgICAgYXdhaXQgd3JpdGVyLndyaXRlKGFyZ3MpO1xuICAgICAgfVxuICAgIH1cbiAgICBmb3IgKGNvbnN0IHdyaXRlciBvZiB0aGlzLiNnbG9iYWxXcml0ZXJzKSB7XG4gICAgICBhd2FpdCB3cml0ZXIud3JpdGUoe1xuICAgICAgICBuYW1lOiBldmVudE5hbWUsXG4gICAgICAgIHZhbHVlOiBhcmdzLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgW1N5bWJvbC5hc3luY0l0ZXJhdG9yXTxLIGV4dGVuZHMga2V5b2YgRT4oKTogQXN5bmNJdGVyYWJsZUl0ZXJhdG9yPFxuICAgIHsgW1YgaW4gS106IEVudHJ5PEUsIFY+IH1bS11cbiAgPiB7XG4gICAgaWYgKHRoaXMuI2xpbWl0ICE9PSAwICYmIHRoaXMuI2dsb2JhbFdyaXRlcnMubGVuZ3RoID49IHRoaXMuI2xpbWl0KSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiTGlzdGVuZXJzIGxpbWl0IHJlYWNoZWQ6IGxpbWl0IGlzIFwiICsgdGhpcy4jbGltaXQpO1xuICAgIH1cblxuICAgIGNvbnN0IHsgcmVhZGFibGUsIHdyaXRhYmxlIH0gPSBuZXcgVHJhbnNmb3JtU3RyZWFtPFxuICAgICAgRW50cnk8RSwgSz4sXG4gICAgICBFbnRyeTxFLCBLPlxuICAgID4oKTtcbiAgICB0aGlzLiNnbG9iYWxXcml0ZXJzLnB1c2god3JpdGFibGUuZ2V0V3JpdGVyKCkpO1xuICAgIHJldHVybiByZWFkYWJsZVtTeW1ib2wuYXN5bmNJdGVyYXRvcl0oKTtcbiAgfVxufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FxRUMsR0FFRCwrRUFBK0U7O0FBTy9FLE1BQU0sWUFBWSxDQUFDLFFBQ2pCLFVBQVUsUUFBUSxVQUFVO2VBMk8zQixPQUFPLGFBQWE7QUF6T3ZCOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7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
// denoCacheMetadata=13081416127154523393,18280418881395587572