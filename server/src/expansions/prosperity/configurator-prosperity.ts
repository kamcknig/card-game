import {
  EndGameConditionRegistrar,
  ExpansionConfiguratorFactory,
  GameEventRegistrar,
  PlayerScoreDecoratorRegistrar,
} from '../../types.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
import { getCurrentPlayer } from '../../utils/get-current-player.ts';
import { CardPriceRule } from '../../core/card-price-rules-controller.ts';
import { getCardsInPlay } from '../../utils/get-cards-in-play.ts';
import { ComputedMatchConfiguration } from 'shared/shared-types.ts';

const configurator: ExpansionConfiguratorFactory = () => {
  let charlatanConfigured: boolean = false;
  let prosperityCheckConfigured: boolean = false;
  
  return async (args) => {
    const kingdomCards = args.config.kingdomSupply;
    const randomKingdomCard = kingdomCards[Math.floor(kingdomCards.length * Math.random())];
    
    console.log(`[prosperity configurator] random kingdom chosen to determine if colony and prosperity should be added to config '${randomKingdomCard.cards[0].kingdom}'`);
    
    const basicCards = args.config.basicSupply;
    
    if (randomKingdomCard.cards[0].expansionName === 'prosperity' && !prosperityCheckConfigured) {
      console.log(`[prosperity configurator] adding prosperity and colony to config`);
      
      basicCards.push({
        name: 'colony',
        cards: new Array(args.config.players.length >= 3 ? 12 : 8).fill(args.expansionData.cardData.basicSupply['colony'])
      });
      
      basicCards.push({
        name: 'platinum',
        cards: new Array(12).fill(args.expansionData.cardData.basicSupply['platinum'])
      });
      
      prosperityCheckConfigured = true;
    }
    
    const charlatanPresent = kingdomCards.find(supply => supply.name === 'charlatan');
    const curseCard = basicCards.find(supply => supply.name === 'curse');
    
    if (charlatanPresent && !charlatanConfigured) {
      console.log(`[prosperity configurator] charlatan is part of kingdom - curses gain the treasure type and +1 treasure effect`);
      
      if (!curseCard) {
        console.warn(`[prosperity configurator] curse card not found in config`);
      }
      
      curseCard?.cards?.forEach(card => card.type.push('TREASURE'));
      
      args.cardEffectRegistrar('curse', 'prosperity', async (args) => {
        console.log(`[curse effect - prosperity] curse effect called`);
        await args.runGameActionDelegate('gainTreasure', { count: 1 });
      });
      
      charlatanConfigured = true;
    }
    
    return args.config;
  }
}

export const registerEndGameConditions = (registrar: EndGameConditionRegistrar) => {
  registrar(({ findCards, match }) => {
    const kingdomCards = match.config.kingdomSupply;
    const colonyPresent = kingdomCards.find(supply => supply.name === 'colony');
    
    if (!colonyPresent) {
      return false;
    }
    
    const colonyCards = findCards([
      { location: 'basicSupply' },
      { cardKeys: 'colony' }
    ]);
    return colonyCards.length === 0;
  })
}

export const registerGameEvents: (registrar: GameEventRegistrar, config: ComputedMatchConfiguration) => void = (registrar) => {
  registrar('onGameStart', async (args) => {
    
    const peddlerCardIds = args.findCards([
      { location: 'kingdomSupply' },
      { cardKeys: 'peddler' }
    ]).map(card => card.id);
    
    if (peddlerCardIds.length === 0) {
      return;
    }
    
    console.log(`[prosperity onGameStart event] registering peddler game events`);
    
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
          condition: (conditionArgs) => {
            if (getTurnPhase(conditionArgs.trigger.args.phaseIndex) !== 'buy') return false;
            return getCurrentPlayer(conditionArgs.match).id === player.id;
          },
          triggeredEffectFn: async () => {
            ruleUnsub();
            ruleUnsub = () => void 0;
          }
        });
        
        args.reactionManager.registerReactionTemplate({
          id: `peddler:${cardId}:startTurnPhase`,
          listeningFor: 'startTurnPhase',
          playerId: player.id,
          compulsory: true,
          once: false,
          allowMultipleInstances: true,
          condition: (conditionArgs) => {
            if (getTurnPhase(conditionArgs.trigger.args.phaseIndex) !== 'buy') return false;
            return getCurrentPlayer(conditionArgs.match).id === player.id;
          },
          triggeredEffectFn: async (triggerEffectArgs) => {
            const peddlerCard = triggerEffectArgs.cardLibrary.getCard(cardId);
            
            console.log(`[peddler triggered effect] adding pricing rule for ${peddlerCard}`);
            
            const rule: CardPriceRule = (ruleCard, ruleContext) => {
              const cardsInPlay = getCardsInPlay(args.findCards);
              const actionsInPlay = cardsInPlay.filter(card => card.type.includes('ACTION'));
              if (actionsInPlay.length === 0) {
                return { restricted: false, cost: { treasure: 0 } };
              }
              
              return { restricted: false, cost: { treasure: -actionsInPlay.length * 2 } }
            }
            
            ruleUnsub = args.cardPriceController.registerRule(peddlerCard, rule);
          }
        })
      }
    }
  });
}

export const registerScoringFunctions = (registrar: PlayerScoreDecoratorRegistrar) => {
  registrar((playerId, match) => {
    match.scores[playerId] += match.playerVictoryTokens?.[playerId] ?? 0;
  });
};

export default configurator;
