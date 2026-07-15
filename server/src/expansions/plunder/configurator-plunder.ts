import { ExpansionConfiguratorContext, ExpansionConfiguratorFactory, GameEventRegistrar } from '@server-types/index.ts';
import { CardId, CardKey, ComputedMatchConfiguration, PlayerId, Trait } from 'shared/types/index.ts';
import { getCardPileKey } from '../../utils/get-card-pile-key.ts';
import { getCurrentPlayer } from '../../utils/get-current-player.ts';
import { getCurrentTurnHistoryIndex } from '../../utils/get-current-turn-history-index.ts';
import { getOrderStartingFrom } from '../../utils/get-order-starting-from.ts';
import { getPlayerSourceSafe } from '../../utils/get-player-source-safe.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
import { isCardStillAtGainedLocation } from '../../utils/is-card-still-at-gained-location.ts';
import { isLocationInPlay } from '../../utils/is-in-play.ts';
import { fisherYatesShuffle } from '../../utils/fisher-yates-shuffler.ts';
import { returnCardToConfiguredPileTop } from '../../utils/return-card-to-configured-pile-top.ts';

const LOOT_PILE_NAME = 'loot';
const CHEAP_TRAIT_CARD_KEY: CardKey = 'cheap';
const CURSED_TRAIT_CARD_KEY: CardKey = 'cursed';
const FATED_TRAIT_CARD_KEY: CardKey = 'fated';
const FAWNING_TRAIT_CARD_KEY: CardKey = 'fawning';
const FRIENDLY_TRAIT_CARD_KEY: CardKey = 'friendly';
const HASTY_TRAIT_CARD_KEY: CardKey = 'hasty';
const INHERITED_TRAIT_CARD_KEY: CardKey = 'inherited';
const INSPIRING_TRAIT_CARD_KEY: CardKey = 'inspiring';
const NEARBY_TRAIT_CARD_KEY: CardKey = 'nearby';
const PATIENT_TRAIT_CARD_KEY: CardKey = 'patient';
const PIOUS_TRAIT_CARD_KEY: CardKey = 'pious';
const RECKLESS_TRAIT_CARD_KEY: CardKey = 'reckless';
const RICH_TRAIT_CARD_KEY: CardKey = 'rich';
const SHY_TRAIT_CARD_KEY: CardKey = 'shy';
const TIRELESS_TRAIT_CARD_KEY: CardKey = 'tireless';
const PROVINCE_PILE_KEY: CardKey = 'province';
const SHAMAN_CARD_KEY: CardKey = 'shaman';

// Returns all runtime trait instances for the given trait key.
const getRuntimeTraitsByCardKey = (args: { traits?: Trait[] }, traitCardKey: CardKey) => {
  return (args.traits ?? []).filter(trait => trait.cardKey === traitCardKey);
};

// Returns the assigned pile keys for runtime traits, excluding missing/null assignments.
const getTraitPileKeySet = (traits: Trait[]): Set<CardKey> => {
  return new Set(traits.flatMap(trait => (trait.pileKey ? [trait.pileKey] : [])));
};

// Prompts a deterministic order for a card list; if the prompt is cancelled/invalid, keeps existing order.
const getOrderedCardIds = async (
  args: {
    promptService: {
      requestActionResult: <T>(args: unknown) => Promise<{ action: number; result: T | undefined } | null>;
    };
    playerId: PlayerId;
  },
  cardIds: CardId[],
  prompt: string,
): Promise<CardId[]> => {
  if (cardIds.length < 2) {
    return [...cardIds];
  }

  const promptResult = await args.promptService.requestActionResult<CardId[]>({
    playerId: args.playerId,
    prompt,
    actionButtons: [{ label: 'DONE', action: 1 }],
    content: {
      type: 'rearrange',
      cardIds,
    },
  });

  if (promptResult?.result?.length === cardIds.length) {
    return promptResult.result;
  }

  return [...cardIds];
};

// Canonical Loot card keys (15 cards, configured as 2 copies each).
const LOOT_CARD_KEYS: CardKey[] = [
  'amphora',
  'doubloons',
  'endless-chalice',
  'figurehead',
  'hammer',
  'insignia',
  'jewels',
  'orb',
  'prize-goat',
  'puzzle-box',
  'sextant',
  'shield',
  'spell-scroll',
  'staff',
  'sword',
];

// Kingdom piles that explicitly reference "gain a Loot".
const LOOT_SOURCE_KINGDOM_PILES = new Set<CardKey>([
  'cutthroat',
  'jewelled-egg',
  'pickaxe',
  'sack-of-loot',
  'search',
  'wealthy-village',
]);

// Events that explicitly reference "gain a Loot".
const LOOT_SOURCE_EVENTS = new Set<CardKey>(['foray', 'invasion', 'looting', 'peril', 'prosper']);

// Traits that explicitly reference "gain a Loot".
const LOOT_SOURCE_TRAITS = new Set<CardKey>(['cursed']);

// Returns true when the current setup contains any card-like that requires Loot.
const shouldConfigureLootPile = (config: ExpansionConfiguratorContext['config']): boolean => {
  const hasLootKingdomSource = config.kingdomSupply.some(supply =>
    supply.cards.some(card => LOOT_SOURCE_KINGDOM_PILES.has(getCardPileKey(card))),
  );
  if (hasLootKingdomSource) {
    return true;
  }

  const hasLootEventSource = (config.events ?? []).some(event => LOOT_SOURCE_EVENTS.has(event.cardKey));
  if (hasLootEventSource) {
    return true;
  }

  return (config.traits ?? []).some(trait => LOOT_SOURCE_TRAITS.has(trait.cardKey));
};

// Builds the canonical shuffled Loot stack with all cards face down.
const buildShuffledLootCards = (args: ExpansionConfiguratorContext) => {
  const cards = LOOT_CARD_KEYS.flatMap(lootCardKey => {
    const baseCard = structuredClone(args.expansionData.cardData.kingdomSupply[lootCardKey]);
    if (!baseCard) {
      args.loggerService.warn(`[plunder configurator] missing Loot card data for ${lootCardKey}`);
      return [];
    }

    const pileCard = {
      ...baseCard,
      kingdom: LOOT_PILE_NAME,
      partOfSupply: false,
      kingdomSelectable: false,
      facing: 'back' as const,
      tags: Array.from(new Set([...(baseCard.tags ?? []), LOOT_PILE_NAME])),
    };
    return [structuredClone(pileCard), structuredClone(pileCard)];
  });

  return fisherYatesShuffle(cards, false, () => args.rngService.nextFloat());
};

