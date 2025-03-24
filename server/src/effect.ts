import { Card } from "shared/types.ts";
import { CountSpec, EffectRestrictionSpec, LocationSpec } from "./types.ts";

export type GameEffects =
    | DrawCardEffect
    | DiscardCardEffect
    | GainActionEffect
    | GainBuyEffect
    | GainCardEffect
    | GainTreasureEffect
    | MoveCardEffect
    | TrashCardEffect
    | PlayCardEffect
    | RevealCardEffect
    | SelectCardEffect
    | ShuffleDeckEffect
    | UserPromptEffect;

type EffectBaseArgs = { sourcePlayerId: number, sourceCardId?: number };

/**
 * Base class for all effects.
 * Provides a default toJSON() method and a common interface.
 */
export abstract class EffectBase {
    abstract type: string;
    public sourceCardId!: number;
    public sourcePlayerId!: number;

    protected constructor({sourcePlayerId, sourceCardId}: EffectBaseArgs) {
        this.sourcePlayerId = sourcePlayerId;
        this.sourceCardId = sourceCardId!;
    }

    toString() {
        return `[EFFECT '${this.type}', source player ${this.sourcePlayerId}, source card ${this.sourceCardId}']`;
    }

    [Symbol.for('nodejs.util.inspect.custom')]() {
        return this.toString();
    }
}

export class DiscardCardEffect extends EffectBase {
    type = 'discardCard' as const;
    cardId: number;
    playerId: number;

    constructor({sourcePlayerId, sourceCardId, cardId, playerId}: { cardId: number; playerId: number } & EffectBaseArgs) {
        super({sourcePlayerId, sourceCardId});
        this.cardId = cardId;
        this.playerId = playerId;
    }
}

export class DrawCardEffect extends EffectBase {
    type = 'drawCard' as const;
    playerId: number;

    constructor({sourcePlayerId, sourceCardId, playerId}: { playerId: number } & EffectBaseArgs) {
        super({sourcePlayerId, sourceCardId});
        this.playerId = playerId;
    }
}

export class GainActionEffect extends EffectBase {
    type = 'gainAction' as const;
    count: number;

    constructor({sourcePlayerId, sourceCardId, count}: { count: number } & EffectBaseArgs) {
        super({sourcePlayerId, sourceCardId});
        this.count = count;
    }
}

export class GainBuyEffect extends EffectBase {
    type = 'gainBuy' as const;
    count: number;

    constructor({sourcePlayerId, sourceCardId, count}: { count: number } & EffectBaseArgs) {
        super({sourcePlayerId, sourceCardId});
        this.count = count;
    }
}

export class GainCardEffect extends EffectBase {
    type = 'gainCard' as const;
    cardId: number;
    cost?: Card['cost'];
    to: LocationSpec;
    playerId: number;

    constructor({sourcePlayerId, sourceCardId, cardId, cost, to, playerId}: {
        cardId: number;
        cost?: Card['cost'],
        to: LocationSpec,
        playerId: number;
    } & EffectBaseArgs) {
        super({sourcePlayerId, sourceCardId});
        this.cardId = cardId;
        this.cost = cost;
        this.to = to;
        this.playerId = playerId;
    }
}

export class GainTreasureEffect extends EffectBase {
    type = 'gainTreasure' as const;
    count: number;

    constructor({sourcePlayerId, sourceCardId, count}: { count: number } & EffectBaseArgs) {
        super({sourcePlayerId, sourceCardId});
        this.count = count ?? 1;
    }
}
export class MoveCardEffect extends EffectBase {
    type = 'moveCard' as const;
    cardId: number;
    to: LocationSpec;
    playerId: number | undefined;

    constructor({playerId, sourcePlayerId, sourceCardId, cardId, to}: { cardId: number; to: LocationSpec, playerId?: number } & EffectBaseArgs) {
        super({sourcePlayerId, sourceCardId});
        this.cardId = cardId;
        this.to = to;
        this.playerId = playerId;
    }
}

export class PlayCardEffect extends EffectBase {
    type = 'playCard' as const;
    cardId: number;
    playerId: number;

    constructor({sourcePlayerId, sourceCardId, cardId, playerId}: { cardId: number; playerId: number } & EffectBaseArgs) {
        super({sourcePlayerId, sourceCardId});
        this.cardId = cardId;
        this.playerId = playerId;
    }
}

export class RevealCardEffect extends EffectBase {
    type = 'revealCard' as const;
    cardId: number;
    playerId: number;

    constructor({sourcePlayerId, sourceCardId, cardId, playerId}: { playerId: number, cardId: number } & EffectBaseArgs) {
        super({sourcePlayerId, sourceCardId});
        this.cardId = cardId;
        this.playerId = playerId;
    }
}

export class SelectCardEffect extends EffectBase {
    type = 'selectCard' as const;
    count?: CountSpec | number;
    autoSelect?: boolean;
    restrict: EffectRestrictionSpec | number[];
    playerId: number;

    constructor({playerId, sourcePlayerId, sourceCardId, restrict, count, autoSelect}: {
        restrict: EffectRestrictionSpec | number[],
        count?: CountSpec | number,
        autoSelect?: boolean,
        playerId: number,
    } & EffectBaseArgs) {
        super({sourcePlayerId, sourceCardId});
        this.restrict = restrict;
        this.count = count;
        this.autoSelect = autoSelect;
        this.playerId = playerId;
    }
}

export class ShuffleDeckEffect extends EffectBase {
    type = 'shuffleDeck' as const;
    playerId: number;
    
    constructor({playerId}: {playerId: number}) {
        super({sourcePlayerId: playerId});
        this.playerId = playerId;
    }
}

export class TrashCardEffect extends EffectBase {
    type = 'trashCard' as const;
    cardId: number;
    playerId?: number;

    constructor({sourcePlayerId, sourceCardId, cardId, playerId}: { cardId: number, playerId?: number } & EffectBaseArgs) {
        super({sourcePlayerId, sourceCardId});
        this.cardId = cardId;
        this.playerId = playerId;
    }
}

export type UserPromptArgs = {
    prompt: string;
    confirmLabel: string;
    declineLabel?: string;
    showDeclineOption?: boolean;
    content?: {
        cardSelection?: {
            cardIds: number[],
            selectCount?: CountSpec
        }
    }
}

export class UserPromptEffect extends EffectBase {
    type = 'userPrompt' as const;
    playerId: number;
    prompt: string;
    declineLabel?: string;
    confirmLabel: string;
    showDeclineOption?: boolean;
    content?: UserPromptArgs['content'];

    constructor({content, showDeclineOption, declineLabel, confirmLabel, playerId, prompt, sourcePlayerId, sourceCardId}: {playerId: number} & UserPromptArgs & EffectBaseArgs) {
        super({sourcePlayerId, sourceCardId});
        this.playerId = playerId;
        this.prompt = prompt;
        this.declineLabel = declineLabel;
        this.confirmLabel = confirmLabel;
        this.showDeclineOption = showDeclineOption ?? true;
        this.content = content;
    }
}
