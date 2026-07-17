import { ExpansionConfiguratorFactory, GameEventRegistrar, GameLifecycleCallbackContext } from '@server-types/index.ts';
import { configureReserve } from './configure-reserve.ts';
import { configureTravellers } from './configure-travellers.ts';
import { registerAdventuresTokenDefinitions } from './token-definitions-adventures.ts';
import { registerAdventuresTokenTriggers } from './token-triggers-adventures.ts';
import { ComputedMatchConfiguration, TokenId } from 'shared/types/index.ts';
import { adventuresTokenIds } from './token-ids-adventures.ts';
import { getCardPileKey } from '../../utils/get-card-pile-key.ts';

const configurator: ExpansionConfiguratorFactory = () => async args => {
  configureReserve(args);
  await configureTravellers(args);
  registerAdventuresTokenDefinitions(args.expansionRegistration.registerTokenDefinition);
  registerAdventuresTokenTriggers(args.expansionRegistration.registerTokenCardPlayedHandler);

  return args.config;
};

// Places the face-up Journey token in each player's area. Extracted from the game-start handler so
// it can also run when Giant or Ranger is dealt mid-game by Rising Sun's Divine Wind. Idempotent:
// skips any player who already owns a Journey token (safe on reload and on repeated dispatch).
export const setupJourneyTokens = async (args: Omit<GameLifecycleCallbackContext, 'cardId'>): Promise<void> => {
  for (const player of args.match.players) {
    // Avoid duplicating Journey tokens when reloading saved state or re-dispatching.
    const alreadyOwned = Object.values(args.match.tokens ?? {}).some(
      token => token.ownerId === player.id && token.tokenId === adventuresTokenIds.journey,
    );
    if (alreadyOwned) continue;
    // Place the Journey token in the player's area, face up to start.
    await args.actionService.run('placeToken', {
      tokenId: adventuresTokenIds.journey,
      ownerId: player.id,
      location: { type: 'player', playerId: player.id },
      facing: 'faceUp',
    });
  }
};

// Places a -$1 token in each player's available area. Extracted from the Bridge Troll / Ball
// game-start handler so it can also run when Bridge Troll is dealt mid-game (Divine Wind).
// Idempotent: skips any player who already owns a -$1 token.
export const setupMinusCoinTokens = async (args: Omit<GameLifecycleCallbackContext, 'cardId'>): Promise<void> => {
  for (const player of args.match.players) {
    const alreadyOwned = Object.values(args.match.tokens ?? {}).some(
      token => token.ownerId === player.id && token.tokenId === adventuresTokenIds.minusCoin,
    );
    if (alreadyOwned) continue;
    await args.actionService.run('placeToken', {
      tokenId: adventuresTokenIds.minusCoin,
      ownerId: player.id,
      location: { type: 'playerAvailable', playerId: player.id },
    });
  }
};

// Grants each player one of every vanilla bonus token (Teacher's setup). Extracted from the
// game-start handler so it can also run when the Peasant Traveller line (which upgrades into
// Teacher) is dealt mid-game (Divine Wind). Idempotent: skips tokens a player already owns.
export const setupTeacherTokens = async (args: Omit<GameLifecycleCallbackContext, 'cardId'>): Promise<void> => {
  const tokenIds: TokenId[] = [
    adventuresTokenIds.plusAction,
    adventuresTokenIds.plusBuy,
    adventuresTokenIds.plusCard,
    adventuresTokenIds.plusCoin,
  ];

  for (const player of args.match.players) {
    for (const tokenId of tokenIds) {
      // Avoid duplicating tokens when a saved state already contains them.
      const alreadyOwned = Object.values(args.match.tokens ?? {}).some(
        token => token.ownerId === player.id && token.tokenId === tokenId,
      );
      if (alreadyOwned) continue;
      // Place unassigned tokens in the player's area until they are moved to a supply pile.
      await args.actionService.run('placeToken', {
        tokenId,
        ownerId: player.id,
        location: { type: 'playerAvailable', playerId: player.id },
      });
    }
  }
};

