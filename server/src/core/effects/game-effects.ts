import { DiscardCardEffect } from './discard-card.ts';
import { DrawCardEffect } from './draw-card.ts';
import { GainActionEffect } from './gain-action.ts';
import { GainBuyEffect } from './gain-buy.ts';
import { GainCardEffect } from './gain-card.ts';
import { GainTreasureEffect } from './gain-treasure.ts';
import { MoveCardEffect } from './move-card.ts';
import { CardPlayedEffect } from './card-played.ts';
import { RevealCardEffect } from './reveal-card.ts';
import { SelectCardEffect } from './select-card.ts';
import { ShuffleDeckEffect } from './shuffle-card.ts';
import { TrashCardEffect } from './trash-card.ts';
import { UserPromptEffect } from './user-prompt.ts';
import { ModifyCostEffect } from './modify-cost.ts';
import { InvokeCardGeneratorEffect } from './invoke-card-generator-effect.ts';
import { InvokeGameActionGeneratorEffect } from './invoke-game-action-generator-effect.ts';
import { EndTurnEffect } from './end-turn.ts';
import { NoopEffect } from './noop.ts';
import { NextPhaseCompleteEffect } from './next-phase-complete.ts';

export type GameEffects =
  | DrawCardEffect
  | DiscardCardEffect
  | GainActionEffect
  | GainBuyEffect
  | GainCardEffect
  | GainTreasureEffect
  | MoveCardEffect
  | TrashCardEffect
  | CardPlayedEffect
  | EndTurnEffect
  | RevealCardEffect
  | SelectCardEffect
  | ShuffleDeckEffect
  | UserPromptEffect
  | InvokeCardGeneratorEffect
  | InvokeGameActionGeneratorEffect
  | NoopEffect
  | NextPhaseCompleteEffect
  | ModifyCostEffect;