// Registers the Cheap trait's persistent cost-reduction behavior.
const registerCheapTraitEvents = (registrar: GameEventRegistrar, config: ComputedMatchConfiguration) => {
  // Skip registration when Cheap is not configured in this match setup.
  const hasCheapTrait = (config.traits ?? []).some(trait => trait.cardKey === CHEAP_TRAIT_CARD_KEY);
  if (!hasCheapTrait) {
    return;
  }

  registrar('onGameStartSetup', async args => {
    // Resolve runtime Cheap traits from match state so we use assigned pile keys.
    const cheapTraits = (args.match.traits ?? []).filter(trait => trait.cardKey === CHEAP_TRAIT_CARD_KEY);
    if (cheapTraits.length < 1) {
      args.loggerService.warn('[plunder cheap trait] no runtime Cheap traits found at game start');
      return;
    }

    args.loggerService.info(
      `[plunder cheap trait] registering cost reduction for ${cheapTraits.length} Cheap trait(s)`,
    );
    for (const cheapTrait of cheapTraits) {
      const pileKey = cheapTrait.pileKey;
      if (!pileKey) {
        args.loggerService.warn(`[plunder cheap trait] Cheap trait ${cheapTrait.id} has no assigned pile key`);
        continue;
      }

      // Collect all cards in the affected kingdoms pile (split-pile safe via pile key matching).
      const pileCards = args.findCardService
        .findCards({ all: [{ location: 'kingdomSupply' }] })
        .filter(card => getCardPileKey(card) === pileKey);
      if (pileCards.length < 1) {
        args.loggerService.warn(`[plunder cheap trait] no cards found in target pile '${pileKey}'`);
        continue;
      }

      args.loggerService.debug(
        `[plunder cheap trait] applying -$1 cost rule to pile '${pileKey}' (${pileCards.length} card(s))`,
      );
      for (const pileCard of pileCards) {
        // Cheap only reduces treasure cost and remains active for the full game.
        args.cardPriceController.registerRule(pileCard, () => ({
          restricted: false,
          cost: { treasure: -1 },
        }));
      }
    }
  });
};

// Registers Cursed: after gaining from the Cursed pile, gain a Loot then gain a Curse.
const registerCursedTraitEvents = (registrar: GameEventRegistrar, config: ComputedMatchConfiguration) => {
  // Skip registration when Cursed is not configured in this match setup.
  const hasCursedTrait = (config.traits ?? []).some(trait => trait.cardKey === CURSED_TRAIT_CARD_KEY);
  if (!hasCursedTrait) {
    return;
  }

  registrar('onCardGained', async (args, eventArgs) => {
    const gainedCard = args.cardLibrary.getCard(eventArgs.cardId);
    const gainedPileKey = getCardPileKey(gainedCard);
    const cursedTraits = (args.match.traits ?? []).filter(
      trait => trait.cardKey === CURSED_TRAIT_CARD_KEY && trait.pileKey === gainedPileKey,
    );
    if (cursedTraits.length < 1) {
      return;
    }

    args.loggerService.info(
      `[plunder cursed trait] gained card ${gainedCard} from pile '${gainedPileKey}', triggering ${cursedTraits.length} Cursed trait(s)`,
    );
    for (const cursedTrait of cursedTraits) {
      args.loggerService.debug(`[plunder cursed trait] resolving trait ${cursedTrait.id}`);
      // Gain Loot first, as specified by the Cursed trait ordering.
      await args.actionService.run(
        'gainLoot',
        { playerId: eventArgs.playerId },
        {
          source: eventArgs.cardId,
        },
      );

      // Then gain Curse from the top of the Curse pile, if available.
      const gainedCurse = await args.supplyGainService.gainTopSupplyCardForPileKey({
        playerId: eventArgs.playerId,
        pileKey: 'curse',
        from: 'basicSupply',
        to: { location: 'playerDiscard' },
        logTag: 'plunder cursed trait gain curse',
      });
      if (!gainedCurse) {
        args.loggerService.debug('[plunder cursed trait] no Curse remained to gain');
      }
    }
  });
};

// Registers Fawning: after gaining Province, gain one card from each Fawning pile.
const registerFawningTraitEvents = (registrar: GameEventRegistrar, config: ComputedMatchConfiguration) => {
  // Skip registration when Fawning is not configured in this match setup.
  const hasFawningTrait = (config.traits ?? []).some(trait => trait.cardKey === FAWNING_TRAIT_CARD_KEY);
  if (!hasFawningTrait) {
    return;
  }

  registrar('onCardGained', async (args, eventArgs) => {
    const gainedCard = args.cardLibrary.getCard(eventArgs.cardId);
    if (getCardPileKey(gainedCard) !== PROVINCE_PILE_KEY) {
      return;
    }

    // Resolve runtime Fawning traits so split piles and assigned pile keys are handled safely.
    const fawningTraits = (args.match.traits ?? []).filter(trait => trait.cardKey === FAWNING_TRAIT_CARD_KEY);
    if (fawningTraits.length < 1) {
      return;
    }

    args.loggerService.info(
      `[plunder fawning trait] gained Province, triggering ${fawningTraits.length} Fawning trait(s)`,
    );
    for (const fawningTrait of fawningTraits) {
      if (!fawningTrait.pileKey) {
        args.loggerService.warn(`[plunder fawning trait] Fawning trait ${fawningTrait.id} has no assigned pile key`);
        continue;
      }

      const gainedFawningCard = await args.supplyGainService.gainTopSupplyCardForPileKey({
        playerId: eventArgs.playerId,
        pileKey: fawningTrait.pileKey,
        to: { location: 'playerDiscard' },
        logTag: 'plunder fawning trait gain card',
      });
      if (!gainedFawningCard) {
        args.loggerService.debug(`[plunder fawning trait] no cards remained in pile '${fawningTrait.pileKey}' to gain`);
      }
    }
  });
};

