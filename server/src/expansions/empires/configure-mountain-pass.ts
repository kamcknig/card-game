import { ComputedMatchConfiguration, PlayerId } from 'shared/shared-types.ts';
import { GameEventRegistrar } from '../../types.ts';
import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';

export const configureMountainPass = (
  registrar: GameEventRegistrar,
  config: ComputedMatchConfiguration,
) => {
  // Only register Mountain Pass handlers when the landmark is present.
  const hasMountainPass = (config.landmarks ?? []).some(
    (landmark) => landmark.cardKey === 'mountain-pass',
  );
  if (!hasMountainPass) return;

  console.info(
    `[empires configurator] setting up mountain pass landmark handlers`,
  );

  registrar('onCardGained', async (args, eventArgs) => {
    // Mountain Pass only triggers on Province gains.
    const gainedCard = args.cardLibrary.getCard(eventArgs.cardId);
    if (gainedCard.cardKey !== 'province') return;

    // Count total Province gains so far; only the first gain triggers bidding.
    let provinceGainCount = 0;
    for (const cardIdKey of Object.keys(args.match.stats.cardsGained ?? {})) {
      const cardId = Number(cardIdKey);
      if (!Number.isFinite(cardId)) {
        console.warn(
          `[mountain pass onCardGained] invalid card id ${cardIdKey} in gain stats`,
        );
        continue;
      }

      const gained = args.cardLibrary.getCard(cardId);
      if (gained.cardKey !== 'province') continue;

      provinceGainCount++;
      if (provinceGainCount > 1) break;
    }

    if (provinceGainCount !== 1) {
      console.debug(
        `[mountain pass onCardGained] province gain count ${provinceGainCount}, skipping`,
      );
      return;
    }

    console.info(
      `[mountain pass onCardGained] first Province gained by player ${eventArgs.playerId}, starting bidding`,
    );

    // Determine the bidding order (left of the gainer, ending with the gainer).
    // Use the shared ordered-target helper for turn-order iteration.
    const bidOrder = findOrderedTargets({
      match: args.match,
      startingPlayerId: eventArgs.playerId,
      appliesTo: 'ALL_OTHER',
    });
    // Ensure the gainer bids last per Mountain Pass rules.
    bidOrder.push(eventArgs.playerId);

    // Track the current high bid and bidder.
    const maxBid = 40;
    let highBid = 0;
    let highBidder: PlayerId | null = null;

    for (const bidderId of bidOrder) {
      if (highBid >= maxBid) {
        console.debug(
          `[mountain pass bidding] max bid ${highBid} reached, skipping remaining bidders`,
        );
        break;
      }

      const minBid = highBid + 1;
      const actionButtons = [{ label: 'PASS', action: 0 }];

      // Build bid choices from the minimum allowed bid up to the max bid.
      for (let bid = minBid; bid <= maxBid; bid++) {
        actionButtons.push({ label: `BID ${bid}D`, action: bid });
      }

      console.debug(
        `[mountain pass bidding] prompting player ${bidderId} with min bid ${minBid}D`,
      );

      const promptResult = await args.runGameActionDelegate('userPrompt', {
        playerId: bidderId,
        prompt: `Mountain Pass bid? Current high bid: ${highBid}D`,
        actionButtons,
      }) as { action?: number } | null;

      const bidValue = promptResult?.action ?? 0;
      if (typeof bidValue !== 'number' || bidValue < minBid) {
        console.info(
          `[mountain pass bidding] player ${bidderId} passes`,
        );
        continue;
      }

      if (bidValue > maxBid) {
        console.warn(
          `[mountain pass bidding] player ${bidderId} bid ${bidValue} exceeds max ${maxBid}, treating as pass`,
        );
        continue;
      }

      highBid = bidValue;
      highBidder = bidderId;
      console.info(
        `[mountain pass bidding] player ${bidderId} bids ${bidValue}D`,
      );
    }

    if (!highBidder || highBid <= 0) {
      console.info(`[mountain pass onCardGained] no bids made`);
      return;
    }

    console.info(
      `[mountain pass onCardGained] player ${highBidder} wins with ${highBid}D, awarding 8 VP and ${highBid} debt`,
    );

    // Award the Mountain Pass prize to the winning bidder.
    await args.runGameActionDelegate('gainVictoryToken', {
      playerId: highBidder,
      count: 8,
    });
    await args.runGameActionDelegate('gainDebt', {
      playerId: highBidder,
      count: highBid,
    });
  });
};
