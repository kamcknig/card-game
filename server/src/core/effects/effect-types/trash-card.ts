import { EffectBase } from './effect-base.ts';
import { PlayerId, CardId } from "shared/shared-types.ts";

type TrashCardArgs = {
  playerId: PlayerId;
  cardId: CardId;
}

export class TrashCardEffect extends EffectBase {
  type = 'trashCard' as const;
  cardId: number;
  playerId?: number;
  
  constructor(args: TrashCardArgs) {
    super();
    this.cardId = args.cardId;
    this.playerId = args.playerId;
  }
}
