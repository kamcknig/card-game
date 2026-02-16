import { ComputedMatchConfiguration } from 'shared/types/index.ts';
import { ExpansionConfiguratorFactory, GameEventRegistrar } from '@server-types/index.ts';
import { addMatToMatchConfig } from '../../utils/add-mat-to-match-config.ts';
import { expansionLibrary } from '../expansion-library.ts';

// Menagerie cards that require the Horse non-supply pile to be configured.
const horseSourcePiles = new Set(['cavalry']);

// Ensures the Horse pile is present only when required by selected kingdom cards.
const configureHorsePile = (config: ComputedMatchConfiguration) => {
  const hasHorseSource = config.kingdomSupply.some((supply) => horseSourcePiles.has(supply.name));
  const hasHorsePile = config.nonSupply?.some((supply) => supply.name === 'horse') ?? false;

  if (!hasHorseSource) {
    if (!hasHorsePile) {
      return;
    }
    console.info('[menagerie configurator] removing Horse pile because no Horse source cards are present');
    config.nonSupply = (config.nonSupply ?? []).filter((supply) => supply.name !== 'horse');
    return;
  }

  if (hasHorsePile) {
    return;
  }

  const baseHorse = structuredClone(expansionLibrary['menagerie']?.cardData.kingdomSupply['horse']);
  if (!baseHorse) {
    console.warn('[menagerie configurator] horse card data not found');
    return;
  }

  config.nonSupply ??= [];
  config.nonSupply.push({
    name: 'horse',
    cards: new Array(30).fill({
      ...baseHorse,
      partOfSupply: false,
      kingdomSelectable: false,
      tags: ['horse'],
    }),
  });
  console.info('[menagerie configurator] added Horse non-supply pile');
};

const configurator: ExpansionConfiguratorFactory = () => {
  return async (args) => {
    // Menagerie Exile mat is only needed when at least one selected Kingdom card uses it.
    const requiresExileMat = args.config.kingdomSupply.some((supply) =>
      supply.cards.some((card) => card.mat === 'exile')
    );

    if (!requiresExileMat) {
      configureHorsePile(args.config);
      return args.config;
    }

    // Avoid duplicate zone registration across configurator re-runs.
    const exileZoneAlreadyRegisteredForAllPlayers = args.config.players.every((player) => {
      try {
        args.cardSourceController.getSource('exile', player.id);
        return true;
      } catch {
        return false;
      }
    });

    if (exileZoneAlreadyRegisteredForAllPlayers) {
      console.debug('[menagerie configurator] exile mat already configured for all players');
      configureHorsePile(args.config);
      return args.config;
    }

    console.info('[menagerie configurator] adding exile mat zones for all players');
    addMatToMatchConfig('exile', args.config, args);
    configureHorsePile(args.config);
    return args.config;
  };
};

export default configurator;

// Registers Menagerie game-start hooks that provide dynamic cost rules.
export const registerGameEvents: (registrar: GameEventRegistrar, config: ComputedMatchConfiguration) => void = (
  registrar,
  config,
) => {
  const hasFisherman = config.kingdomSupply.some((supply) => supply.name === 'fisherman');
  const hasDestrier = config.kingdomSupply.some((supply) => supply.name === 'destrier');

  if (!hasFisherman && !hasDestrier) {
    return;
  }

  registrar('onGameStart', async (args) => {
    if (hasFisherman) {
      console.info('[menagerie configurator] registering Fisherman cost rules');
      const fishermanCards = args.findCards([
        { location: 'kingdomSupply' },
        { cardKeys: 'fisherman' },
      ]);

      for (const fishermanCard of fishermanCards) {
        args.cardPriceController.registerRule(fishermanCard, (_card, context) => {
          const currentTurnPlayer = context.match.players[context.match.currentPlayerTurnIndex];
          if (!currentTurnPlayer || currentTurnPlayer.id !== context.playerId) {
            return { restricted: false, cost: { treasure: 0 } };
          }

          const discardPile = args.cardSourceController.getSource('playerDiscard', context.playerId);
          if (discardPile.length > 0) {
            return { restricted: false, cost: { treasure: 0 } };
          }

          return { restricted: false, cost: { treasure: -3 } };
        });
      }
    }

    if (hasDestrier) {
      console.info('[menagerie configurator] registering Destrier cost rules');
      const destrierCards = args.findCards([
        { location: 'kingdomSupply' },
        { cardKeys: 'destrier' },
      ]);

      for (const destrierCard of destrierCards) {
        args.cardPriceController.registerRule(destrierCard, (_card, context) => {
          const currentTurnPlayer = context.match.players[context.match.currentPlayerTurnIndex];
          if (!currentTurnPlayer || currentTurnPlayer.id !== context.playerId) {
            return { restricted: false, cost: { treasure: 0 } };
          }

          const currentTurnHistoryIndex = context.match.stats.turns.length - 1;
          if (currentTurnHistoryIndex < 0) {
            return { restricted: false, cost: { treasure: 0 } };
          }

          const gainedCardIds = context.match.stats.cardsGainedByTurn[currentTurnHistoryIndex] ?? [];
          const gainedCardCount = gainedCardIds.filter((gainedCardId) => {
            const gainStats = context.match.stats.cardsGained[gainedCardId];
            return gainStats?.turnHistoryIndex === currentTurnHistoryIndex &&
              gainStats.playerId === context.playerId;
          }).length;

          if (gainedCardCount < 1) {
            return { restricted: false, cost: { treasure: 0 } };
          }

          return { restricted: false, cost: { treasure: -gainedCardCount } };
        });
      }
    }
  });
};