export const registerGameEvents: (registrar: GameEventRegistrar, config: ComputedMatchConfiguration) => void = (
  registrar,
  config,
) => {
  // Determine whether the Journey token is required for this match.
  const usesJourneyToken =
    config.kingdomSupply.some(supply => supply.name === 'giant' || supply.name === 'ranger') ||
    config.events.some(event => event.cardKey === 'pilgrimage');
  const usesFerryToken = config.events.some(event => event.cardKey === 'ferry');
  // Determine whether Lost Arts is in the event lineup and needs the +1 Action token.
  const usesLostArtsToken = config.events.some(event => event.cardKey === 'lost-arts');
  // Determine whether Raid is in the event lineup and needs the -1 Card token.
  const usesRaidToken = config.events.some(event => event.cardKey === 'raid');
  // Determine whether Seaway is in the event lineup and needs the +1 Buy token.
  const usesSeawayToken = config.events.some(event => event.cardKey === 'seaway');
  // Determine whether Training is in the event lineup and needs the +$1 token.
  const usesTrainingToken = config.events.some(event => event.cardKey === 'training');
  // Determine whether Plan is in the event lineup and needs the Trashing token.
  const usesPlanToken = config.events.some(event => event.cardKey === 'plan');
  // Determine whether Pathfinding is in the event lineup and needs the +1 Card token.
  const usesPathfindingToken = config.events.some(event => event.cardKey === 'pathfinding');
  // Determine whether Inheritance is in the event lineup and needs the Estate token.
  const usesInheritanceToken = config.events.some(event => event.cardKey === 'inheritance');
  // Determine whether Bridge Troll or Ball needs the -$1 token at game start.
  const usesMinusCoinToken =
    config.kingdomSupply.some(supply => supply.name === 'bridge-troll') ||
    config.events.some(event => event.cardKey === 'ball');
  // Register the -$1 token reaction handler for all Adventures games.
  registrar('onGameStartSetup', async args => {
    for (const player of args.match.players) {
      args.reactionManager.registerReactionTemplate({
        id: `adventures-minus-coin-token:0:treasureGain:${player.id}`,
        listeningFor: 'treasureGain',
        playerId: player.id,
        once: false,
        compulsory: true,
        allowMultipleInstances: true,
        system: true,
        condition: async ({ trigger, match }) => {
          if (trigger.args.playerId !== player.id) return false;
          if (trigger.args.count <= 0) return false;
          // Only react when the player's -$1 token is currently in front of them.
          return Object.values(match.tokens ?? {}).some(
            token =>
              token.tokenId === adventuresTokenIds.minusCoin &&
              token.ownerId === player.id &&
              token.location.type === 'player' &&
              token.location.playerId === player.id,
          );
        },
        triggeredEffectFn: async ({ match, actionService, trigger }) => {
          const tokenEntry = Object.entries(match.tokens ?? {}).find(
            ([_tokenInstanceId, token]) =>
              token.tokenId === adventuresTokenIds.minusCoin &&
              token.ownerId === player.id &&
              token.location.type === 'player' &&
              token.location.playerId === player.id,
          );
          if (!tokenEntry) return;

          args.loggerService.info(`[adventures treasureGain trigger] - receiving one less treasure`);

          // Consume the -$1 token once when a positive treasure gain occurs.
          trigger.args.count = Math.max(0, trigger.args.count - 1);
          // Return the -$1 token to the player's available area after consumption.
          await actionService.run('moveToken', {
            tokenInstanceId: tokenEntry[0],
            location: { type: 'playerAvailable', playerId: player.id },
          });
        },
      });
      args.reactionManager.registerReactionTemplate({
        id: `adventures-minus-card-token:0:drawCards:${player.id}`,
        listeningFor: 'drawCards',
        playerId: player.id,
        once: false,
        compulsory: true,
        allowMultipleInstances: true,
        system: true,
        condition: async ({ trigger, match }) => {
          if (trigger.args.playerId !== player.id) return false;
          if (trigger.args.count <= 0) return false;
          // Only react when the player's -1 Card token is on their deck.
          return Object.values(match.tokens ?? {}).some(
            token =>
              token.tokenId === adventuresTokenIds.minusCard &&
              token.ownerId === player.id &&
              token.location.type === 'playerDeck' &&
              token.location.playerId === player.id,
          );
        },
        triggeredEffectFn: async ({ match, actionService, trigger }) => {
          const tokenEntry = Object.entries(match.tokens ?? {}).find(
            ([_tokenInstanceId, token]) =>
              token.tokenId === adventuresTokenIds.minusCard &&
              token.ownerId === player.id &&
              token.location.type === 'playerDeck' &&
              token.location.playerId === player.id,
          );
          if (!tokenEntry) return;

          args.loggerService.info(`[adventures drawCards trigger] - drawing one less card`);

          // Consume the -1 Card token once when a draw is attempted.
          trigger.args.count = Math.max(0, trigger.args.count - 1);
          // Return the -1 Card token to the player's available area after
          // consumption — it's a permanent physical token (Raid can place it
          // on top of a deck again later), so it must not be destroyed.
          await actionService.run(
            'moveToken',
            {
              tokenInstanceId: tokenEntry[0],
              location: { type: 'playerAvailable', playerId: player.id },
            },
            {
              source: trigger.args.source,
            },
          );
        },
      });
    }
  });
  // Place Journey tokens face up for each player when needed.
  if (usesJourneyToken) {
    registrar('onGameStartSetup', async args => {
      await setupJourneyTokens(args);
    });
  }
  if (usesFerryToken) {
    registrar('onGameStartSetup', async args => {
      for (const player of args.match.players) {
        const alreadyOwned = Object.values(args.match.tokens ?? {}).some(
          token => token.ownerId === player.id && token.tokenId === adventuresTokenIds.minusCostTwo,
        );
        if (alreadyOwned) continue;
        await args.actionService.run('placeToken', {
          tokenId: adventuresTokenIds.minusCostTwo,
          ownerId: player.id,
          location: { type: 'playerAvailable', playerId: player.id },
        });
      }
    });
  }
  if (usesLostArtsToken) {
    registrar('onGameStartSetup', async args => {
      // Lost Arts supplies a +1 Action token per player when the event is selected.
      for (const player of args.match.players) {
        const alreadyOwned = Object.values(args.match.tokens ?? {}).some(
          token => token.ownerId === player.id && token.tokenId === adventuresTokenIds.plusAction,
        );
        if (alreadyOwned) continue;
        await args.actionService.run('placeToken', {
          tokenId: adventuresTokenIds.plusAction,
          ownerId: player.id,
          location: { type: 'playerAvailable', playerId: player.id },
        });
      }
    });
  }
  if (usesRaidToken) {
    registrar('onGameStartSetup', async args => {
      // Raid supplies a -1 Card token per player when the event is selected.
      for (const player of args.match.players) {
        const alreadyOwned = Object.values(args.match.tokens ?? {}).some(
          token => token.ownerId === player.id && token.tokenId === adventuresTokenIds.minusCard,
        );
        if (alreadyOwned) continue;
        await args.actionService.run('placeToken', {
          tokenId: adventuresTokenIds.minusCard,
          ownerId: player.id,
          location: { type: 'playerAvailable', playerId: player.id },
        });
      }
    });
  }
  if (usesSeawayToken) {
    registrar('onGameStartSetup', async args => {
      // Seaway supplies a +1 Buy token per player when the event is selected.
      for (const player of args.match.players) {
        const alreadyOwned = Object.values(args.match.tokens ?? {}).some(
          token => token.ownerId === player.id && token.tokenId === adventuresTokenIds.plusBuy,
        );
        if (alreadyOwned) continue;
        await args.actionService.run('placeToken', {
          tokenId: adventuresTokenIds.plusBuy,
          ownerId: player.id,
          location: { type: 'playerAvailable', playerId: player.id },
        });
      }
    });
  }
  if (usesTrainingToken) {
    registrar('onGameStartSetup', async args => {
      // Training supplies a +$1 token per player when the event is selected.
      for (const player of args.match.players) {
        const alreadyOwned = Object.values(args.match.tokens ?? {}).some(
          token => token.ownerId === player.id && token.tokenId === adventuresTokenIds.plusCoin,
        );
        if (alreadyOwned) continue;
        await args.actionService.run('placeToken', {
          tokenId: adventuresTokenIds.plusCoin,
          ownerId: player.id,
          location: { type: 'playerAvailable', playerId: player.id },
        });
      }
    });
  }
  if (usesPlanToken) {
    registrar('onGameStartSetup', async args => {
      // Plan supplies a Trashing token per player and registers the on-gain trash option.
      for (const player of args.match.players) {
        const alreadyOwned = Object.values(args.match.tokens ?? {}).some(
          token => token.ownerId === player.id && token.tokenId === adventuresTokenIds.trashing,
        );
        if (!alreadyOwned) {
          await args.actionService.run('placeToken', {
            tokenId: adventuresTokenIds.trashing,
            ownerId: player.id,
            location: { type: 'playerAvailable', playerId: player.id },
          });
        }

        args.reactionManager.registerReactionTemplate({
          id: `adventures-trashing-token:0:cardGained:${player.id}`,
          listeningFor: 'cardGained',
          playerId: player.id,
          once: false,
          compulsory: false,
          allowMultipleInstances: true,
          system: true,
          condition: async ({ trigger, match, cardLibrary }) => {
            if (trigger.args.playerId !== player.id) return false;
            // Match the gained card's originating pile to the player's Trashing token location.
            const gainedCard = cardLibrary.getCard(trigger.args.cardId);
            const pileKey = getCardPileKey(gainedCard);
            return Object.values(match.tokens ?? {}).some(
              token =>
                token.tokenId === adventuresTokenIds.trashing &&
                token.ownerId === player.id &&
                token.location.type === 'supplyPile' &&
                token.location.cardKey === pileKey,
            );
          },
          triggeredEffectFn: async ({ cardSourceController, actionService }) => {
            // Offer to trash a card from hand when the token matches the gained pile.
            const hand = cardSourceController.getSource('playerHand', player.id);
            if (!hand.length) return;
            const selectedCardId = await actionService.run('selectSingleCard', {
              playerId: player.id,
              prompt: 'Trash a card',
              restrict: hand,
              count: { kind: 'upTo', count: 1 },
            });
            if (!selectedCardId) return;
            await actionService.run('trashCard', {
              playerId: player.id,
              cardId: selectedCardId,
            });
          },
        });
      }
    });
  }
  if (usesPathfindingToken) {
    registrar('onGameStartSetup', async args => {
      // Pathfinding supplies a +1 Card token per player when the event is selected.
      for (const player of args.match.players) {
        const alreadyOwned = Object.values(args.match.tokens ?? {}).some(
          token => token.ownerId === player.id && token.tokenId === adventuresTokenIds.plusCard,
        );
        if (alreadyOwned) continue;
        await args.actionService.run('placeToken', {
          tokenId: adventuresTokenIds.plusCard,
          ownerId: player.id,
          location: { type: 'playerAvailable', playerId: player.id },
        });
      }
    });
  }
  if (usesInheritanceToken) {
    registrar('onGameStartSetup', async args => {
      // Inheritance supplies an Estate token per player; Estate-replay
      // handling is registered turn-scoped by the event effect itself
      // (registerCardPlayedReaction in event-effects-adventures.ts),
      // matching the card text's "(During your turns, ...)" restriction.
      for (const player of args.match.players) {
        const alreadyOwned = Object.values(args.match.tokens ?? {}).some(
          token => token.ownerId === player.id && token.tokenId === adventuresTokenIds.estate,
        );
        if (!alreadyOwned) {
          await args.actionService.run('placeToken', {
            tokenId: adventuresTokenIds.estate,
            ownerId: player.id,
            location: { type: 'playerAvailable', playerId: player.id },
          });
        }
      }
    });
  }
  if (usesMinusCoinToken) {
    registrar('onGameStartSetup', async args => {
      // Bridge Troll / Ball supply a -$1 token per player at game start.
      await setupMinusCoinTokens(args);
    });
  }
  // Only grant the vanilla bonus tokens when Teacher is in the kingdoms.
  if (!config.kingdomSupply.some(supply => supply.name === 'teacher')) {
    return;
  }

  registrar('onGameStartSetup', async args => {
    // Teacher grants one of each vanilla bonus token to every player.
    await setupTeacherTokens(args);
  });
};

export default configurator;
