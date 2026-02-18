import { CardKey, ComputedMatchConfiguration } from 'shared/types/index.ts';
import { GameEventRegistrar } from '@server-types/index.ts';
import { getPileDefinitionCard } from '../../utils/get-pile-definition-card.ts';

export type ObeliskMetadata = {
  chosenPileKey?: CardKey;
};

export const configureObelisk = (
  registrar: GameEventRegistrar,
  config: ComputedMatchConfiguration,
) => {
  // Only register Obelisk handlers when the landmark is present.
  const hasObelisk = (config.landmarks ?? []).some(
    (landmark) => landmark.cardKey === 'obelisk',
  );
  if (!hasObelisk) return;

  registrar('onGameStart', async (args) => {
    // Locate the Obelisk landmark instance to store the chosen pile metadata.
    const obeliskLandmark = args.match.landmarks.find(
      (landmark) => landmark.cardKey === 'obelisk',
    );
    if (!obeliskLandmark) {
      return;
    }

    // Build the list of Action supply piles using pile-level type data.
    const supplyPiles = [
      ...(config.basicSupply ?? []),
      ...(config.kingdomSupply ?? []),
    ];
    const actionPileKeys: CardKey[] = [];

    for (const supply of supplyPiles) {
      const pileCard = getPileDefinitionCard(supply.cards, supply.name);
      if (!pileCard?.type?.includes('ACTION')) continue;

      // Track only the pile key; card membership can be derived from the supply list later.
      actionPileKeys.push(supply.name as CardKey);
    }

    if (!actionPileKeys.length) {
      return;
    }

    // Choose a random Action pile and store its key on the landmark metadata.
    const chosenPileKey = actionPileKeys[args.rngService.nextIndex(actionPileKeys.length)];
    const metadata = obeliskLandmark.metadata as ObeliskMetadata;
    metadata.chosenPileKey = chosenPileKey;

    // Resolve card keys for logging/debugging only.
    const chosenPile = supplyPiles.find(
      (supply) => supply.name === chosenPileKey,
    );
    const chosenCardKeys = chosenPile ? Array.from(new Set(chosenPile.cards.map((card) => card.cardKey))) : [];
  });
};
