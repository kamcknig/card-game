import { NewCardExpansionModule } from '../types.ts';

const expansionModule: NewCardExpansionModule = {
  registerEffects: {
    'copper': () => async ({gameActionController}) => {
      await gameActionController.gainTreasure({ count: 1 });
    },
    'gold': () => async ({gameActionController}) => {
      await gameActionController.gainTreasure({ count: 3 });
    },
    'silver': () => async ({gameActionController}) => {
      await gameActionController.gainTreasure({ count: 2 });
    },
  }
};

export default expansionModule;
