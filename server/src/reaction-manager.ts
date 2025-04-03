import { Match } from 'shared/shared-types.ts';
import { Reaction, ReactionTemplate, ReactionTrigger } from './types.ts';
import { CardLibrary } from './match-controller.ts';

export class ReactionManager {
  private readonly _triggers: Reaction[] = [];

  constructor(
    private readonly match: Match,
    private readonly _cardLibrary: CardLibrary,
  ) {
  }

  public endGame() {
  }

  unregisterTrigger(triggerId: string) {
    const idx = this._triggers.findIndex((trigger) => trigger.id === triggerId);
    if (idx > -1) {
      const trigger = this._triggers[idx];
      console.log(
        `[REACTION MANAGER] removing trigger reaction ${triggerId} for player ${
          this.match.players?.find((player) => player.id === trigger.playerId)
        }`,
      );
      this._triggers.splice(idx, 1);
    }
  }

  getReactions(trigger: ReactionTrigger) {
    return this._triggers.filter((t) => {
      if (t.listeningFor !== trigger.eventType) return false;

      console.log(`[REACTION MANAGER] checking trigger ${trigger} condition for ${t.id} reaction`);
      console.debug(
        `[REACTION MANAGER] trigger card ${this._cardLibrary.getCard(trigger.cardId)}`,
      );
      console.debug(
        `t[REACTION MANAGER] rigger player ${
          this.match.players.find((player) => player.id === trigger.playerId)
        }`,
      );

      return !(t.condition !== undefined &&
        !t.condition({ match: this.match, cardLibrary: this._cardLibrary, trigger }));
    });
  }

  getReactionsForPlayer(
    trigger: ReactionTrigger,
    playerId: number,
  ) {
    return this.getReactions(trigger).filter((item) =>
      item.playerId === playerId
    );
  }

  registerReactionTemplate(reactionTemplate: ReactionTemplate) {
    console.log(
      `[REACTION MANAGER] registering trigger template ID ${reactionTemplate.id}, for player ${reactionTemplate.playerId}`,
    );
    this._triggers.push(new Reaction(reactionTemplate));
  }
}
