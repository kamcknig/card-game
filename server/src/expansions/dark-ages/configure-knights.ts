import { ExpansionConfiguratorContext } from '@server-types/index.ts';
import { getCardPileKey } from '../../utils/get-card-pile-key.ts';
import { fisherYatesShuffle } from '../../utils/fisher-yates-shuffler.ts';

// Shuffles the Knights pile at setup so each match gets a randomized top-card sequence.
export const configureKnights = async (args: ExpansionConfiguratorContext) => {
  const logPrefix = '[dark-ages configurator - configuring knights]';

  // Resolve the Knights supply pile by name, with a pile-key fallback for safety.
  const knightsSupply = args.config.kingdomSupply.find(supply => {
    if (supply.name === 'knights') {
      return true;
    }
    return supply.cards.some(card => getCardPileKey(card) === 'knights');
  });

  if (!knightsSupply) {
    args.loggerService.debug(`${logPrefix} Knights pile not present, skipping`);
    return;
  }

  if (knightsSupply.cards.length < 2) {
    args.loggerService.debug(`${logPrefix} Knights pile has fewer than 2 cards, skipping shuffle`);
    return;
  }

  args.loggerService.info(`${logPrefix} shuffling Knights pile`);
  fisherYatesShuffle(knightsSupply.cards, true, () => args.rngService.nextFloat());

  const topCard = knightsSupply.cards[knightsSupply.cards.length - 1];
  args.loggerService.debug(`${logPrefix} top card after shuffle is ${topCard.cardKey}`);
  args.loggerService.info(`${logPrefix} Knights configured`);
};
