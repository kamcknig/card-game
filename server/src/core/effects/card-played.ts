import { EffectBase, EffectBaseArgs } from './effect-base.ts';

export class CardPlayedEffect extends EffectBase {
  type = 'cardPlayed' as const;
  cardId: number;
  playerId: number;
  
  constructor(
    { cardId, playerId, ...arg }:
    & { cardId: number; playerId: number }
      & EffectBaseArgs,
  ) {
    super(arg);
    this.cardId = cardId;
    this.playerId = playerId;
  }
}
