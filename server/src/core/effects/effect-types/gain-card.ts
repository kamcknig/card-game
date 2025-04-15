import { Card, CardId, LocationSpec, PlayerId } from 'shared/shared-types.ts';

type GainCardArgs = {
  playerId: PlayerId;
  cardId: CardId;
  cost?: Card['cost'];
  to: LocationSpec;
}

export class GainCardEffect {
  type = 'gainCard' as const;
  
  cardId: number;
  cost?: Card['cost'];
  to: LocationSpec;
  playerId: number;
  
  constructor(args: GainCardArgs) {
    this.cardId = args.cardId;
    this.cost = args.cost;
    this.to = args.to;
    this.playerId = args.playerId;
  }
}
