import { loggerService } from '@logger';
import { ExpansionConfiguratorFactory, GameEventRegistrar } from '@server-types/index.ts';
import { configureReserve } from './configure-reserve.ts';
import { registerAdventuresTokenDefinitions } from './token-definitions-adventures.ts';
import { registerAdventuresTokenTriggers } from './token-triggers-adventures.ts';
import { ComputedMatchConfiguration, TokenId } from 'shared/types/index.ts';
import { adventuresTokenIds } from './token-ids-adventures.ts';
import { getCardPileKey } from '../../utils/get-card-pile-key.ts';

const configurator: ExpansionConfiguratorFactory = () => async (args) => {
  configureReserve(args);
  registerAdventuresTokenDefinitions(args.expansionRegistration.registerTokenDefinition);
  registerAdventuresTokenTriggers(args.expansionRegistration.registerTokenCardPlayedHandler);

  return args.config;
};

export const registerGameEvents: (registrar: GameEventRegistrar, config: ComputedMatchConfiguration) => void = (
  registrar,
  config,
) => {
  // Determine whether the Journey token is required for this match.
  const usesJourneyToken = config.kingdomSupply.some((supply) => supply.name === 'giant' || supply.name === 'ranger') ||
    config.events.some((event) => event.cardKey === 'pilgrimage');
  const usesFerryToken = config.events.some((event) => event.cardKey === 'ferry');
  // Determine whether Lost Arts is in the event lineup and needs the +1 Action token.
  const usesLostArtsToken = config.events.some((event) => event.cardKey === 'lost-arts');
  // Determine whether Raid is in the event lineup and needs the -1 Card token.
  const usesRaidToken = config.events.some((event) => event.cardKey === 'raid');
  // Determine whether Seaway is in the event lineup and needs the +1 Buy token.
  const usesSeawayToken = config.events.some((event) => event.cardKey === 'seaway');
  // Determine whether Training is in the event lineup and needs the +$1 token.
  const usesTrainingToken = config.events.some((event) => event.cardKey === 'training');
  // Determine whether Plan is in the event lineup and needs the Trashing token.
  const usesPlanToken = config.events.some((event) => event.cardKey === 'plan');
  // Determine whether Pathfinding is in the event lineup and needs the +1 Card token.
  const usesPathfindingToken = config.events.some((event) => event.cardKey === 'pathfinding');
  // Determine whether Inheritance is in the event lineup and needs the Estate token.
  const usesInheritanceToken = config.events.some((event) => event.cardKey === 'inheritance');
  // Register the -$1 token reaction handler for all Adventures games.
  registrar('onGameStart', async (args) => {
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
          return Object.values(match.tokens ?? {}).some((token) =>
            token.tokenId === adventuresTokenIds.minusCoin &&
            token.ownerId === player.id &&
            token.location.type === 'player' &&
            token.location.playerId === player.id
          );
        },
        triggeredEffectFn: async ({ match, actionService, trigger }) => {
          const tokenEntry = Object.entries(match.tokens ?? {}).find(([_tokenInstanceId, token]) =>
            token.tokenId === adventuresTokenIds.minusCoin &&
            token.ownerId === player.id &&
            token.location.type === 'player' &&
            token.location.playerId === player.id
          );
          if (!tokenEntry) return;

          loggerService.info(`[adventures treasureGain trigger] - receiving one less treasure`);

          // Consume the -$1 token once when a positive treasure gain occurs.
          trigger.args.count = Math.max(0, trigger.args.count - 1);
          // Carry the treasure source into the token consumption log.
          await actionService.run('removeToken', { tokenInstanceId: tokenEntry[0] }, {
            loggingContext: { source: trigger.args.source },
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
          return Object.values(match.tokens ?? {}).some((token) =>
            token.tokenId === adventuresTokenIds.minusCard &&
            token.ownerId === player.id &&
            token.location.type === 'playerDeck' &&
            token.location.playerId === player.id
          );
        },
        triggeredEffectFn: async ({ match, actionService, trigger }) => {
          const tokenEntry = Object.entries(match.tokens ?? {}).find(([_tokenInstanceId, token]) =>
            token.tokenId === adventuresTokenIds.minusCard &&
            token.ownerId === player.id &&
            token.location.type === 'playerDeck' &&
            token.location.playerId === player.id
          );
          if (!tokenEntry) return;

          loggerService.info(`[adventures drawCards trigger] - drawing one less card`);

          // Consume the -1 Card token once when a draw is attempted.
          trigger.args.count = Math.max(0, trigger.args.count - 1);
          // Carry the draw source into the token consumption log.
          await actionService.run('removeToken', { tokenInstanceId: tokenEntry[0] }, {
            loggingContext: { source: trigger.args.source },
          });
        },
      });
    }
  });
  // Place Journey tokens face up for each player when needed.
  if (usesJourneyToken) {
    registrar('onGameStart', async (args) => {
      for (const player of args.match.players) {
        // Avoid duplicating Journey tokens when reloading saved state.
        const alreadyOwned = Object.values(args.match.tokens ?? {}).some((token) =>
          token.ownerId === player.id &&
          token.tokenId === adventuresTokenIds.journey
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
    });
  }
  if (usesFerryToken) {
    registrar('onGameStart', async (args) => {
      for (const player of args.match.players) {
        const alreadyOwned = Object.values(args.match.tokens ?? {}).some((token) =>
          token.ownerId === player.id && token.tokenId === adventuresTokenIds.minusCostTwo
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
    registrar('onGameStart', async (args) => {
      // Lost Arts supplies a +1 Action token per player when the event is selected.
      for (const player of args.match.players) {
        const alreadyOwned = Object.values(args.match.tokens ?? {}).some((token) =>
          token.ownerId === player.id && token.tokenId === adventuresTokenIds.plusAction
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
    registrar('onGameStart', async (args) => {
      // Raid supplies a -1 Card token per player when the event is selected.
      for (const player of args.match.players) {
        const alreadyOwned = Object.values(args.match.tokens ?? {}).some((token) =>
          token.ownerId === player.id && token.tokenId === adventuresTokenIds.minusCard
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
    registrar('onGameStart', async (args) => {
      // Seaway supplies a +1 Buy token per player when the event is selected.
      for (const player of args.match.players) {
        const alreadyOwned = Object.values(args.match.tokens ?? {}).some((token) =>
          token.ownerId === player.id && token.tokenId === adventuresTokenIds.plusBuy
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
    registrar('onGameStart', async (args) => {
      // Training supplies a +$1 token per player when the event is selected.
      for (const player of args.match.players) {
        const alreadyOwned = Object.values(args.match.tokens ?? {}).some((token) =>
          token.ownerId === player.id && token.tokenId === adventuresTokenIds.plusCoin
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
    registrar('onGameStart', async (args) => {
      // Plan supplies a Trashing token per player and registers the on-gain trash option.
      for (const player of args.match.players) {
        const alreadyOwned = Object.values(args.match.tokens ?? {}).some((token) =>
          token.ownerId === player.id && token.tokenId === adventuresTokenIds.trashing
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
            return Object.values(match.tokens ?? {}).some((token) =>
              token.tokenId === adventuresTokenIds.trashing &&
              token.ownerId === player.id &&
              token.location.type === 'supplyPile' &&
              token.location.cardKey === pileKey
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
    registrar('onGameStart', async (args) => {
      // Pathfinding supplies a +1 Card token per player when the event is selected.
      for (const player of args.match.players) {
        const alreadyOwned = Object.values(args.match.tokens ?? {}).some((token) =>
          token.ownerId === player.id && token.tokenId === adventuresTokenIds.plusCard
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
    registrar('onGameStart', async (args) => {
      // Inheritance supplies an Estate token per player and registers Estate play handling.
      for (const player of args.match.players) {
        const alreadyOwned = Object.values(args.match.tokens ?? {}).some((token) =>
          token.ownerId === player.id && token.tokenId === adventuresTokenIds.estate
        );
        if (!alreadyOwned) {
          await args.actionService.run('placeToken', {
            tokenId: adventuresTokenIds.estate,
            ownerId: player.id,
            location: { type: 'playerAvailable', playerId: player.id },
          });
        }

        args.reactionManager.registerReactionTemplate({
          id: `adventures-estate-token:0:cardPlayed:${player.id}`,
          listeningFor: 'cardPlayed',
          playerId: player.id,
          once: false,
          compulsory: true,
          allowMultipleInstances: true,
          system: true,
          condition: async ({ trigger, match, cardLibrary }) => {
            if (trigger.args.playerId !== player.id) return false;
            const playedCard = cardLibrary.getCard(trigger.args.cardId);
            if (playedCard.cardKey !== 'estate') return false;
            return Object.values(match.tokens ?? {}).some((token) =>
              token.tokenId === adventuresTokenIds.estate &&
              token.ownerId === player.id &&
              token.location.type === 'card'
            );
          },
          triggeredEffectFn: async ({ match, actionService }) => {
            const estateToken = Object.values(match.tokens ?? {}).find((token) =>
              token.tokenId === adventuresTokenIds.estate &&
              token.ownerId === player.id &&
              token.location.type === 'card'
            );
            if (!estateToken || estateToken.location.type !== 'card') return;
            await actionService.run('playCard', {
              playerId: player.id,
              cardId: estateToken.location.cardId,
              overrides: { actionCost: 0, moveCard: false },
            });
          },
        });
      }
    });
  }
  // Only grant the vanilla bonus tokens when Teacher is in the kingdom.
  if (!config.kingdomSupply.some((supply) => supply.name === 'teacher')) {
    return;
  }

  loggerService.info(`[adventures configurator] setting up teacher onGameStart handler for vanilla tokens`);

  registrar('onGameStart', async (args) => {
    // Teacher grants one of each vanilla bonus token to every player.
    const tokenIds: TokenId[] = [
      adventuresTokenIds.plusAction,
      adventuresTokenIds.plusBuy,
      adventuresTokenIds.plusCard,
      adventuresTokenIds.plusCoin,
    ];

    for (const player of args.match.players) {
      for (const tokenId of tokenIds) {
        // Avoid duplicating tokens when a saved state already contains them.
        const alreadyOwned = Object.values(args.match.tokens ?? {}).some((token) =>
          token.ownerId === player.id && token.tokenId === tokenId
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
  });
};

export default configurator;
