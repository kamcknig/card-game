import {getGameState} from "./get-game-state.ts";

export const getPlayerBySessionId = (sessionId: string) => {
  return getGameState().players.find(p => p.sessionId === sessionId);
}
