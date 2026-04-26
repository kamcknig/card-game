import { assertEquals } from '@std/assert';
import { Server } from 'socket.io';
import { ServerSocketGatewayService } from '../server-socket-gateway-service.ts';
import { LobbyDirectoryService } from '../lobby-directory-service.ts';
import { LoggerService } from '../logger-service.ts';
import { AuthSessionService } from '../auth/auth-session-service.ts';
import type { ServerEmitEvents, ServerListenEvents } from 'shared/types/index.ts';

// Minimal logger stub that silences output during tests.
const makeLoggerStub = (): LoggerService =>
  ({
    log: () => {},
    info: () => {},
    warn: () => {},
    debug: () => {},
    error: () => {},
  }) as unknown as LoggerService;

// Records emit() calls and disconnect() invocations on a fake socket so
// tests can assert that the takeover-kick path fires the right side
// effects on the prior socket.
interface FakeSocket {
  id: string;
  emitted: Array<{ event: string; args: unknown[] }>;
  disconnected: boolean;
  handshake: {
    address: string;
    query: Map<string, string>;
    auth: Record<string, string>;
  };
  disconnectListeners: Array<() => void>;
  emit: (event: string, ...args: unknown[]) => boolean;
  disconnect: (close?: boolean) => void;
  on: (event: string, listener: () => void) => void;
}

const makeFakeSocket = (
  id: string,
  opts: { sessionId?: string; authToken?: string } = {},
): FakeSocket => {
  const sessionId = opts.sessionId ?? `session-${id}`;
  const authToken = opts.authToken ?? `token-${id}`;
  const socket: FakeSocket = {
    id,
    emitted: [],
    disconnected: false,
    disconnectListeners: [],
    handshake: {
      address: '127.0.0.1',
      query: new Map([['sessionId', sessionId]]),
      auth: { authToken },
    },
    emit: (event, ...args) => {
      socket.emitted.push({ event, args });
      return true;
    },
    disconnect: () => {
      socket.disconnected = true;
      // Mirror Socket.IO behaviour: a forced disconnect fires the
      // 'disconnect' listener so consumers can clean up server-side
      // state.
      for (const fn of socket.disconnectListeners) fn();
    },
    on: (event, listener) => {
      if (event === 'disconnect') socket.disconnectListeners.push(listener);
    },
  };
  return socket;
};

// Captures the connection callback registered with `io.on('connection', ...)`
// and exposes the per-id socket map used by the gateway when looking up a
// prior socket via `io.of('/').sockets.get(id)`. Tests drive the gateway by
// calling the captured callback directly.
interface FakeServer {
  connectionHandlers: Array<(socket: FakeSocket) => void>;
  sockets: Map<string, FakeSocket>;
  io: Server<ServerListenEvents, ServerEmitEvents>;
}

const makeFakeServer = (): FakeServer => {
  const sockets = new Map<string, FakeSocket>();
  const connectionHandlers: Array<(socket: FakeSocket) => void> = [];
  const io = {
    on: (event: string, handler: (socket: FakeSocket) => void) => {
      if (event === 'connection') connectionHandlers.push(handler);
    },
    of: (_namespace: string) => ({ sockets }),
  } as unknown as Server<ServerListenEvents, ServerEmitEvents>;
  return { connectionHandlers, sockets, io };
};

// Stub auth session service that returns a hard-coded username for any
// token. Avoids pulling in the full session store machinery just to drive
// the gateway's auth check.
const makeAuthStub = (resolvedUsername: string | undefined): AuthSessionService =>
  ({
    validateToken: () => resolvedUsername,
  }) as unknown as AuthSessionService;

// Stub lobby directory that records every registerConnection call so
// tests can assert that authentication completed before lobby wiring.
interface LobbyDirectoryStub extends LobbyDirectoryService {
  registered: Array<{ sessionId: string; username: string }>;
}

const makeLobbyDirectoryStub = (): LobbyDirectoryStub => {
  const registered: Array<{ sessionId: string; username: string }> = [];
  return {
    registered,
    registerConnection: (sessionId: string, _socket: unknown, username: string) => {
      registered.push({ sessionId, username });
    },
  } as unknown as LobbyDirectoryStub;
};

// Connects a fake socket through the gateway. Stores it in the namespace
// map first so subsequent kicks can find it by id, then invokes the
// captured connection handler.
const connect = (server: FakeServer, socket: FakeSocket): void => {
  server.sockets.set(socket.id, socket);
  for (const handler of server.connectionHandlers) handler(socket);
};

