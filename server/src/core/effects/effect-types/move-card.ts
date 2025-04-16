import { CardId, LocationSpec, PlayerId } from 'shared/shared-types.ts';

type MoveCardArgs = {
  cardId: CardId;
  to: LocationSpec;
  toPlayerId?: PlayerId;
}
export class MoveCardEffect {
  type = 'moveCard' as const;
  cardId: CardId;
  to: LocationSpec;
  toPlayerId?: PlayerId;
  
  constructor(args: MoveCardArgs) {
    this.cardId = args.cardId;
    this.to = args.to;
    this.toPlayerId = args.toPlayerId;
  }
}
