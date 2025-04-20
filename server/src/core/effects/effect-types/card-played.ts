import { CardId, PlayerId } from 'shared/shared-types.ts';
import { EffectArgs, EffectBase } from './effect-base.ts';

type CardPlayedArgs = {
  playerId: PlayerId;
  cardId: CardId;
}

export class CardPlayedEffect extends EffectBase {
  type = 'cardPlayed' as const;
  cardId: number;
  playerId: number;
  
  constructor(args: EffectArgs<CardPlayedArgs>) {
    super(args);
    this.cardId = args.cardId;
    this.playerId = args.playerId;
  }
}
