import {Match} from "shared/types.ts";
import {PreinitializedWritableAtom} from "nanostores";
import {getPlayerById} from "./utils/get-player-by-id.ts";
import {ReactionTrigger, Reaction, ReactionTemplate} from "./types.ts";

export class ReactionManager {
  private readonly _triggers: Reaction[] = [];

  constructor(private readonly $matchState: PreinitializedWritableAtom<Partial<Match>>) {
  }

  public endGame() {
  
  }
  
  unregisterTrigger(triggerId: string) {
    const idx = this._triggers.findIndex((trigger) => trigger.id === triggerId);
    if (idx > -1) {
      const trigger = this._triggers[idx];
      console.log(
        `removing trigger reaction ${triggerId} for player ${
          getPlayerById(trigger.playerId)
        }`,
      );
      this._triggers.splice(idx, 1);
    }
  }

  getReactions(match: Match, trigger: ReactionTrigger) {
    const out = this._triggers.filter((t) => {
      if (t.listeningFor !== trigger.eventType) return false;
      
      console.log(`checking trigger condition for ${t.id} reaction`);
      console.debug(`trigger ${trigger}`);
      console.debug(`trigger card ${match.cardsById[trigger.cardId]}`);
      console.debug(`trigger player ${getPlayerById(trigger.playerId)}`);
      
      return !(t.condition !== undefined && !t.condition(match, trigger));
    });

    return out.filter((item, index, self) => index === self.findIndex(t => t.getSourceKey() === item.getSourceKey()))
  }

  registerReactionTemplate(reactionTemplate: ReactionTemplate) {
    console.log(`registering trigger template ID ${reactionTemplate.id}, for player ${reactionTemplate.playerId}`);
    this._triggers.push(new Reaction(reactionTemplate));
  }
}
