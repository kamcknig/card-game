import { EffectBase, EffectBaseArgs } from './effect-base.ts';

export class RevealCardEffect extends EffectBase {
  type = 'revealCard' as const;
  cardId: number;
  playerId: number;
  
  constructor(
    { cardId, playerId, ...arg }:
    & { playerId: number; cardId: number }
      & EffectBaseArgs,
  ) {
    super(arg);
    this.cardId = cardId;
    this.playerId = playerId;
  }
}
