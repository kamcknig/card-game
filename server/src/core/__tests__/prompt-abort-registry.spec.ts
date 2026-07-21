import { assertEquals, assertInstanceOf } from '@std/assert';
import { PendingPromptHandle, PromptAbortRegistry, UndoAbortError } from '../undo/prompt-abort-registry.ts';
import { AppSocket } from '@server-types/index.ts';

// Minimal fake socket recording on/off/emit calls, enough to exercise
// detach/reattach without pulling in real Socket.IO.
function makeFakeSocket() {
  const calls: { on: unknown[][]; off: unknown[][]; emit: unknown[][] } = { on: [], off: [], emit: [] };
  const socket = {
    on: (...callArgs: unknown[]) => {
      calls.on.push(callArgs);
    },
    off: (...callArgs: unknown[]) => {
      calls.off.push(callArgs);
    },
    emit: (...callArgs: unknown[]) => {
      calls.emit.push(callArgs);
    },
  } as unknown as AppSocket;
  return { socket, calls };
}

// Builds a pending-prompt handle with recorder-backed detach/reattach so
// tests can assert which handles were touched by abortAll/reattachForPlayer.
function makeHandle(
  overrides: Partial<PendingPromptHandle> & Pick<PendingPromptHandle, 'signalId' | 'playerId'>,
): { handle: PendingPromptHandle; detachCalls: number[]; reattachCalls: AppSocket[]; rejectCalls: unknown[] } {
  const detachCalls: number[] = [];
  const reattachCalls: AppSocket[] = [];
  const rejectCalls: unknown[] = [];
  const handle: PendingPromptHandle = {
    reject: (err: unknown) => rejectCalls.push(err),
    detach: () => detachCalls.push(1),
    reattach: (socket: AppSocket) => reattachCalls.push(socket),
    ...overrides,
  };
  return { handle, detachCalls, reattachCalls, rejectCalls };
}

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

Deno.test('PromptAbortRegistry.hasInFlight returns true after registering a handle', () => {
  const registry = new PromptAbortRegistry();
  const { handle } = makeHandle({ signalId: 'sig-1', playerId: 1 });
  registry.register(handle);
  assertEquals(registry.hasInFlight(), true);
});

Deno.test('PromptAbortRegistry.hasInFlight returns false after the returned unregister fn is called', () => {
  const registry = new PromptAbortRegistry();
  const { handle } = makeHandle({ signalId: 'sig-1', playerId: 1 });
  const unregister = registry.register(handle);
  unregister();
  assertEquals(registry.hasInFlight(), false);
});

// --- PromptAbortRegistry.register / unregister ---

Deno.test('PromptAbortRegistry unregister removes only its own handle', () => {
  const registry = new PromptAbortRegistry();
  const { handle: handleA } = makeHandle({ signalId: 'sig-a', playerId: 1 });
  const { handle: handleB } = makeHandle({ signalId: 'sig-b', playerId: 2 });
  const unregister = registry.register(handleA);
  registry.register(handleB);

  unregister(); // removes only sig-a

  assertEquals(registry.hasInFlight(), true);
  assertEquals(registry.getPendingEntries().length, 1);
  assertEquals(registry.getPendingEntries()[0].signalId, 'sig-b');
});

Deno.test('PromptAbortRegistry.register with duplicate signalId overwrites the previous handle', () => {
  const registry = new PromptAbortRegistry();
  const { handle: firstHandle, rejectCalls: firstCalls } = makeHandle({ signalId: 'dup', playerId: 1 });
  const { handle: secondHandle, rejectCalls: secondCalls } = makeHandle({ signalId: 'dup', playerId: 1 });

  registry.register(firstHandle);
  registry.register(secondHandle);
  registry.abortAll();

  assertEquals(firstCalls.length, 0);
  assertEquals(secondCalls.length, 1);
});

// --- PromptAbortRegistry.abortAll ---

