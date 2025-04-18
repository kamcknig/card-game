import { CardId, PlayerId } from 'shared/shared-types.ts';
import { EffectArgs, EffectBase } from './effect-base.ts';

type RevealCardArgs = {
  playerId: PlayerId;
  cardId: CardId;
  moveToRevealed?: boolean;
}

export class RevealCardEffect extends EffectBase {
  type = 'revealCard' as const;
  
  cardId: CardId;
  playerId: PlayerId;
  moveToRevealed?: boolean;
  
  constructor(args: EffectArgs<RevealCardArgs>) {
    super();
    this.cardId = args.cardId;
    this.playerId = args.playerId;
    this.moveToRevealed = args.moveToRevealed;
  }
}