// Registers Fated: after shuffle randomization, reveal and place chosen Fated cards on top/bottom of packet.
const registerFatedTraitEvents = (registrar: GameEventRegistrar, config: ComputedMatchConfiguration) => {
  const hasFatedTrait = (config.traits ?? []).some(trait => trait.cardKey === FATED_TRAIT_CARD_KEY);
  if (!hasFatedTrait) {
    return;
  }

  registrar('onGameStartSetup', async args => {
    const fatedTraits = getRuntimeTraitsByCardKey(args.match, FATED_TRAIT_CARD_KEY);
    if (fatedTraits.length < 1) {
      args.loggerService.warn('[plunder fated trait] no runtime Fated traits found at game start');
      return;
    }
    const fatedPileKeys = getTraitPileKeySet(fatedTraits);

    for (const player of args.match.players) {
      args.reactionManager.registerSystemTemplate(
        fatedTraits[0],
        'afterShuffle',
        {
          playerId: player.id,
          once: false,
          compulsory: true,
          allowMultipleInstances: false,
          condition: ({ trigger }) => {
            if (trigger.args.playerId !== player.id) {
              return false;
            }
            const shuffledCardIds = trigger.args.cardIds ?? [];
            if (shuffledCardIds.length < 1) {
              return false;
            }

            return shuffledCardIds.some(cardId => {
              const shuffledCard = args.cardLibrary.getCard(cardId);
              return fatedPileKeys.has(getCardPileKey(shuffledCard));
            });
          },
          triggeredEffectFn: async triggeredArgs => {
            const shuffledCardIds = [...(triggeredArgs.trigger.args.cardIds ?? [])];
            if (shuffledCardIds.length < 1) {
              return;
            }

            const fatedCardIds = shuffledCardIds.filter(cardId => {
              const shuffledCard = triggeredArgs.cardLibrary.getCard(cardId);
              return fatedPileKeys.has(getCardPileKey(shuffledCard));
            });
            if (fatedCardIds.length < 1) {
              return;
            }

            const topSelectionPrompt = await triggeredArgs.promptService.requestActionResult<CardId[]>({
              playerId: player.id,
              prompt: 'Choose Fated cards to put on top',
              actionButtons: [{ label: 'DONE', action: 1 }],
              content: {
                type: 'select',
                cardIds: fatedCardIds,
                selectCount: { kind: 'upTo', count: fatedCardIds.length },
              },
            });
            const selectedTopCardIds =
              topSelectionPrompt?.result?.filter(cardId => fatedCardIds.includes(cardId)) ?? [];

            let orderedTopCardIds = [...selectedTopCardIds];
            if (selectedTopCardIds.length > 1) {
              orderedTopCardIds = await getOrderedCardIds(
                {
                  promptService: triggeredArgs.promptService,
                  playerId: player.id,
                },
                selectedTopCardIds,
                'Order selected Fated cards to put on top',
              );
            }

            const remainingFatedCardIds = fatedCardIds.filter(cardId => !selectedTopCardIds.includes(cardId));
            const selectedBottomCardIds =
              remainingFatedCardIds.length > 0
                ? ((
                    await triggeredArgs.promptService.requestActionResult<CardId[]>({
                      playerId: player.id,
                      prompt: 'Choose Fated cards to put on bottom',
                      actionButtons: [{ label: 'DONE', action: 1 }],
                      content: {
                        type: 'select',
                        cardIds: remainingFatedCardIds,
                        selectCount: { kind: 'upTo', count: remainingFatedCardIds.length },
                      },
                    })
                  )?.result?.filter(cardId => remainingFatedCardIds.includes(cardId)) ?? [])
                : [];

            let orderedBottomCardIds = [...selectedBottomCardIds];
            if (selectedBottomCardIds.length > 1) {
              orderedBottomCardIds = await getOrderedCardIds(
                {
                  promptService: triggeredArgs.promptService,
                  playerId: player.id,
                },
                selectedBottomCardIds,
                'Order selected Fated cards to put on bottom',
              );
            }

            const selectedFatedIds = new Set<CardId>([...orderedTopCardIds, ...orderedBottomCardIds]);

            const middleShuffledCardIds = shuffledCardIds.filter(cardId => !selectedFatedIds.has(cardId));
            // Build the final packet order as: bottom cards, shuffled middle, top cards.
            triggeredArgs.trigger.args.cardIds = [
              ...orderedBottomCardIds,
              ...middleShuffledCardIds,
              ...orderedTopCardIds,
            ];

            for (const selectedCardId of selectedFatedIds) {
              await triggeredArgs.actionService.run('revealCard', {
                playerId: player.id,
                cardId: selectedCardId,
              });
            }
          },
        },
        {
          idSuffix: `fated:${player.id}:afterShuffle`,
        },
      );
    }
  });
};

// Registers Friendly: at cleanup start, may discard one Friendly card from hand to gain from that Friendly pile.
const registerFriendlyTraitEvents = (registrar: GameEventRegistrar, config: ComputedMatchConfiguration) => {
  const hasFriendlyTrait = (config.traits ?? []).some(trait => trait.cardKey === FRIENDLY_TRAIT_CARD_KEY);
  if (!hasFriendlyTrait) {
    return;
  }

  registrar('onGameStartSetup', async args => {
    const friendlyTraits = getRuntimeTraitsByCardKey(args.match, FRIENDLY_TRAIT_CARD_KEY);
    if (friendlyTraits.length < 1) {
      args.loggerService.warn('[plunder friendly trait] no runtime Friendly traits found at game start');
      return;
    }
    const friendlyPileKeys = getTraitPileKeySet(friendlyTraits);

    for (const player of args.match.players) {
      args.reactionManager.registerSystemTemplate(
        friendlyTraits[0],
        'startTurnPhase',
        {
          playerId: player.id,
          once: false,
          compulsory: true,
          allowMultipleInstances: false,
          condition: ({ trigger, match }) =>
            getTurnPhase(trigger.args.phaseIndex) === 'cleanup' && getCurrentPlayer(match).id === player.id,
          triggeredEffectFn: async triggeredArgs => {
            const hand = getPlayerSourceSafe(triggeredArgs, 'playerHand', player.id);
            const friendlyCardsInHand = hand.filter(cardId =>
              friendlyPileKeys.has(getCardPileKey(triggeredArgs.cardLibrary.getCard(cardId))),
            );
            if (friendlyCardsInHand.length < 1) {
              return;
            }

            const selectedFriendlyCardId = await triggeredArgs.actionService.run('selectSingleCard', {
              playerId: player.id,
              prompt: 'You may discard a Friendly card to gain a Friendly card',
              restrict: friendlyCardsInHand,
              count: { kind: 'upTo', count: 1 },
              optional: true,
            });
            if (!selectedFriendlyCardId) {
              return;
            }

            const selectedFriendlyCard = triggeredArgs.cardLibrary.getCard(selectedFriendlyCardId);
            const selectedFriendlyPileKey = getCardPileKey(selectedFriendlyCard);
            await triggeredArgs.actionService.run('discardCard', {
              playerId: player.id,
              cardId: selectedFriendlyCardId,
            });

            const gainedFriendlyCard = await triggeredArgs.supplyGainService.gainTopSupplyCardForPileKey({
              playerId: player.id,
              pileKey: selectedFriendlyPileKey,
              to: { location: 'playerDiscard' },
              logTag: 'plunder friendly trait gain card',
            });
            if (!gainedFriendlyCard) {
              triggeredArgs.loggerService.debug(
                `[plunder friendly trait] no cards remained in pile '${selectedFriendlyPileKey}' to gain`,
              );
            }
          },
        },
        {
          idSuffix: `friendly:${player.id}:cleanup`,
        },
      );
    }
  });
};

