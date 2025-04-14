import { PlayerId } from "shared/shared-types.ts";

type NewTurnEffectArgs = {
  playerId: PlayerId;
}

export class NewTurnEffect {
  type = 'newTurn' as const;
  playerId: PlayerId;
  
  constructor(args: NewTurnEffectArgs) {
    this.playerId = args.playerId;
  }
}