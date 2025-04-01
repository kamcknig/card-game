import { Match } from "shared/shared-types.ts";
import { PreinitializedWritableAtom } from "nanostores";
import { Reaction, ReactionTemplate, ReactionTrigger } from "./types.ts";
import { CardLibrary } from './match-controller.ts';

export class ReactionManager {
  private readonly _triggers: Reaction[] = [];

  constructor(
    private readonly _$matchState: PreinitializedWritableAtom<Partial<Match>>,
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
        `removing trigger reaction ${triggerId} for player ${
          this._$matchState.get().players?.find(player => player.id === trigger.playerId)
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
      console.debug(`trigger card ${this._cardLibrary.getCard(trigger.cardId)}`);
      console.debug(`trigger player ${match.players.find(player => player.id === trigger.playerId)}`);
      
      return !(t.condition !== undefined && !t.condition(match, this._cardLibrary, trigger));
    });
    
    return out.filter((item, index, self) => index === self.findIndex(t => t.id === item.id))
  }

  registerReactionTemplate(reactionTemplate: ReactionTemplate) {
    console.log(`registering trigger template ID ${reactionTemplate.id}, for player ${reactionTemplate.playerId}`);
    this._triggers.push(new Reaction(reactionTemplate));
  }
}
