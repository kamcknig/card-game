import { CardExpansionModuleNew } from '../../types.ts';

const expansion: CardExpansionModuleNew = {
  'alchemist': {
    registerEffects: () => async (args) => {
      await args.runGameActionDelegate('drawCard', { playerId: args.playerId });
      await args.runGameActionDelegate('drawCard', { playerId: args.playerId });
      await args.runGameActionDelegate('gainAction', { count: 1 });
    }
  },
  'potion': {
    registerEffects: () => async (args) => {
      await args.runGameActionDelegate('gainPotion', { count: 1 });
    }
  }
}

export default expansion;