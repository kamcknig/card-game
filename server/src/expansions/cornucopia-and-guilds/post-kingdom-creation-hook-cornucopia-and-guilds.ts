import { Match } from "shared/shared-types.ts";
import { createRewardKingdoms } from './configure-joust.ts';
import { CardLibrary } from '../../core/card-library.ts';

interface Args {
  match: Match;
  cardLibrary: CardLibrary;
}

const postKingdomCreationHookCornucopiaAndGuilds = (args: Args) => {
  createRewardKingdoms(args);
};

export default postKingdomCreationHookCornucopiaAndGuilds;
