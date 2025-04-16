import { PlayerId } from 'shared/shared-types.ts';

type DrawCardArgs = { playerId: PlayerId };

export class DrawCardEffect {
  type = 'drawCard' as const;
  playerId: PlayerId;
  
  constructor(args: DrawCardArgs) {
    this.playerId = args.playerId;
  }
}
