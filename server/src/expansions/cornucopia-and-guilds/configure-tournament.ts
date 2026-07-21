import { Supply } from 'shared/types/index.ts';
import { ExpansionConfiguratorContext } from '@server-types/index.ts';

// Builds the Prizes non-supply pile (one of each Prize) when Tournament is in
// the kingdom, and stamps linkedPileKey on Tournament so the card-detail
// dialog shows the Prizes as siblings. Mirrors configure-joust.ts (Rewards),
// except Prizes are singletons regardless of player count.
export const configureTournament = async (args: ExpansionConfiguratorContext) => {
  const tournamentPresent = args.config.kingdomSupply.some(supply => supply.name === 'tournament');

  if (!tournamentPresent) {
    return;
  }

  const tournamentSupply = args.config.kingdomSupply.find(supply => supply.name === 'tournament');
  tournamentSupply?.cards.forEach(card => {
    card.linkedPileKey = 'prizes';
  });

  if (args.config.nonSupply?.some(supply => supply.name === 'prizes')) {
    return;
  }

  args.loggerService.info(`[cornucopia configurator - configuring tournament] tournament present in supply`);

  args.config.nonSupply ??= [];

  const prizesKingdom = {
    name: 'prizes',
    cards: [],
  } as Supply;

  args.config.nonSupply.push(prizesKingdom);

  const expansionData = args.expansionCatalog['cornucopia-and-guilds'];
  const expansionKingdomCards = expansionData.cardData.kingdomSupply;
  const prizes = Object.keys(expansionKingdomCards).filter(key => expansionKingdomCards[key].type.includes('PRIZE'));

  for (const key of prizes ?? []) {
    const cardData = {
      ...(structuredClone(expansionKingdomCards[key]) ?? {}),
      partOfSupply: false,
    };
    // Prizes are singletons — exactly one of each, regardless of player count.
    prizesKingdom.cards = [...prizesKingdom.cards, cardData];
  }
  args.loggerService.info(`[cornucopia configurator - configuring tournament] tournament configured`);
};
