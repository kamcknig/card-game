import { Player, PlayerArgs } from 'shared/types/index.ts';

let nextTestPlayerId = 1;

// Builds a Player fixture with stable defaults for match/configuration tests.
export const createTestPlayer = (args: Partial<PlayerArgs> = {}): Player => {
  const id = args.id ?? nextTestPlayerId++;

  return new Player({
    id,
    color: args.color ?? 'blue',
    connected: args.connected ?? true,
    isComputer: args.isComputer ?? false,
    name: args.name ?? `Player ${id}`,
    ready: args.ready ?? true,
    sessionId: args.sessionId ?? `session-${id}`,
    socketId: args.socketId ?? `socket-${id}`,
  });
};
