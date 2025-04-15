import { CardId, PlayerId } from 'shared/shared-types.ts';
import { EffectBase } from './effect-base.ts';

type RevealCardArgs = {
  playerId: PlayerId;
  cardId: CardId;
}

export class RevealCardEffect extends EffectBase {
  type = 'revealCard' as const;
  
  cardId: CardId;
  playerId: PlayerId;
  
  constructor(args: RevealCardArgs) {
    super();
    this.cardId = args.cardId;
    this.playerId = args.playerId;
  }
}