// Registers Hasty: gained cards from the Hasty pile are set aside and auto-played at start of next turn.
const registerHastyTraitEvents = (registrar: GameEventRegistrar, config: ComputedMatchConfiguration) => {
  const hasHastyTrait = (config.traits ?? []).some(trait => trait.cardKey === HASTY_TRAIT_CARD_KEY);
  if (!hasHastyTrait) {
    return;
  }

  registrar('onGameStartSetup', async args => {
    const hastyTraits = getRuntimeTraitsByCardKey(args.match, HASTY_TRAIT_CARD_KEY);
    if (hastyTraits.length < 1) {
      args.loggerService.warn('[plunder hasty trait] no runtime Hasty traits found at game start');
      return;
    }

    for (const hastyTrait of hastyTraits) {
      if (!hastyTrait.pileKey) {
        args.loggerService.warn(`[plunder hasty trait] Hasty trait ${hastyTrait.id} has no assigned pile key`);
        continue;
      }

      for (const player of args.match.players) {
        args.reactionManager.registerSystemTemplate(
          hastyTrait,
          'startTurn',
          {
            playerId: player.id,
            once: false,
            compulsory: true,
            allowMultipleInstances: false,
            condition: ({ trigger }) => trigger.args.playerId === player.id,
            triggeredEffectFn: async triggeredArgs => {
              const currentTurnHistoryIndex = getCurrentTurnHistoryIndex({ match: triggeredArgs.match }) ?? 0;
              const setAside = getPlayerSourceSafe(triggeredArgs, 'set-aside', player.id);
              const candidateHastyCardIds = setAside.filter(cardId => {
                const setAsideSource = triggeredArgs.match.setAsideSourceById?.[cardId];
                return setAsideSource?.ownerPlayerId === player.id && setAsideSource.sourceCardLikeId === hastyTrait.id;
              });
              if (candidateHastyCardIds.length < 1) {
                return;
              }

              const playableCardIds: CardId[] = [];
              for (const queuedCardId of candidateHastyCardIds) {
                const gainStats = triggeredArgs.match.stats.cardsGained[queuedCardId];
                const gainedThisTurn = gainStats?.turnHistoryIndex === currentTurnHistoryIndex;
                if (gainedThisTurn) {
                  continue;
                }
                playableCardIds.push(queuedCardId);
              }
              const stillSetAsideCardIds = playableCardIds.filter(cardId => setAside.includes(cardId));
              if (stillSetAsideCardIds.length < 1) {
                return;
              }

              const remainingCardIds = [...stillSetAsideCardIds];
              while (remainingCardIds.length > 0) {
                const currentSetAside = getPlayerSourceSafe(triggeredArgs, 'set-aside', player.id);
                const currentRemainingCardIds = remainingCardIds.filter(cardId => currentSetAside.includes(cardId));
                if (currentRemainingCardIds.length < 1) {
                  break;
                }

                const currentRemainingCardKeys = new Set(
                  currentRemainingCardIds.map(cardId => triggeredArgs.cardLibrary.getCard(cardId).cardKey),
                );

                let nextCardIdToPlay = currentRemainingCardIds[0];
                if (currentRemainingCardKeys.size > 1) {
                  const promptResult = await triggeredArgs.promptService.requestActionResult<CardId[]>({
                    playerId: player.id,
                    prompt: 'Choose a Hasty card to play next',
                    actionButtons: [{ label: 'PLAY', action: 1 }],
                    content: {
                      type: 'select',
                      cardIds: currentRemainingCardIds,
                      selectCount: 1,
                    },
                  });

                  const selectedCardId = promptResult?.result?.[0];
                  if (!selectedCardId) {
                    triggeredArgs.loggerService.warn('[plunder hasty trait] no Hasty card selected to play');
                    break;
                  }
                  nextCardIdToPlay = selectedCardId;
                }

                await triggeredArgs.actionService.run('playCard', {
                  playerId: player.id,
                  cardId: nextCardIdToPlay,
                  overrides: { actionCost: 0 },
                });

                const playedCardIndex = remainingCardIds.indexOf(nextCardIdToPlay);
                if (playedCardIndex >= 0) {
                  remainingCardIds.splice(playedCardIndex, 1);
                }
              }
            },
          },
          {
            idSuffix: `hasty:${hastyTrait.id}:${player.id}:startTurn`,
          },
        );

        args.reactionManager.registerSystemTemplate(
          hastyTrait,
          'cardGained',
          {
            playerId: player.id,
            once: false,
            compulsory: true,
            allowMultipleInstances: false,
            condition: ({ trigger }) => {
              if (trigger.args.playerId !== player.id) {
                return false;
              }
              const gainedCard = args.cardLibrary.getCard(trigger.args.cardId);
              return getCardPileKey(gainedCard) === hastyTrait.pileKey;
            },
            triggeredEffectFn: async triggeredArgs => {
              const gainedCardId = triggeredArgs.trigger.args.cardId;
              if (
                !isCardStillAtGainedLocation(
                  triggeredArgs.cardSourceController,
                  gainedCardId,
                  triggeredArgs.trigger.args.gainedLocation,
                )
              ) {
                triggeredArgs.loggerService.debug(
                  `[plunder hasty trait] gained card ${gainedCardId} moved before set-aside redirect`,
                );
                return;
              }

              await triggeredArgs.actionService.run('moveCard', {
                cardId: gainedCardId,
                toPlayerId: player.id,
                to: { location: 'set-aside' },
                setAsideSource: {
                  ownerPlayerId: player.id,
                  sourceCardLikeId: hastyTrait.id,
                  sourceCardKey: hastyTrait.cardKey,
                },
              });
            },
          },
          {
            idSuffix: `hasty:${hastyTrait.id}:${player.id}:cardGained`,
          },
        );
      }
    }
  });
};

// Registers Inspiring: after playing an Inspiring card on your turn, may play a unique Action from hand.
const registerInspiringTraitEvents = (registrar: GameEventRegistrar, config: ComputedMatchConfiguration) => {
  const hasInspiringTrait = (config.traits ?? []).some(trait => trait.cardKey === INSPIRING_TRAIT_CARD_KEY);
  if (!hasInspiringTrait) {
    return;
  }

  registrar('onGameStartSetup', async args => {
    const inspiringTraits = getRuntimeTraitsByCardKey(args.match, INSPIRING_TRAIT_CARD_KEY);
    if (inspiringTraits.length < 1) {
      args.loggerService.warn('[plunder inspiring trait] no runtime Inspiring traits found at game start');
      return;
    }
    const inspiringPileKeys = getTraitPileKeySet(inspiringTraits);

    for (const player of args.match.players) {
      args.reactionManager.registerSystemTemplate(
        inspiringTraits[0],
        'afterCardPlayed',
        {
          playerId: player.id,
          once: false,
          compulsory: true,
          allowMultipleInstances: false,
          condition: ({ trigger, match }) =>
            trigger.args.playerId === player.id && getCurrentPlayer(match).id === player.id,
          triggeredEffectFn: async triggeredArgs => {
            const playedCard = triggeredArgs.cardLibrary.getCard(triggeredArgs.trigger.args.cardId);
            if (!inspiringPileKeys.has(getCardPileKey(playedCard))) {
              return;
            }

            const inPlayCardKeys = new Set(
              triggeredArgs.findCardService
                .getCardsInPlay()
                .filter(card => card.owner === player.id)
                .map(card => card.cardKey),
            );

            const selectedActionCardId = await triggeredArgs.actionService.run('selectSingleCard', {
              playerId: player.id,
              prompt: 'You may play an Action from your hand that you do not have a copy of in play',
              // Keep this as a canonical filter so Shadow injection respects the "not already in play" rule.
              restrict: {
                all: [
                  { location: 'playerHand', playerId: player.id },
                  { cardType: ['ACTION'] },
                  ...(inPlayCardKeys.size > 0 ? [{ not: { cardKeys: [...inPlayCardKeys] } }] : []),
                ],
              },
              selectionIntent: { kind: 'play-card', cardTypes: ['ACTION'] },
              count: { kind: 'upTo', count: 1 },
              optional: true,
            });
            if (!selectedActionCardId) {
              return;
            }

            await triggeredArgs.actionService.run('playCard', {
              playerId: player.id,
              cardId: selectedActionCardId,
              overrides: { actionCost: 0 },
            });
          },
        },
        {
          idSuffix: `inspiring:${player.id}:afterCardPlayed`,
        },
      );
    }
  });
};

