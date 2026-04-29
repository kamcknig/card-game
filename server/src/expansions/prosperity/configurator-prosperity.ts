import {
  EndGamePolicyRegistrar,
  ExpansionConfiguratorFactory,
  FindCardService,
  GameEventRegistrar,
} from '@server-types/index.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
import { getCurrentPlayer } from '../../utils/get-current-player.ts';
import { CardPriceRule } from '../../core/card-price-rules-controller.ts';
import { ComputedMatchConfiguration, Match } from 'shared/types/index.ts';
import { registerProsperityTokenDefinitions } from './token-definitions-prosperity.ts';

const configurator: ExpansionConfiguratorFactory = () => {
  let charlatanConfigured: boolean = false;
  let prosperityCheckConfigured: boolean = false;

  return async args => {
    registerProsperityTokenDefinitions(args.expansionRegistration.registerTokenDefinition);

    const kingdomCards = args.config.kingdomSupply;
    // Standard Dominion rule: add Colony/Platinum when any Prosperity kingdoms card is present.
    const hasProsperityKingdom = kingdomCards.some(supply =>
      supply.cards.some(card => card.expansionName === 'prosperity'),
    );

    const basicCards = args.config.basicSupply;

    if (hasProsperityKingdom && !prosperityCheckConfigured) {
      args.loggerService.log(`[prosperity configurator] adding prosperity and colony to config`);

      basicCards.push({
        name: 'colony',
        cards: new Array(args.config.players.length >= 3 ? 12 : 8).fill(
          args.expansionData.cardData.basicSupply['colony'],
        ),
      });

      basicCards.push({
        name: 'platinum',
        cards: new Array(12).fill(args.expansionData.cardData.basicSupply['platinum']),
      });

      prosperityCheckConfigured = true;
    }

    const charlatanPresent = kingdomCards.find(supply => supply.name === 'charlatan');

    if (charlatanPresent && !charlatanConfigured) {
      args.loggerService.log(
        `[prosperity configurator] charlatan is part of kingdom - curses gain the treasure type and +1 treasure effect`,
      );

      const curseCard = basicCards.find(supply => supply.name === 'curse');

      if (!curseCard) {
        args.loggerService.warn(`[prosperity configurator] curse card not found in config`);
      }

      curseCard?.cards?.forEach(card => card.type.push('TREASURE'));

      args.expansionRegistration.registerCardEffect('curse', 'prosperity', async args => {
        args.loggerService.info(`[curse effect - prosperity] curse effect called`);
        await args.actionService.run('gainTreasure', { count: 1 });
      });

      charlatanConfigured = true;
    }

    return args.config;
  };
};

export const registerEndGamePolicies = (registrar: EndGamePolicyRegistrar) => {
  // Must run before Fleet policy so endTriggered is available to Fleet.
  registrar(
    ({ match, findCardService }) => ({
      endTriggered: isColonyPileEmpty(match, findCardService),
      decision: 'continue',
    }),
    { priority: 10 },
  );
};

function isColonyPileEmpty(match: Match, findCardService: FindCardService): boolean {
  const colonyPresent = match.config.kingdomSupply.some(supply => supply.name === 'colony');
  if (!colonyPresent) {
    return false;
  }
  const colonyCards = findCardService.findCards({ all: [{ location: 'basicSupply' }, { cardKeys: 'colony' }] });
  return colonyCards.length === 0;
}

export const registerGameEvents: (
  registrar: GameEventRegistrar,
  config: ComputedMatchConfiguration,
) => void = registrar => {
  registrar('onGameStartSetup', async args => {
    const peddlerCardIds = args.findCardService
      .findCards({ all: [{ location: 'kingdomSupply' }, { cardKeys: 'peddler' }] })
      .map(card => card.id);

    if (peddlerCardIds.length === 0) {
      return;
    }

    args.loggerService.info(`[prosperity onGameStart event] registering peddler game events`);

    for (const cardId of peddlerCardIds) {
      for (const player of args.match.players) {
        let ruleUnsub = () => void 0;
        args.reactionManager.registerReactionTemplate({
          id: `peddler:${cardId}:endTurnPhase`,
          listeningFor: 'endTurnPhase',
          playerId: player.id,
          once: false,
          compulsory: true,
          allowMultipleInstances: true,
          condition: conditionArgs => {
            if (getTurnPhase(conditionArgs.trigger.args.phaseIndex) !== 'buy') {
              return false;
            }
            return getCurrentPlayer(conditionArgs.match).id === player.id;
          },
          triggeredEffectFn: async () => {
            ruleUnsub();
            ruleUnsub = () => void 0;
          },
        });

        args.reactionManager.registerReactionTemplate({
          id: `peddler:${cardId}:startTurnPhase`,
          listeningFor: 'startTurnPhase',
          playerId: player.id,
          compulsory: true,
          once: false,
          allowMultipleInstances: true,
          condition: conditionArgs => {
            if (getTurnPhase(conditionArgs.trigger.args.phaseIndex) !== 'buy') {
              return false;
            }
            return getCurrentPlayer(conditionArgs.match).id === player.id;
          },
          triggeredEffectFn: async triggerEffectArgs => {
            const peddlerCard = triggerEffectArgs.cardLibrary.getCard(cardId);

            args.loggerService.info(`[peddler triggered effect] adding pricing rule for ${peddlerCard}`);

            const rule: CardPriceRule = (ruleCard, ruleContext) => {
              const cardsInPlay = args.findCardService.getCardsInPlay();
              const actionsInPlay = cardsInPlay.filter(card => card.type.includes('ACTION'));
              if (actionsInPlay.length === 0) {
                return { restricted: false, cost: { treasure: 0 } };
              }

              return {
                restricted: false,
                cost: { treasure: -actionsInPlay.length * 2 },
              };
            };

            ruleUnsub = args.cardPriceController.registerRule(peddlerCard, rule);
          },
        });
      }
    }
  });
};

export default configurator;
