import { CardId, PlayerId } from 'shared/shared-types.ts';
import { EffectBase } from './effect-base.ts';

type CardPlayedArgs = {
  playerId: PlayerId;
  cardId: CardId;
}

export class CardPlayedEffect extends EffectBase {
  type = 'cardPlayed' as const;
  cardId: number;
  playerId: number;
  
  constructor(args: CardPlayedArgs) {
    super();
    this.cardId = args.cardId;
    this.playerId = args.playerId;
  }
}
