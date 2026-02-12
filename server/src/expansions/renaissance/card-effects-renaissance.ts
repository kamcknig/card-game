import { Card, CardId } from 'shared/shared-types';
import { CardExpansionModule } from '../../types.ts';

// Renaissance card effects module (artifacts handled separately).
const expansion: CardExpansionModule = {
  'border-guard': {
    registerEffects: () => async (cardEffectArgs) => {
      // Border Guard grants +1 Action on play.
      console.debug('[border-guard effect] gaining 1 action');
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });

      // Resolve whether the player currently owns the Lantern artifact.
      const artifacts = cardEffectArgs.match.artifacts;
      const ownedArtifacts = artifacts?.byPlayer?.[cardEffectArgs.playerId] ?? [];
      const lantern = artifacts?.cards?.find((candidate) => candidate.cardKey === 'lantern');
      const hasLantern = !!lantern && ownedArtifacts.includes(lantern.id);
      const revealCount = hasLantern ? 3 : 2;

      console.debug(`[border-guard effect] revealing ${revealCount} card(s) (lantern: ${hasLantern})`);

      const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
      const revealedCards: Card[] = [];

      // Reveal the top N cards, shuffling if needed.
      for (let index = 0; index < revealCount; index++) {
        if (deck.length < 1) {
          console.debug('[border-guard effect] deck empty, shuffling discard');
          await cardEffectArgs.runGameActionDelegate('shuffleDeck', { playerId: cardEffectArgs.playerId });
          if (deck.length < 1) {
            console.debug('[border-guard effect] no cards to reveal after shuffling');
            break;
          }
        }

        const cardId = deck.slice(-1)[0];
        const card = cardEffectArgs.cardLibrary.getCard(cardId);
        revealedCards.push(card);
        await cardEffectArgs.runGameActionDelegate('revealCard', {
          cardId,
          playerId: cardEffectArgs.playerId,
          moveToSetAside: true,
        });
      }

      if (!revealedCards.length) {
        console.debug('[border-guard effect] no cards revealed');
        return;
      }

      // Prompt the player to choose one revealed card to put into hand.
      const revealedIds = revealedCards.map((card) => card.id);
      const selectedIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Choose a card to put into your hand',
        restrict: revealedIds,
        count: 1,
      }) as CardId[];

      const chosenId = selectedIds[0] ?? revealedIds[0];
      console.debug(`[border-guard effect] moving chosen card ${chosenId} to hand`);
      await cardEffectArgs.runGameActionDelegate('moveCard', {
        cardId: chosenId,
        toPlayerId: cardEffectArgs.playerId,
        to: { location: 'playerHand' },
      });

      // Discard the remaining revealed cards.
      for (const card of revealedCards) {
        if (card.id === chosenId) continue;
        console.debug(`[border-guard effect] discarding revealed card ${card}`);
        await cardEffectArgs.runGameActionDelegate('discardCard', {
          cardId: card.id,
          playerId: cardEffectArgs.playerId,
        });
      }

      // Only award artifacts when the full reveal count was met and all were Actions.
      if (revealedCards.length !== revealCount) {
        console.debug('[border-guard effect] revealed fewer than required, skipping artifact');
        return;
      }
      const allActions = revealedCards.every((card) => card.type.includes('ACTION'));
      if (!allActions) {
        console.debug('[border-guard effect] revealed cards not all actions, skipping artifact');
        return;
      }

      // Determine which artifacts are available to take.
      const horn = artifacts?.cards?.find((candidate) => candidate.cardKey === 'horn');
      const ownedLantern = !!lantern && ownedArtifacts.includes(lantern.id);
      const ownedHorn = !!horn && ownedArtifacts.includes(horn.id);
      const availableArtifacts: { label: string; artifactId: number }[] = [];

      if (hasLantern) {
        if (horn && !ownedHorn) {
          availableArtifacts.push({ label: 'TAKE HORN', artifactId: horn.id });
        }
      } else {
        if (lantern && !ownedLantern) {
          availableArtifacts.push({ label: 'TAKE LANTERN', artifactId: lantern.id });
        }
        if (horn && !ownedHorn) {
          availableArtifacts.push({ label: 'TAKE HORN', artifactId: horn.id });
        }
      }

      if (!availableArtifacts.length) {
        console.debug('[border-guard effect] no artifacts available to take');
        return;
      }

      if (availableArtifacts.length === 1) {
        const selectedArtifact = availableArtifacts[0];
        console.debug(`[border-guard effect] gaining artifact ${selectedArtifact.artifactId}`);
        await cardEffectArgs.runGameActionDelegate('gainArtifact', {
          playerId: cardEffectArgs.playerId,
          artifactId: selectedArtifact.artifactId,
        });
        return;
      }

      // Prompt the player to take an artifact or decline when multiple are available.
      const actionButtons = [
        ...availableArtifacts.map((artifact, index) => ({
          label: artifact.label,
          action: index + 1,
        })),
      ];
      const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Take an Artifact?',
        actionButtons,
      }) as { action: number };

      const selectedArtifact = availableArtifacts[result.action - 1];
      if (!selectedArtifact) {
        console.warn('[border-guard effect] no artifact found to gain');
        return;
      }

      console.debug(`[border-guard effect] gaining artifact ${selectedArtifact.artifactId}`);
      await cardEffectArgs.runGameActionDelegate('gainArtifact', {
        playerId: cardEffectArgs.playerId,
        artifactId: selectedArtifact.artifactId,
      });
    },
  },
};

export default expansion;
