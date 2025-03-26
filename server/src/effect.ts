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

type EffectBaseArgs = {
    sourcePlayerId: number,
    sourceCardId?: number,
    triggerImmediateUpdate?: boolean,
};

/**
 * Base class for all effects.
 * Provides a default toJSON() method and a common interface.
 */
export abstract class EffectBase {
    abstract type: string;
    public sourceCardId!: number;
    public sourcePlayerId!: number;
    public triggerUpdate: boolean;

    protected constructor({sourcePlayerId, sourceCardId, triggerImmediateUpdate}: EffectBaseArgs) {
        this.sourcePlayerId = sourcePlayerId;
        this.sourceCardId = sourceCardId!;
        this.triggerUpdate = triggerImmediateUpdate!
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

    constructor({cardId, playerId, ...arg}: { cardId: number; playerId: number } & EffectBaseArgs) {
        super(arg);
        this.cardId = cardId;
        this.playerId = playerId;
    }
}

export class DrawCardEffect extends EffectBase {
    type = 'drawCard' as const;
    playerId: number;

    constructor({playerId, ...arg}: { playerId: number } & EffectBaseArgs) {
        super(arg);
        this.playerId = playerId;
    }
}

export class GainActionEffect extends EffectBase {
    type = 'gainAction' as const;
    count: number;

    constructor({count, ...arg}: { count: number } & EffectBaseArgs) {
        super(arg);
        this.count = count;
    }
}

export class GainBuyEffect extends EffectBase {
    type = 'gainBuy' as const;
    count: number;

    constructor({count, ...arg}: { count: number } & EffectBaseArgs) {
        super(arg);
        this.count = count;
    }
}

export class GainCardEffect extends EffectBase {
    type = 'gainCard' as const;
    cardId: number;
    cost?: Card['cost'];
    to: LocationSpec;
    playerId: number;

    constructor({cardId, cost, to, playerId, ...arg}: {
        cardId: number;
        cost?: Card['cost'],
        to: LocationSpec,
        playerId: number;
    } & EffectBaseArgs) {
        super(arg);
        this.cardId = cardId;
        this.cost = cost;
        this.to = to;
        this.playerId = playerId;
    }
}

export class GainTreasureEffect extends EffectBase {
    type = 'gainTreasure' as const;
    count: number;

    constructor({count, ...arg}: { count: number } & EffectBaseArgs) {
        super(arg);
        this.count = count ?? 1;
    }
}
export class MoveCardEffect extends EffectBase {
    type = 'moveCard' as const;
    cardId: number;
    to: LocationSpec;
    playerId: number | undefined;

    constructor({playerId, cardId, to, ...arg}: { cardId: number; to: LocationSpec, playerId?: number } & EffectBaseArgs) {
        super(arg);
        this.cardId = cardId;
        this.to = to;
        this.playerId = playerId;
    }
}

export class PlayCardEffect extends EffectBase {
    type = 'playCard' as const;
    cardId: number;
    playerId: number;

    constructor({cardId, playerId, ...arg}: { cardId: number; playerId: number } & EffectBaseArgs) {
        super(arg);
        this.cardId = cardId;
        this.playerId = playerId;
    }
}

export class RevealCardEffect extends EffectBase {
    type = 'revealCard' as const;
    cardId: number;
    playerId: number;

    constructor({cardId, playerId, ...arg}: { playerId: number, cardId: number } & EffectBaseArgs) {
        super(arg);
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

    constructor({playerId, restrict, count, autoSelect, ...arg}: {
        restrict: EffectRestrictionSpec | number[],
        count?: CountSpec | number,
        autoSelect?: boolean,
        playerId: number,
    } & EffectBaseArgs) {
        super(arg);
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

    constructor({cardId, playerId, ...arg}: { cardId: number, playerId?: number } & EffectBaseArgs) {
        super(arg);
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

    constructor({content, showDeclineOption, declineLabel, confirmLabel, playerId, prompt, ...arg}: {playerId: number} & UserPromptArgs & EffectBaseArgs) {
        super(arg);
        this.playerId = playerId;
        this.prompt = prompt;
        this.declineLabel = declineLabel;
        this.confirmLabel = confirmLabel;
        this.showDeclineOption = showDeclineOption ?? true;
        this.content = content;
    }
}