// Registers Inherited: after setup swaps, each player starts with one card from each Inherited pile replacing a starting card.
const registerInheritedTraitEvents = (registrar: GameEventRegistrar, config: ComputedMatchConfiguration) => {
  const hasInheritedTrait = (config.traits ?? []).some(trait => trait.cardKey === INHERITED_TRAIT_CARD_KEY);
  if (!hasInheritedTrait) {
    return;
  }

  registrar('onGameStart', async args => {
    const inheritedTraits = getRuntimeTraitsByCardKey(args.match, INHERITED_TRAIT_CARD_KEY);
    if (inheritedTraits.length < 1) {
      args.loggerService.warn('[plunder inherited trait] no runtime Inherited traits found at game start');
      return;
    }

    const playerOrder = getOrderStartingFrom(args.match.players, args.match.currentPlayerTurnIndex);
    for (const inheritedTrait of inheritedTraits) {
      if (!inheritedTrait.pileKey) {
        args.loggerService.warn(
          `[plunder inherited trait] Inherited trait ${inheritedTrait.id} has no assigned pile key`,
        );
        continue;
      }

      for (const player of playerOrder) {
        const inheritedCard = args.findCardService.findTopSupplyCardForPileKey({
          pileKey: inheritedTrait.pileKey,
        });
        if (!inheritedCard) {
          args.loggerService.warn(
            `[plunder inherited trait] no cards remain in pile '${inheritedTrait.pileKey}' for player ${player.id}`,
          );
          continue;
        }

        const replacementCandidates = [...args.cardSourceController.getSource('playerDeck', player.id)];
        if (replacementCandidates.length < 1) {
          args.loggerService.warn(`[plunder inherited trait] player ${player.id} has no cards in deck to replace`);
          continue;
        }

        const replacePrompt = await args.promptService.requestActionResult<CardId[]>({
          playerId: player.id,
          prompt: `Choose a starting card to replace with ${inheritedCard.cardName}`,
          actionButtons: [{ label: 'REPLACE', action: 1 }],
          content: {
            type: 'select',
            cardIds: replacementCandidates,
            selectCount: 1,
          },
        });

        const selectedReplacementId = replacePrompt?.result?.[0];
        const replacementCardId =
          selectedReplacementId && replacementCandidates.includes(selectedReplacementId)
            ? selectedReplacementId
            : replacementCandidates[0];
        const replacementCard = args.cardLibrary.getCard(replacementCardId);

        if (replacementCard.cardKey === 'copper') {
          await args.actionService.run('moveCard', {
            cardId: replacementCardId,
            to: { location: 'basicSupply' },
          });
          replacementCard.owner = null;
        } else {
          await args.actionService.run('removeCardFromGame', {
            cardId: replacementCardId,
          });
        }

        await args.actionService.run('moveCard', {
          cardId: inheritedCard.id,
          toPlayerId: player.id,
          to: { location: 'playerDeck' },
        });
        inheritedCard.owner = player.id;

        args.loggerService.info(
          `[plunder inherited trait] player ${player.id} replaced ${replacementCard.cardKey} with ${inheritedCard.cardKey}`,
        );
      }
    }
  });
};

// Registers Nearby: each gain from a Nearby pile grants +1 Buy.
const registerNearbyTraitEvents = (registrar: GameEventRegistrar, config: ComputedMatchConfiguration) => {
  const hasNearbyTrait = (config.traits ?? []).some(trait => trait.cardKey === NEARBY_TRAIT_CARD_KEY);
  if (!hasNearbyTrait) {
    return;
  }

  registrar('onCardGained', async (args, eventArgs) => {
    const gainedCard = args.cardLibrary.getCard(eventArgs.cardId);
    const gainedPileKey = getCardPileKey(gainedCard);
    const nearbyTraits = getRuntimeTraitsByCardKey(args.match, NEARBY_TRAIT_CARD_KEY).filter(
      trait => trait.pileKey === gainedPileKey,
    );
    if (nearbyTraits.length < 1) {
      return;
    }

    args.loggerService.info(
      `[plunder nearby trait] gained card from pile '${gainedPileKey}', granting +1 Buy (${nearbyTraits.length} trigger(s))`,
    );
    for (const nearbyTrait of nearbyTraits) {
      args.loggerService.debug(`[plunder nearby trait] resolving trait ${nearbyTrait.id}`);
      await args.actionService.run('gainBuy', { count: 1 }, { source: eventArgs.cardId });
    }
  });
};

// Registers Patient: at cleanup start, may set aside Patient cards from hand to auto-play next turn.
const registerPatientTraitEvents = (registrar: GameEventRegistrar, config: ComputedMatchConfiguration) => {
  const hasPatientTrait = (config.traits ?? []).some(trait => trait.cardKey === PATIENT_TRAIT_CARD_KEY);
  if (!hasPatientTrait) {
    return;
  }

  registrar('onGameStartSetup', async args => {
    const patientTraits = getRuntimeTraitsByCardKey(args.match, PATIENT_TRAIT_CARD_KEY);
    if (patientTraits.length < 1) {
      args.loggerService.warn('[plunder patient trait] no runtime Patient traits found at game start');
      return;
    }
    const patientPileKeys = getTraitPileKeySet(patientTraits);

    for (const player of args.match.players) {
      args.reactionManager.registerSystemTemplate(
        patientTraits[0],
        'startTurnPhase',
        {
          playerId: player.id,
          once: false,
          compulsory: true,
          allowMultipleInstances: false,
          condition: ({ trigger, match }) =>
            getTurnPhase(trigger.args.phaseIndex) === 'cleanup' && getCurrentPlayer(match).id === player.id,
          triggeredEffectFn: async triggeredArgs => {
            const hand = getPlayerSourceSafe(triggeredArgs, 'playerHand', player.id);
            const patientCardIdsInHand = hand.filter(cardId =>
              patientPileKeys.has(getCardPileKey(triggeredArgs.cardLibrary.getCard(cardId))),
            );
            if (patientCardIdsInHand.length < 1) {
              return;
            }

            const selectedPatientCardIds = await triggeredArgs.actionService.run('selectCard', {
              playerId: player.id,
              prompt: 'You may set aside Patient cards from your hand to play them at the start of your next turn',
              restrict: patientCardIdsInHand,
              count: { kind: 'upTo', count: patientCardIdsInHand.length },
              optional: true,
            });
            if (!selectedPatientCardIds.length) {
              return;
            }

            for (const selectedPatientCardId of selectedPatientCardIds) {
              const selectedPatientCard = triggeredArgs.cardLibrary.getCard(selectedPatientCardId);
              const selectedPatientPileKey = getCardPileKey(selectedPatientCard);
              const sourceTrait = patientTraits.find(trait => trait.pileKey === selectedPatientPileKey);
              if (!sourceTrait) {
                continue;
              }

              await triggeredArgs.actionService.run('moveCard', {
                cardId: selectedPatientCardId,
                toPlayerId: player.id,
                to: { location: 'set-aside' },
                setAsideSource: {
                  ownerPlayerId: player.id,
                  sourceCardLikeId: sourceTrait.id,
                  sourceCardKey: sourceTrait.cardKey,
                },
              });
            }
          },
        },
        {
          idSuffix: `patient:${player.id}:cleanup`,
        },
      );
    }

    for (const patientTrait of patientTraits) {
      for (const player of args.match.players) {
        args.reactionManager.registerSystemTemplate(
          patientTrait,
          'startTurn',
          {
            playerId: player.id,
            once: false,
            compulsory: true,
            allowMultipleInstances: false,
            condition: ({ trigger }) => trigger.args.playerId === player.id,
            triggeredEffectFn: async triggeredArgs => {
              const setAside = getPlayerSourceSafe(triggeredArgs, 'set-aside', player.id);
              const candidatePatientCardIds = setAside.filter(cardId => {
                const setAsideSource = triggeredArgs.match.setAsideSourceById?.[cardId];
                return (
                  setAsideSource?.ownerPlayerId === player.id && setAsideSource.sourceCardLikeId === patientTrait.id
                );
              });
              if (candidatePatientCardIds.length < 1) {
                return;
              }

              const stillSetAsideCardIds = candidatePatientCardIds.filter(cardId => setAside.includes(cardId));
              if (stillSetAsideCardIds.length < 1) {
                return;
              }

              const remainingCardIds = [...stillSetAsideCardIds];
              while (remainingCardIds.length > 0) {
                const currentSetAside = getPlayerSourceSafe(triggeredArgs, 'set-aside', player.id);
                const currentRemainingCardIds = remainingCardIds.filter(cardId => currentSetAside.includes(cardId));
                if (currentRemainingCardIds.length < 1) {
                  break;
                }

                const currentRemainingCardKeys = new Set(
                  currentRemainingCardIds.map(cardId => triggeredArgs.cardLibrary.getCard(cardId).cardKey),
                );

                let nextCardIdToPlay = currentRemainingCardIds[0];
                if (currentRemainingCardKeys.size > 1) {
                  const promptResult = await triggeredArgs.promptService.requestActionResult<CardId[]>({
                    playerId: player.id,
                    prompt: 'Choose a Patient card to play next',
                    actionButtons: [{ label: 'PLAY', action: 1 }],
                    content: {
                      type: 'select',
                      cardIds: currentRemainingCardIds,
                      selectCount: 1,
                    },
                  });

                  const selectedCardId = promptResult?.result?.[0];
                  if (!selectedCardId) {
                    triggeredArgs.loggerService.warn('[plunder patient trait] no Patient card selected to play');
                    break;
                  }
                  nextCardIdToPlay = selectedCardId;
                }

                await triggeredArgs.actionService.run('playCard', {
                  playerId: player.id,
                  cardId: nextCardIdToPlay,
                  overrides: { actionCost: 0 },
                });

                const playedCardIndex = remainingCardIds.indexOf(nextCardIdToPlay);
                if (playedCardIndex >= 0) {
                  remainingCardIds.splice(playedCardIndex, 1);
                }
              }
            },
          },
          {
            idSuffix: `patient:${patientTrait.id}:${player.id}:startTurn`,
          },
        );
      }
    }
  });
};

