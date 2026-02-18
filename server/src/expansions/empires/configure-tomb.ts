import { loggerService } from '@logger';
import { ComputedMatchConfiguration } from 'shared/types/index.ts';
import { GameEventRegistrar } from '@server-types/index.ts';

export const configureTomb = (
  registrar: GameEventRegistrar,
  config: ComputedMatchConfiguration,
) => {
  // Only register Tomb handlers when the landmark is present.
  const hasTomb = (config.landmarks ?? []).some(
    (landmark) => landmark.cardKey === 'tomb',
  );
  if (!hasTomb) return;

  loggerService.info(`[empires configurator] setting up tomb landmark handlers`);

  registrar('onGameStart', async (args) => {
    // Locate the Tomb landmark instance to attach reaction metadata.
    const tombLandmark = args.match.landmarks.find(
      (landmark) => landmark.cardKey === 'tomb',
    );
    if (!tombLandmark) {
      loggerService.warn(
        `[tomb onGameStart] Tomb landmark instance missing, skipping reaction registration`,
      );
      return;
    }

    // Register the on-trash reaction for each player.
    for (const player of args.match.players) {
      args.reactionManager.registerReactionTemplate(
        tombLandmark,
        'cardTrashed',
        {
          playerId: player.id,
          once: false,
          allowMultipleInstances: true,
          compulsory: true,
          autoResolve: true,
          condition: (conditionArgs) => {
            // Only award VP to the player who trashed the card.
            if (conditionArgs.trigger.args.playerId !== player.id) return false;
            return true;
          },
          triggeredEffectFn: async (triggeredArgs) => {
            // Grant the Tomb victory token bonus for each trashed card.
            const trashedCard = triggeredArgs.cardLibrary.getCard(
              triggeredArgs.trigger.args.cardId,
            );
            loggerService.info(
              `[tomb cardTrashed] player ${player.id} trashed ${trashedCard}, gaining 1 VP`,
            );
            await triggeredArgs.actionService.run('gainVictoryToken', {
              playerId: player.id,
              count: 1,
            });
          },
        },
        // Ensure each player's reaction has a unique id suffix.
        { idSuffix: player.id.toString() },
      );
    }
  });
};
