import {GameState, Match, Player} from "shared/shared-types.ts";

let gameState: GameState;
export const getGameState = () => gameState;

export const createGame = (): GameState => {
    gameState = {
        matchConfig: {
            expansions: [],
            supplyCardKeys: [],
            kingdomCardKeys: [],
        },
        players: [] as Player[],
        started: false,
        owner: NaN,
        match: undefined as unknown as Match
    };

    return gameState;
}
