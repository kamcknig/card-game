import { castArray } from 'es-toolkit/compat';
import { isUndefined } from 'es-toolkit';
import { Card, EffectRestrictionSpec, Match } from "shared/shared-types.ts";

import {validateCostSpec} from "../shared/validate-cost-spec.ts";

export const findCards = (
    match: Match,
    effectRestriction: EffectRestrictionSpec,
    cardsById: Record<number, Card>,
    playerId?: number,
) => {
    if (isUndefined(cardsById)) {
        throw new Error('findCards requires cardsById parameter');
    }

    if (effectRestriction === 'SELF') {
        throw new Error(`findCards cannot accept a restriction of type 'SELF'`);
    }

    let cardIds: number[] = [];

    if (!isUndefined(effectRestriction.from?.location)) {
        if (!isUndefined(playerId)) {
            if (effectRestriction.from?.location.includes('playerHands')) {
                cardIds = cardIds.concat(match.playerHands[playerId]);
            }

            if (effectRestriction.from?.location.includes('playerDecks')) {
                cardIds = cardIds.concat(match.playerDecks[playerId]);
            }

            if (effectRestriction.from?.location.includes('playerDiscards')) {
                cardIds = cardIds.concat(match.playerDiscards[playerId]);
            }
        }

        if (effectRestriction.from?.location.includes('supply')) {
            cardIds = cardIds.concat(match.supply);
        }

        if (effectRestriction.from?.location.includes('kingdom')) {
            cardIds = cardIds.concat(match.kingdom);
        }
    }

    if (!isUndefined(effectRestriction?.cost)) {
        cardIds = cardIds.filter(id => validateCostSpec(effectRestriction.cost!, cardsById[id].cost.treasure));
    }
    if (!isUndefined(effectRestriction.card)) {
        if (!isUndefined(effectRestriction.card?.cardKeys)) {
            const keys = castArray(effectRestriction.card.cardKeys);
            cardIds = cardIds.filter(id => keys.includes(cardsById[id].cardKey))
        }
        if (!isUndefined(effectRestriction.card?.type)) {
            const types = castArray(effectRestriction.card.type);
            cardIds = cardIds.filter(id => cardsById[id].type.some(t => types.includes(t)));
        }
    }

    return cardIds;
}
