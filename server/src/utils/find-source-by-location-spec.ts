import {LocationSpec} from "../types.ts";
import {Match} from "shared/types.ts";
import { isArray } from 'es-toolkit/compat';

export function findSourceByLocationSpec(specOrArgs: {
    playerId: number,
    spec: LocationSpec
}, match: Match): number[] | undefined;
export function findSourceByLocationSpec(specOrArgs: LocationSpec, match: Match, playerId?: number): number[] | undefined;
export function findSourceByLocationSpec(specOrArgs: {
    playerId: number,
    spec: LocationSpec
} | LocationSpec, match: Match): number[] | undefined {
    let spec: LocationSpec;
    let playerId: number = NaN;
    if ('playerId' in specOrArgs) {
        spec = specOrArgs.spec;
        playerId = specOrArgs.playerId;
    } else {
        spec = specOrArgs;
    }

    if (isArray(spec.location)) {
        throw new Error('findSourceByLocationSpec cannot accept multiple locations in a spec');
    }

    if (['playerDecks', 'playerHands', 'playerDiscards'].includes(spec.location)) {
        if (isNaN(playerId)) {
            throw new Error('findSourceByLocationSpec requires a playerID when a spec location is deck, hand, or discard')
        }

        switch (spec.location) {
            case 'playerDecks':
                return match.playerDecks[playerId];
            case 'playerHands':
                return match.playerHands[playerId];
            case 'playerDiscards':
                return match.playerDiscards[playerId];
        }
    } else {
        switch (spec.location) {
            case 'kingdom':
                return match.kingdom;
            case 'supply':
                return match.supply;
            case 'trash':
                return match.trash;
            case 'playArea':
                return match.playArea;
        }
    }
}