Deno.test('PromptAbortRegistry.abortAll calls detach and reject(UndoAbortError) on every handle', () => {
  const registry = new PromptAbortRegistry();
  const { handle: handle1, detachCalls: detach1, rejectCalls: reject1 } = makeHandle({
    signalId: 'sig-1',
    playerId: 1,
  });
  const { handle: handle2, detachCalls: detach2, rejectCalls: reject2 } = makeHandle({
    signalId: 'sig-2',
    playerId: 2,
  });
  registry.register(handle1);
  registry.register(handle2);

  registry.abortAll();

  assertEquals(detach1.length, 1);
  assertEquals(detach2.length, 1);
  assertEquals(reject1.length, 1);
  assertEquals(reject2.length, 1);
  assertInstanceOf(reject1[0], UndoAbortError);
  assertInstanceOf(reject2[0], UndoAbortError);
});

Deno.test('PromptAbortRegistry.abortAll clears the pending map so hasInFlight returns false', () => {
  const registry = new PromptAbortRegistry();
  const { handle } = makeHandle({ signalId: 'sig-1', playerId: 1 });
  registry.register(handle);

  registry.abortAll();

  assertEquals(registry.hasInFlight(), false);
});

Deno.test('PromptAbortRegistry.abortAll on an empty registry is a no-op', () => {
  const registry = new PromptAbortRegistry();
  registry.abortAll();
  assertEquals(registry.hasInFlight(), false);
});

Deno.test('PromptAbortRegistry.abortAll called a second time does not double-reject or double-detach', () => {
  const registry = new PromptAbortRegistry();
  const { handle, detachCalls, rejectCalls } = makeHandle({ signalId: 'sig-1', playerId: 1 });
  registry.register(handle);

  registry.abortAll();
  registry.abortAll(); // second call should find an empty map

  assertEquals(rejectCalls.length, 1);
  assertEquals(detachCalls.length, 1);
});

// --- PromptAbortRegistry.reattachForPlayer ---

Deno.test('PromptAbortRegistry.reattachForPlayer invokes reattach only on that player handles and returns true', () => {
  const registry = new PromptAbortRegistry();
  const { handle: handleA, reattachCalls: reattachA } = makeHandle({ signalId: 'sig-a', playerId: 1 });
  const { handle: handleB, reattachCalls: reattachB } = makeHandle({ signalId: 'sig-b', playerId: 2 });
  registry.register(handleA);
  registry.register(handleB);

  const { socket } = makeFakeSocket();
  const result = registry.reattachForPlayer(1, socket);

  assertEquals(result, true);
  assertEquals(reattachA.length, 1);
  assertEquals(reattachA[0], socket);
  assertEquals(reattachB.length, 0);
});

Deno.test('PromptAbortRegistry.reattachForPlayer reattaches every pending handle for that player', () => {
  const registry = new PromptAbortRegistry();
  const { handle: handleA1, reattachCalls: reattachA1 } = makeHandle({ signalId: 'sig-a1', playerId: 1 });
  const { handle: handleA2, reattachCalls: reattachA2 } = makeHandle({ signalId: 'sig-a2', playerId: 1 });
  registry.register(handleA1);
  registry.register(handleA2);

  const { socket } = makeFakeSocket();
  const result = registry.reattachForPlayer(1, socket);

  assertEquals(result, true);
  assertEquals(reattachA1.length, 1);
  assertEquals(reattachA2.length, 1);
});

Deno.test('PromptAbortRegistry.reattachForPlayer returns false when the player has no pending handles', () => {
  const registry = new PromptAbortRegistry();
  const { handle } = makeHandle({ signalId: 'sig-a', playerId: 1 });
  registry.register(handle);

  const { socket } = makeFakeSocket();
  const result = registry.reattachForPlayer(2, socket);

  assertEquals(result, false);
});

// --- PromptAbortRegistry.getPendingEntries ---

Deno.test('PromptAbortRegistry.getPendingEntries reflects live registrations', () => {
  const registry = new PromptAbortRegistry();
  assertEquals(registry.getPendingEntries().length, 0);

  const { handle: handleA } = makeHandle({ signalId: 'sig-a', playerId: 1 });
  const unregisterA = registry.register(handleA);
  assertEquals(registry.getPendingEntries().length, 1);

  const { handle: handleB } = makeHandle({ signalId: 'sig-b', playerId: 2 });
  registry.register(handleB);
  assertEquals(registry.getPendingEntries().length, 2);

  unregisterA();
  const remaining = registry.getPendingEntries();
  assertEquals(remaining.length, 1);
  assertEquals(remaining[0].signalId, 'sig-b');
});
