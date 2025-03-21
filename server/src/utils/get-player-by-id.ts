import {getGameState} from "./get-game-state.ts";

export const getPlayerById = (playerId: number) => {
    return getGameState().players.find(p => p.id === playerId);
}
