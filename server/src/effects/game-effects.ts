import { DiscardCardEffect } from './discard-card.ts';
import { DrawCardEffect } from './draw-card.ts';
import { GainActionEffect } from './gain-action.ts';
import { GainBuyEffect } from './gain-buy.ts';
import { GainCardEffect } from './gain-card.ts';
import { GainTreasureEffect } from './gain-treasure.ts';
import { MoveCardEffect } from './move-card.ts';
import { PlayCardEffect } from './play-card.ts';
import { RevealCardEffect } from './reveal-card.ts';
import { SelectCardEffect } from './select-card.ts';
import { ShuffleDeckEffect } from './shuffle-card.ts';
import { TrashCardEffect } from './trash-card.ts';
import { UserPromptEffect } from './user-prompt.ts';

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
