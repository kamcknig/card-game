import { CardExpansionModuleNew } from '../types.ts';

const expansionModule: CardExpansionModuleNew = {
  'copper': {
    registerEffects: () => async ({ gameActionController }) => {
      await gameActionController.gainTreasure({ count: 1 });
    }
  },
  'gold': {
    registerEffects: () => async ({ gameActionController }) => {
      await gameActionController.gainTreasure({ count: 3 });
    }
  },
  'silver': {
    registerEffects: () => async ({ gameActionController }) => {
      await gameActionController.gainTreasure({ count: 2 });
    }
  },
};

export default expansionModule;
