import {
    AsyncEffectGeneratorFn,
    EffectGeneratorFn,
    LifecycleCallbackMap
} from './types.ts';
import { DiscardCardEffect } from './effects/discard-card.ts';
import { DrawCardEffect } from './effects/draw-card.ts';
import { GainActionEffect } from './effects/gain-action.ts';
import { GainBuyEffect } from './effects/gain-buy.ts';
import { GainCardEffect } from './effects/gain-card.ts';
import { GainTreasureEffect } from './effects/gain-treasure.ts';
import { PlayCardEffect } from './effects/play-card.ts';

export const cardLifecycleMap: Record<string, Partial<LifecycleCallbackMap>> = {}

export const effectGeneratorMap: Record<string, EffectGeneratorFn | AsyncEffectGeneratorFn> = {
    'playCard': function* (matchState, cardLibrary, sourcePlayerId, sourceCardId) {
        if (!sourceCardId) {
            throw new Error('playCard requires a card ID');
        }

        if (cardLibrary.getCard(sourceCardId).type.includes('ACTION')) {
            yield new GainActionEffect({
                count: -1,
                sourcePlayerId: sourcePlayerId,
                sourceCardId,
                triggerImmediateUpdate: true
            });
        }

        yield new PlayCardEffect({
            cardId: sourceCardId,
            sourcePlayerId,
            sourceCardId,
            playerId: sourcePlayerId
        });
    },
    'discardCard': function* (_matchState, cardLibrary, sourcePlayerId, sourceCardId) {
        if (!sourceCardId) {
            throw new Error('discardCard requires a card ID');
        }

        yield new DiscardCardEffect({playerId: sourcePlayerId, cardId: sourceCardId, sourcePlayerId, sourceCardId});
    },
    'buyCard': function* (matchState, cardLibrary, sourcePlayerId, sourceCardId) {
        if (!sourceCardId) {
            throw new Error('buyCard requires a card ID');
        }

        if (cardLibrary.getCard(sourceCardId).cost.treasure !== 0) {
            yield new GainTreasureEffect({
                count: -(cardLibrary.getCard(sourceCardId).cost.treasure ?? 0),
                sourcePlayerId,
                sourceCardId
            });
        }
        yield new GainBuyEffect({count: -1, sourcePlayerId, sourceCardId, triggerImmediateUpdate: true});
        yield new GainCardEffect({
            playerId: sourcePlayerId,
            cardId: sourceCardId,
            to: {location: 'playerDiscards'},
            sourcePlayerId,
            sourceCardId
        });
    },
    'drawCard': function* (_matchState, cardLibrary, sourcePlayerId, sourceCardId) {
        yield new DrawCardEffect({playerId: sourcePlayerId, sourceCardId, sourcePlayerId});
    },
    'gainCard': function* (_matchState, cardLibrary, sourcePlayerId, sourceCardId) {
        if (!sourceCardId) {
            throw new Error('gainCard requires a card ID');
        }

        yield new GainCardEffect({
            playerId: sourcePlayerId,
            cardId: sourceCardId,
            to: {location: 'playerDiscards'},
            sourcePlayerId,
            sourceCardId
        });
    }
};
