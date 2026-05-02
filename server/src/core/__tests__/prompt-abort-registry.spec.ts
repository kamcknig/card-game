import { assertEquals, assertInstanceOf } from '@std/assert';
import { PromptAbortRegistry, UndoAbortError } from '../undo/prompt-abort-registry.ts';

// --- UndoAbortError ---

Deno.test('UndoAbortError is an instance of Error', () => {
  const err = new UndoAbortError();
  assertInstanceOf(err, Error);
});

Deno.test("UndoAbortError.name is 'UndoAbortError'", () => {
  assertEquals(new UndoAbortError().name, 'UndoAbortError');
});

Deno.test("UndoAbortError.message is 'undo: action aborted'", () => {
  assertEquals(new UndoAbortError().message, 'undo: action aborted');
});

// --- PromptAbortRegistry.hasInFlight ---

Deno.test('PromptAbortRegistry.hasInFlight returns false on a fresh registry', () => {
  const registry = new PromptAbortRegistry();
  assertEquals(registry.hasInFlight(), false);
});

Deno.test('PromptAbortRegistry.hasInFlight returns true after registering a rejecter', () => {
  const registry = new PromptAbortRegistry();
  registry.register('sig-1', () => {});
  assertEquals(registry.hasInFlight(), true);
});

Deno.test('PromptAbortRegistry.hasInFlight returns false after the returned unregister fn is called', () => {
  const registry = new PromptAbortRegistry();
  const unregister = registry.register('sig-1', () => {});
  unregister();
  assertEquals(registry.hasInFlight(), false);
});

// --- PromptAbortRegistry.register / unregister ---

Deno.test('PromptAbortRegistry unregister removes only its own rejecter', () => {
  const registry = new PromptAbortRegistry();
  const unregister = registry.register('sig-a', () => {});
  registry.register('sig-b', () => {});

  unregister(); // removes only sig-a

  assertEquals(registry.hasInFlight(), true);
});

Deno.test('PromptAbortRegistry.register with duplicate signalId overwrites the previous rejecter', () => {
  const registry = new PromptAbortRegistry();
  const firstCalls: unknown[] = [];
  const secondCalls: unknown[] = [];

  registry.register('dup', (err) => firstCalls.push(err));
  registry.register('dup', (err) => secondCalls.push(err));
  registry.abortAll();

  assertEquals(firstCalls.length, 0);
  assertEquals(secondCalls.length, 1);
});

// --- PromptAbortRegistry.abortAll ---

Deno.test('PromptAbortRegistry.abortAll calls every registered rejecter with an UndoAbortError', () => {
  const registry = new PromptAbortRegistry();
  const errors: unknown[] = [];
  registry.register('sig-1', (err) => errors.push(err));
  registry.register('sig-2', (err) => errors.push(err));

  registry.abortAll();

  assertEquals(errors.length, 2);
  assertInstanceOf(errors[0], UndoAbortError);
  assertInstanceOf(errors[1], UndoAbortError);
});

Deno.test('PromptAbortRegistry.abortAll clears the pending map so hasInFlight returns false', () => {
  const registry = new PromptAbortRegistry();
  registry.register('sig-1', () => {});

  registry.abortAll();

  assertEquals(registry.hasInFlight(), false);
});

Deno.test('PromptAbortRegistry.abortAll on an empty registry is a no-op', () => {
  const registry = new PromptAbortRegistry();
  registry.abortAll();
  assertEquals(registry.hasInFlight(), false);
});

Deno.test('PromptAbortRegistry.abortAll called a second time does not double-reject', () => {
  const registry = new PromptAbortRegistry();
  const calls: number[] = [];
  registry.register('sig-1', () => calls.push(1));

  registry.abortAll();
  registry.abortAll(); // second call should find an empty map

  assertEquals(calls.length, 1);
});