// Registers Pious: each gain from a Pious pile may trash one card from hand.
const registerPiousTraitEvents = (registrar: GameEventRegistrar, config: ComputedMatchConfiguration) => {
  const hasPiousTrait = (config.traits ?? []).some(trait => trait.cardKey === PIOUS_TRAIT_CARD_KEY);
  if (!hasPiousTrait) {
    return;
  }

  registrar('onCardGained', async (args, eventArgs) => {
    const gainedCard = args.cardLibrary.getCard(eventArgs.cardId);
    const gainedPileKey = getCardPileKey(gainedCard);
    const piousTraits = getRuntimeTraitsByCardKey(args.match, PIOUS_TRAIT_CARD_KEY).filter(
      trait => trait.pileKey === gainedPileKey,
    );
    if (piousTraits.length < 1) {
      return;
    }

    args.loggerService.info(
      `[plunder pious trait] gained card from pile '${gainedPileKey}', resolving ${piousTraits.length} Pious trigger(s)`,
    );
    for (const piousTrait of piousTraits) {
      args.loggerService.debug(`[plunder pious trait] resolving trait ${piousTrait.id}`);
      const hand = getPlayerSourceSafe(args, 'playerHand', eventArgs.playerId);
      if (hand.length < 1) {
        args.loggerService.debug('[plunder pious trait] no cards in hand to trash');
        continue;
      }

      const selectedTrashCardId = await args.actionService.run('selectSingleCard', {
        playerId: eventArgs.playerId,
        prompt: 'You may trash a card from your hand',
        restrict: hand,
        count: { kind: 'upTo', count: 1 },
        optional: true,
      });
      if (!selectedTrashCardId) {
        continue;
      }

      await args.actionService.run(
        'trashCard',
        {
          playerId: eventArgs.playerId,
          cardId: selectedTrashCardId,
        },
        {
          source: eventArgs.cardId,
        },
      );
    }
  });
};

// Registers Rich: each gain from a Rich pile gains a Silver.
const registerRichTraitEvents = (registrar: GameEventRegistrar, config: ComputedMatchConfiguration) => {
  const hasRichTrait = (config.traits ?? []).some(trait => trait.cardKey === RICH_TRAIT_CARD_KEY);
  if (!hasRichTrait) {
    return;
  }

  registrar('onCardGained', async (args, eventArgs) => {
    const gainedCard = args.cardLibrary.getCard(eventArgs.cardId);
    const gainedPileKey = getCardPileKey(gainedCard);
    const richTraits = getRuntimeTraitsByCardKey(args.match, RICH_TRAIT_CARD_KEY).filter(
      trait => trait.pileKey === gainedPileKey,
    );
    if (richTraits.length < 1) {
      return;
    }

    args.loggerService.info(
      `[plunder rich trait] gained card from pile '${gainedPileKey}', triggering ${richTraits.length} Rich trait(s)`,
    );
    for (const richTrait of richTraits) {
      args.loggerService.debug(`[plunder rich trait] resolving trait ${richTrait.id}`);
      const gainedSilver = await args.supplyGainService.gainTopSupplyCardForPileKey({
        playerId: eventArgs.playerId,
        pileKey: 'silver',
        from: 'basicSupply',
        to: { location: 'playerDiscard' },
        logTag: 'plunder rich trait gain silver',
      });
      if (!gainedSilver) {
        args.loggerService.debug('[plunder rich trait] no Silver remained to gain');
      }
    }
  });
};

