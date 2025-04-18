import { CardId, LocationSpec, PlayerId } from 'shared/shared-types.ts';
import { EffectArgs, EffectBase } from './effect-base.ts';

type MoveCardArgs = {
  cardId: CardId;
  to: LocationSpec;
  toPlayerId?: PlayerId;
}
export class MoveCardEffect extends EffectBase{
  type = 'moveCard' as const;
  cardId: CardId;
  to: LocationSpec;
  toPlayerId?: PlayerId;
  
  constructor(args: EffectArgs<MoveCardArgs>) {
    super(args);
    this.cardId = args.cardId;
    this.to = args.to;
    this.toPlayerId = args.toPlayerId;
  }
}
