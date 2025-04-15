import { CardId, PlayerId } from 'shared/shared-types.ts';

type DiscardCardArgs = {
  playerId: PlayerId;
  cardId: CardId;
}

export class DiscardCardEffect {
  type = 'discardCard' as const;
  cardId: CardId;
  playerId: PlayerId;
  
  constructor(args: DiscardCardArgs) {
    this.cardId = args.cardId;
    this.playerId = args.playerId;
  }
}
