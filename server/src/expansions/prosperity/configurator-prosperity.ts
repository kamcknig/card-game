import {
  EndGamePolicyRegistrar,
  ExpansionConfiguratorFactory,
  FindCardService,
  GameEventRegistrar,
  GameLifecycleCallbackContext,
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
  // Colony is added to the BASIC supply by this configurator (see basicCards.push
  // above), not kingdomSupply — check the pile it's actually configured into.
  const colonyPresent = match.config.basicSupply.some(supply => supply.name === 'colony');
  if (!colonyPresent) {
    return false;
  }
  const colonyCards = findCardService.findCards({ all: [{ location: 'basicSupply' }, { cardKeys: 'colony' }] });
  return colonyCards.length === 0;
}

// Registers Peddler's dynamic buy-phase price rules for every Peddler pile currently in the Supply.
// Extracted from the onGameStartSetup handler so it can also be dispatched when Peddler is dealt
// mid-game by Rising Sun's Divine Wind (FAQ: new piles run their Setup). Behavior at the original
// game-start call site is unchanged — it looks up Peddler in kingdomSupply and no-ops when absent.
export const setupPeddlerPriceRules = async (args: Omit<GameLifecycleCallbackContext, 'cardId'>): Promise<void> => {
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
            const actionsInPlay = cardsInPlay.filter(
              card => card.type.includes('ACTION') && card.owner === ruleContext.playerId,
            );
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
};

// Applies Charlatan's Setup to already-instantiated Curse cards and registers the "when you play a
// Curse, +$1" rule. Used only when Charlatan is dealt mid-game by Rising Sun's Divine Wind: at that
// point Curses already exist as card instances (they are basic supply), so the config-time retype in
// the configurator above cannot reach them, and the config-time `registerCardEffect('curse', ...)`
// path is unreachable from the runtime game-event context. This runtime variant therefore (1) adds
// the TREASURE type to existing Curse instances so they can be played as Treasures and (2) registers
// a per-player `cardPlayed` reaction granting +$1 when a Curse is played — the reaction is the
// runtime-reachable equivalent of the config-time curse effect. The normal (non-Divine-Wind) game
// still uses the configurator's config-time retype + registerCardEffect path unchanged.
export const setupCharlatanCurses = (args: Omit<GameLifecycleCallbackContext, 'cardId'>): void => {
  const curseCards = args.findCardService.findCards({ cardKeys: 'curse' });
  if (curseCards.length === 0) {
    args.loggerService.warn('[charlatan setup] no Curse card instances found; skipping Curse retype');
    return;
  }

  // Retype every Curse instance to a Treasure (guarded so re-running never double-adds the type).
  let retypedCount = 0;
  for (const curseCard of curseCards) {
    if (!curseCard.type.includes('TREASURE')) {
      curseCard.type.push('TREASURE');
      retypedCount++;
    }
  }
  args.loggerService.info(
    `[charlatan setup] retyped ${retypedCount} Curse instance(s) to Treasure for mid-game Charlatan deal`,
  );

  // Use a live Charlatan card as the reaction source so the +$1 rule is attributed to Charlatan.
  const charlatanCard = args.findCardService
    .findCards({ all: [{ location: 'kingdomSupply' }, { cardKeys: 'charlatan' }] })[0];
  if (!charlatanCard) {
    args.loggerService.warn('[charlatan setup] no Charlatan card found in kingdomSupply; skipping curse play rule');
    return;
  }

  for (const player of args.match.players) {
    const playerId = player.id;
    args.reactionManager.registerReactionTemplate(
      charlatanCard,
      'cardPlayed',
      {
        playerId,
        compulsory: true,
        once: false,
        allowMultipleInstances: false,
        condition: ({ trigger, cardLibrary }) => {
          if (trigger.args.playerId !== playerId) {
            return false;
          }
          return cardLibrary.getCard(trigger.args.cardId).cardKey === 'curse';
        },
        triggeredEffectFn: async ({ actionService, loggerService }) => {
          loggerService.info(`[charlatan setup] player ${playerId} played a Curse; +$1 (Charlatan)`);
          await actionService.run('gainTreasure', { count: 1 });
        },
      },
      { idSuffix: `charlatan-curse-treasure:${playerId}` },
    );
  }
};

export const registerGameEvents: (
  registrar: GameEventRegistrar,
  config: ComputedMatchConfiguration,
) => void = registrar => {
  registrar('onGameStartSetup', async args => {
    await setupPeddlerPriceRules(args);
  });
};

export default configurator;
