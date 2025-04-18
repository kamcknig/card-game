import { CardId, PlayerId } from 'shared/shared-types.ts';
import { EffectArgs, EffectBase } from './effect-base.ts';

type DiscardCardArgs = {
  playerId: PlayerId;
  cardId: CardId;
}

export class DiscardCardEffect extends EffectBase {
  type = 'discardCard' as const;
  cardId: CardId;
  playerId: PlayerId;
  
  constructor(args: EffectArgs<DiscardCardArgs>) {
    super(args);
    this.cardId = args.cardId;
    this.playerId = args.playerId;
  }
}
