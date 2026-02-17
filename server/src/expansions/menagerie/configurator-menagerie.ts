import { ComputedMatchConfiguration } from 'shared/types/index.ts';
import { ExpansionConfiguratorContext, ExpansionConfiguratorFactory, GameEventRegistrar } from '@server-types/index.ts';
import { addMatToMatchConfig } from '../../utils/add-mat-to-match-config.ts';

// Menagerie cards that require the Horse non-supply pile to be configured.
const horseSourcePiles = new Set([
  'cavalry',
  'groom',
  'hostelry',
  'livery',
  'paddock',
  'scrap',
  'sleigh',
  'supplies',
]);

// Menagerie events that require the Horse non-supply pile.
const horseSourceEvents = new Set([
  'bargain',
  'demand',
  'ride',
  'stampede',
]);

// Menagerie events that require the Exile mat.
const exileMatEvents = new Set([
  'banish',
  'enclave',
  'invest',
  'transport',
]);

// Ensures the Horse pile is present only when required by selected kingdom cards.
const configureHorsePile = (configuratorArgs: ExpansionConfiguratorContext) => {
  const config = configuratorArgs.config;
  const hasHorseSource = config.kingdomSupply.some((supply) => horseSourcePiles.has(supply.name)) ||
    config.events.some((event) => horseSourceEvents.has(event.cardKey));
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

  const baseHorse = structuredClone(configuratorArgs.expansionCatalog['menagerie']?.cardData.kingdomSupply['horse']);
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
    // Menagerie Exile mat is needed when selected Kingdom cards or Events use Exile.
    const requiresExileMat = args.config.kingdomSupply.some((supply) =>
      supply.cards.some((card) => card.mat === 'exile')
    ) || args.config.events.some((event) => exileMatEvents.has(event.cardKey));

    if (!requiresExileMat) {
      configureHorsePile(args);
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
      configureHorsePile(args);
      return args.config;
    }

    console.info('[menagerie configurator] adding exile mat zones for all players');
    addMatToMatchConfig('exile', args.config, args);
    configureHorsePile(args);
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
  const hasWayfarer = config.kingdomSupply.some((supply) => supply.name === 'wayfarer');

  if (!hasFisherman && !hasDestrier && !hasWayfarer) {
    return;
  }

  registrar('onGameStart', async (args) => {
    if (hasFisherman) {
      console.info('[menagerie configurator] registering Fisherman cost rules');
      const fishermanCards = args.findCardService.findCards([
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
      const destrierCards = args.findCardService.findCards([
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

    if (hasWayfarer) {
      console.info('[menagerie configurator] registering Wayfarer cost rules');
      const wayfarerCards = args.findCardService.findCards([
        { location: 'kingdomSupply' },
        { cardKeys: 'wayfarer' },
      ]);

      for (const wayfarerCard of wayfarerCards) {
        args.cardPriceController.registerRule(wayfarerCard, (_card, context) => {
          const currentTurnHistoryIndex = context.match.stats.turns.length - 1;
          if (currentTurnHistoryIndex < 0) {
            return { restricted: false, cost: { treasure: 0 } };
          }

          const gainedCardIds = context.match.stats.cardsGainedByTurn[currentTurnHistoryIndex] ?? [];
          let lastOtherGainedCardId: number | undefined;

          // Scan backward to find the last non-Wayfarer card gained this turn.
          for (let gainIndex = gainedCardIds.length - 1; gainIndex >= 0; gainIndex--) {
            const gainedCardId = gainedCardIds[gainIndex];
            const gainStats = context.match.stats.cardsGained[gainedCardId];
            if (gainStats?.turnHistoryIndex !== currentTurnHistoryIndex) {
              continue;
            }

            const gainedCard = args.cardLibrary.getCard(gainedCardId);
            if (gainedCard.cardKey === 'wayfarer') {
              continue;
            }

            lastOtherGainedCardId = gainedCardId;
            break;
          }

          if (lastOtherGainedCardId === undefined) {
            return { restricted: false, cost: { treasure: 0 } };
          }

          const lastOtherGainedCard = args.cardLibrary.getCard(lastOtherGainedCardId);
          const { cost: lastGainedCardCost } = args.cardPriceController.applyRules(lastOtherGainedCard, {
            playerId: context.playerId,
          });

          // Adjust Wayfarer by the delta from its printed cost to the tracked gained-card cost.
          return {
            restricted: false,
            cost: {
              treasure: lastGainedCardCost.treasure - (wayfarerCard.cost.treasure ?? 0),
              potion: (lastGainedCardCost.potion ?? 0) - (wayfarerCard.cost.potion ?? 0),
              debt: (lastGainedCardCost.debt ?? 0) - (wayfarerCard.cost.debt ?? 0),
            },
          };
        });
      }
    }
  });
};
