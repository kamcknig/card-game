import { Card, CardId, LocationSpec, PlayerId } from 'shared/shared-types.ts';
import { EffectArgs, EffectBase } from './effect-base.ts';

type GainCardArgs = {
  playerId: PlayerId;
  cardId: CardId;
  cost?: Card['cost'];
  to: LocationSpec;
}

export class GainCardEffect extends EffectBase {
  type = 'gainCard' as const;
  
  cardId: number;
  cost?: Card['cost'];
  to: LocationSpec;
  playerId: number;
  
  constructor(args: EffectArgs<GainCardArgs>) {
    super(args);
    this.cardId = args.cardId;
    this.cost = args.cost;
    this.to = args.to;
    this.playerId = args.playerId;
  }
}