Deno.test('ServerSocketGatewayService — first connection registers without kicking', () => {
  const server = makeFakeServer();
  const lobby = makeLobbyDirectoryStub();
  const gateway = new ServerSocketGatewayService(
    server.io,
    lobby,
    makeLoggerStub(),
    makeAuthStub('alice'),
  );
  gateway.registerConnectionHandler();

  const a = makeFakeSocket('socket-A');
  connect(server, a);

  // No prior socket existed, so the lobby is registered cleanly and the
  // socket receives no `sessionTakenOver` event.
  assertEquals(lobby.registered.length, 1);
  assertEquals(lobby.registered[0]?.username, 'alice');
  assertEquals(a.emitted.length, 0);
  assertEquals(a.disconnected, false);
});

Deno.test('ServerSocketGatewayService — second connection for same user kicks the prior socket', () => {
  const server = makeFakeServer();
  const lobby = makeLobbyDirectoryStub();
  const gateway = new ServerSocketGatewayService(
    server.io,
    lobby,
    makeLoggerStub(),
    makeAuthStub('alice'),
  );
  gateway.registerConnectionHandler();

  const a = makeFakeSocket('socket-A');
  connect(server, a);
  const b = makeFakeSocket('socket-B');
  connect(server, b);

  // The new socket triggers a sessionTakenOver emit on the prior socket
  // followed by a forced disconnect. Both tabs cannot stay connected
  // under the one-user one-tab policy.
  assertEquals(a.emitted, [{ event: 'sessionTakenOver', args: [] }]);
  assertEquals(a.disconnected, true);
  assertEquals(b.emitted.length, 0);
  assertEquals(b.disconnected, false);
  // The new socket is the one registered with the lobby.
  assertEquals(lobby.registered.length, 2);
});

Deno.test('ServerSocketGatewayService — different users do not kick each other', () => {
  const server = makeFakeServer();
  const lobby = makeLobbyDirectoryStub();

  // Map session tokens to different usernames so the gateway records two
  // independent username bindings.
  const auth = {
    validateToken: (token: string) => (token === 'token-socket-A' ? 'alice' : 'bob'),
  } as unknown as AuthSessionService;

  const gateway = new ServerSocketGatewayService(server.io, lobby, makeLoggerStub(), auth);
  gateway.registerConnectionHandler();

  const a = makeFakeSocket('socket-A');
  connect(server, a);
  const b = makeFakeSocket('socket-B');
  connect(server, b);

  // Distinct usernames must not collide; alice's socket stays open when
  // bob connects.
  assertEquals(a.emitted.length, 0);
  assertEquals(a.disconnected, false);
  assertEquals(b.emitted.length, 0);
});

Deno.test('ServerSocketGatewayService — takeover-kick disconnect does not erase the new socket binding', () => {
  const server = makeFakeServer();
  const lobby = makeLobbyDirectoryStub();
  const gateway = new ServerSocketGatewayService(
    server.io,
    lobby,
    makeLoggerStub(),
    makeAuthStub('alice'),
  );
  gateway.registerConnectionHandler();

  const a = makeFakeSocket('socket-A');
  connect(server, a);
  const b = makeFakeSocket('socket-B');
  connect(server, b);
  // A's disconnect listener fires synchronously inside b's connect path
  // (via b's takeover kick → a.disconnect()). The binding for 'alice'
  // must remain pointed at b — otherwise a third connection wouldn't
  // know to kick b.
  const c = makeFakeSocket('socket-C');
  connect(server, c);

  assertEquals(b.emitted, [{ event: 'sessionTakenOver', args: [] }]);
  assertEquals(b.disconnected, true);
});

Deno.test('ServerSocketGatewayService — natural disconnect clears the binding', () => {
  const server = makeFakeServer();
  const lobby = makeLobbyDirectoryStub();
  const gateway = new ServerSocketGatewayService(
    server.io,
    lobby,
    makeLoggerStub(),
    makeAuthStub('alice'),
  );
  gateway.registerConnectionHandler();

  const a = makeFakeSocket('socket-A');
  connect(server, a);
  // Simulate a normal disconnect (refresh, browser close, network drop).
  // Remove from the namespace map first so the lookup in the next
  // takeover attempt would otherwise return undefined.
  server.sockets.delete(a.id);
  for (const fn of a.disconnectListeners) fn();

  const b = makeFakeSocket('socket-B');
  connect(server, b);

  // No prior socket survives, so b must connect without kicking anything.
  assertEquals(b.emitted.length, 0);
  assertEquals(b.disconnected, false);
});