// Registers Reckless behavior: replay played card instructions, and return discarded cards from play to their pile.
const registerRecklessTraitEvents = (registrar: GameEventRegistrar, config: ComputedMatchConfiguration) => {
  const hasRecklessTrait = (config.traits ?? []).some(trait => trait.cardKey === RECKLESS_TRAIT_CARD_KEY);
  if (!hasRecklessTrait) {
    return;
  }

  registrar('onGameStartSetup', async args => {
    const recklessTraits = getRuntimeTraitsByCardKey(args.match, RECKLESS_TRAIT_CARD_KEY);
    if (recklessTraits.length < 1) {
      args.loggerService.warn('[plunder reckless trait] no runtime Reckless traits found at game start');
      return;
    }

    const recklessPileKeys = getTraitPileKeySet(recklessTraits);
    for (const player of args.match.players) {
      args.reactionManager.registerSystemTemplate(
        recklessTraits[0],
        'afterCardPlayed',
        {
          playerId: player.id,
          once: false,
          compulsory: true,
          allowMultipleInstances: false,
          condition: ({ trigger }) => {
            if (trigger.args.playerId !== player.id) {
              return false;
            }
            if (!trigger.args.followedPlayedCardInstructions) {
              return false;
            }
            const playedCard = args.cardLibrary.getCard(trigger.args.cardId);
            return recklessPileKeys.has(getCardPileKey(playedCard));
          },
          triggeredEffectFn: async triggeredArgs => {
            const replayCardId = triggeredArgs.trigger.args.cardId;
            const wayId = triggeredArgs.trigger.args.wayId ?? null;
            const replayCard = triggeredArgs.cardLibrary.getCard(replayCardId);
            triggeredArgs.loggerService.info(`[plunder reckless trait] replaying instructions for ${replayCard}`);
            await triggeredArgs.actionService.run('activateCardEffects', {
              playerId: player.id,
              cardId: replayCardId,
              wayId,
            });
          },
        },
        {
          idSuffix: `reckless:${player.id}:afterCardPlayed`,
        },
      );
    }

    for (const recklessTrait of recklessTraits) {
      if (!recklessTrait.pileKey) {
        args.loggerService.warn(`[plunder reckless trait] Reckless trait ${recklessTrait.id} has no assigned pile key`);
        continue;
      }

      for (const player of args.match.players) {
        args.reactionManager.registerSystemTemplate(
          recklessTrait,
          'discardCard',
          {
            playerId: player.id,
            once: false,
            compulsory: true,
            allowMultipleInstances: false,
            condition: ({ trigger }) => {
              if (trigger.args.playerId !== player.id) {
                return false;
              }
              if (!isLocationInPlay(trigger.args.previousLocation.location)) {
                return false;
              }
              const discardedCard = args.cardLibrary.getCard(trigger.args.cardId);
              return getCardPileKey(discardedCard) === recklessTrait.pileKey;
            },
            triggeredEffectFn: async triggeredArgs => {
              const discardedCardId = triggeredArgs.trigger.args.cardId;
              let sourceInfo: { sourceKey: string; playerId?: PlayerId } | null = null;
              try {
                sourceInfo = triggeredArgs.cardSourceController.findCardSource(discardedCardId);
              } catch {
                sourceInfo = null;
              }

              // Stop-Moving: if another effect moved it away from discard, Reckless cannot return it.
              const stillInPlayerDiscard =
                sourceInfo?.sourceKey === 'playerDiscard' && sourceInfo?.playerId === player.id;
              if (!stillInPlayerDiscard) {
                triggeredArgs.loggerService.debug(
                  `[plunder reckless trait] discarded card ${discardedCardId} moved before return-to-pile step`,
                );
                return;
              }

              const discardedCard = triggeredArgs.cardLibrary.getCard(discardedCardId);
              await returnCardToConfiguredPileTop({
                actionService: triggeredArgs.actionService,
                loggerService: triggeredArgs.loggerService,
                match: triggeredArgs.match,
                card: discardedCard,
                logTag: 'plunder reckless trait',
              });
            },
          },
          {
            idSuffix: `reckless:${recklessTrait.id}:${player.id}:discard`,
          },
        );
      }
    }
  });
};

// Registers Shy: at start of turn, may discard one Shy card from hand for +2 Cards.
const registerShyTraitEvents = (registrar: GameEventRegistrar, config: ComputedMatchConfiguration) => {
  const hasShyTrait = (config.traits ?? []).some(trait => trait.cardKey === SHY_TRAIT_CARD_KEY);
  if (!hasShyTrait) {
    return;
  }

  registrar('onGameStartSetup', async args => {
    const shyTraits = getRuntimeTraitsByCardKey(args.match, SHY_TRAIT_CARD_KEY);
    if (shyTraits.length < 1) {
      args.loggerService.warn('[plunder shy trait] no runtime Shy traits found at game start');
      return;
    }
    const shyPileKeys = getTraitPileKeySet(shyTraits);

    for (const player of args.match.players) {
      args.reactionManager.registerSystemTemplate(
        shyTraits[0],
        'startTurn',
        {
          playerId: player.id,
          once: false,
          compulsory: true,
          allowMultipleInstances: false,
          condition: ({ trigger }) => trigger.args.playerId === player.id,
          triggeredEffectFn: async triggeredArgs => {
            const hand = getPlayerSourceSafe(triggeredArgs, 'playerHand', player.id);
            const shyCardsInHand = hand.filter(cardId =>
              shyPileKeys.has(getCardPileKey(triggeredArgs.cardLibrary.getCard(cardId))),
            );
            if (shyCardsInHand.length < 1) {
              return;
            }

            const selectedShyCardId = await triggeredArgs.actionService.run('selectSingleCard', {
              playerId: player.id,
              prompt: 'You may discard one Shy card for +2 Cards',
              restrict: shyCardsInHand,
              count: { kind: 'upTo', count: 1 },
              optional: true,
            });
            if (!selectedShyCardId) {
              return;
            }

            await triggeredArgs.actionService.run('discardCard', {
              playerId: player.id,
              cardId: selectedShyCardId,
            });
            await triggeredArgs.actionService.run('drawCard', { playerId: player.id, count: 2 });
          },
        },
        {
          idSuffix: `shy:${player.id}:startTurn`,
        },
      );
    }
  });
};

// Registers Tireless: cards discarded from play are set aside and then top-decked at end of turn.
const registerTirelessTraitEvents = (registrar: GameEventRegistrar, config: ComputedMatchConfiguration) => {
  const hasTirelessTrait = (config.traits ?? []).some(trait => trait.cardKey === TIRELESS_TRAIT_CARD_KEY);
  if (!hasTirelessTrait) {
    return;
  }

  registrar('onGameStartSetup', async args => {
    const tirelessTraits = getRuntimeTraitsByCardKey(args.match, TIRELESS_TRAIT_CARD_KEY);
    if (tirelessTraits.length < 1) {
      args.loggerService.warn('[plunder tireless trait] no runtime Tireless traits found at game start');
      return;
    }

    for (const tirelessTrait of tirelessTraits) {
      if (!tirelessTrait.pileKey) {
        args.loggerService.warn(`[plunder tireless trait] Tireless trait ${tirelessTrait.id} has no assigned pile key`);
        continue;
      }

      for (const player of args.match.players) {
        args.reactionManager.registerSystemTemplate(
          tirelessTrait,
          'discardCard',
          {
            playerId: player.id,
            once: false,
            compulsory: true,
            allowMultipleInstances: false,
            condition: ({ trigger }) => {
              if (trigger.args.playerId !== player.id) {
                return false;
              }
              const isDiscardFromPlay = isLocationInPlay(trigger.args.previousLocation.location);
              if (!isDiscardFromPlay) {
                return false;
              }
              const discardedCard = args.cardLibrary.getCard(trigger.args.cardId);
              return getCardPileKey(discardedCard) === tirelessTrait.pileKey;
            },
            triggeredEffectFn: async triggeredArgs => {
              const discardedCardId = triggeredArgs.trigger.args.cardId;
              let sourceInfo: { sourceKey: string; playerId?: PlayerId } | null = null;
              try {
                sourceInfo = triggeredArgs.cardSourceController.findCardSource(discardedCardId);
              } catch {
                sourceInfo = null;
              }

              const stillInPlayerDiscard =
                sourceInfo?.sourceKey === 'playerDiscard' && sourceInfo?.playerId === player.id;
              if (!stillInPlayerDiscard) {
                triggeredArgs.loggerService.debug(
                  `[plunder tireless trait] discarded card ${discardedCardId} moved before set-aside step`,
                );
                return;
              }

              await triggeredArgs.actionService.run('moveCard', {
                cardId: discardedCardId,
                toPlayerId: player.id,
                to: { location: 'set-aside' },
                setAsideSource: {
                  ownerPlayerId: player.id,
                  sourceCardLikeId: tirelessTrait.id,
                  sourceCardKey: tirelessTrait.cardKey,
                },
              });
            },
          },
          {
            idSuffix: `tireless:${tirelessTrait.id}:${player.id}:discard`,
          },
        );

        args.reactionManager.registerSystemTemplate(
          tirelessTrait,
          'endTurn',
          {
            playerId: player.id,
            once: false,
            compulsory: true,
            allowMultipleInstances: false,
            condition: ({ trigger }) => trigger.args.playerId === player.id,
            triggeredEffectFn: async triggeredArgs => {
              const setAside = getPlayerSourceSafe(triggeredArgs, 'set-aside', player.id);
              const candidateTirelessCardIds = setAside.filter(cardId => {
                const setAsideSource = triggeredArgs.match.setAsideSourceById?.[cardId];
                return (
                  setAsideSource?.ownerPlayerId === player.id && setAsideSource.sourceCardLikeId === tirelessTrait.id
                );
              });
              if (candidateTirelessCardIds.length < 1) {
                return;
              }

              const stillSetAsideCardIds = candidateTirelessCardIds.filter(cardId => setAside.includes(cardId));
              if (stillSetAsideCardIds.length < 1) {
                return;
              }

              const orderedTopdeckIds = await getOrderedCardIds(
                {
                  promptService: triggeredArgs.promptService,
                  playerId: player.id,
                },
                stillSetAsideCardIds,
                'Order Tireless cards to put onto your deck (first will be on top)',
              );

              for (const cardId of [...orderedTopdeckIds].reverse()) {
                const currentSetAside = getPlayerSourceSafe(triggeredArgs, 'set-aside', player.id);
                if (!currentSetAside.includes(cardId)) {
                  continue;
                }
                await triggeredArgs.actionService.run('moveCard', {
                  cardId,
                  toPlayerId: player.id,
                  to: { location: 'playerDeck' },
                });
              }
            },
          },
          {
            idSuffix: `tireless:${tirelessTrait.id}:${player.id}:endTurn`,
          },
        );
      }
    }
  });
};

// Registers Shaman's global setup rule: each player's start turn gains from trash up to $6.
const registerShamanEvents = (registrar: GameEventRegistrar, config: ComputedMatchConfiguration) => {
  const hasShamanPile = config.kingdomSupply.some(supply =>
    supply.cards.some(card => getCardPileKey(card) === SHAMAN_CARD_KEY),
  );
  if (!hasShamanPile) {
    return;
  }

  registrar('onGameStartSetup', async args => {
    const shamanCardInMatch = args.findCardService
      .findCards({ all: [{ location: 'kingdomSupply' }] })
      .find(card => card.cardKey === SHAMAN_CARD_KEY);
    if (!shamanCardInMatch) {
      return;
    }

    for (const player of args.match.players) {
      args.reactionManager.registerSystemTemplate(
        shamanCardInMatch,
        'startTurn',
        {
          playerId: player.id,
          once: false,
          compulsory: true,
          allowMultipleInstances: false,
          condition: ({ trigger }) => trigger.args.playerId === player.id,
          triggeredEffectFn: async triggeredArgs => {
            const gainableFromTrash = triggeredArgs.findCardService
              .findCards({ all: [{ location: 'trash' }] })
              .filter(card => {
                const cost = triggeredArgs.cardPriceController.applyRules(card, { playerId: player.id }).cost;
                return (cost.treasure ?? 0) <= 6 && !cost.debt && !cost.potion;
              });

            if (!gainableFromTrash.length) {
              return;
            }

            const selectedCardId = await triggeredArgs.actionService.run('selectSingleCard', {
              playerId: player.id,
              prompt: 'Gain a card from the trash costing up to $6 (Shaman)',
              restrict: gainableFromTrash.map(card => card.id),
              count: 1,
            });
            if (!selectedCardId) {
              return;
            }

            await triggeredArgs.actionService.run('gainCard', {
              playerId: player.id,
              cardId: selectedCardId,
              to: { location: 'playerDiscard' },
            });
          },
        },
        {
          idSuffix: `shaman:startTurn:${player.id}`,
        },
      );
    }
  });
};

const configurator: ExpansionConfiguratorFactory = () => {
  return async args => {
    const hasLootPile = args.config.nonSupply?.some(supply => supply.name === LOOT_PILE_NAME) ?? false;
    const shouldUseLoot = shouldConfigureLootPile(args.config);

    if (!shouldUseLoot) {
      if (hasLootPile) {
        args.loggerService.info('[plunder configurator] removing Loot pile (no selected Loot source remains)');
        args.config.nonSupply = args.config.nonSupply?.filter(supply => supply.name !== LOOT_PILE_NAME);
      }
      return args.config;
    }

    if (hasLootPile) {
      args.loggerService.debug('[plunder configurator] Loot pile already configured');
      return args.config;
    }

    args.config.nonSupply ??= [];
    const shuffledLootCards = buildShuffledLootCards(args);
    if (shuffledLootCards.length < 1) {
      args.loggerService.warn('[plunder configurator] no Loot cards available; skipping Loot pile configuration');
      return args.config;
    }

    args.config.nonSupply.push({
      name: LOOT_PILE_NAME,
      cards: shuffledLootCards,
    });
    args.loggerService.info(`[plunder configurator] configured Loot pile with ${shuffledLootCards.length} cards`);

    return args.config;
  };
};

// Registers game-start hooks for Plunder traits that need global runtime behavior.
export const registerGameEvents: (registrar: GameEventRegistrar, config: ComputedMatchConfiguration) => void = (
  registrar,
  config,
) => {
  registerCheapTraitEvents(registrar, config);
  registerCursedTraitEvents(registrar, config);
  registerFatedTraitEvents(registrar, config);
  registerFawningTraitEvents(registrar, config);
  registerFriendlyTraitEvents(registrar, config);
  registerHastyTraitEvents(registrar, config);
  registerInheritedTraitEvents(registrar, config);
  registerInspiringTraitEvents(registrar, config);
  registerNearbyTraitEvents(registrar, config);
  registerPatientTraitEvents(registrar, config);
  registerPiousTraitEvents(registrar, config);
  registerRecklessTraitEvents(registrar, config);
  registerRichTraitEvents(registrar, config);
  registerShyTraitEvents(registrar, config);
  registerShamanEvents(registrar, config);
  registerTirelessTraitEvents(registrar, config);
};

export default configurator;
