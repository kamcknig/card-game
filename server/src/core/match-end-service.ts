import { ActionService, AppSocket, FindCardService } from '@server-types/index.ts';
import { Match, MatchSummary, PlayerId, ServerListenEvents } from 'shared/types/index.ts';
import { CardSourceController } from './card-source-controller.ts';
import { CardInteractivityController } from './card-interactivity-controller.ts';
import { LoggerService } from './logger-service.ts';
import { ReactionManager } from './reactions/reaction-manager.ts';

export interface EndMatchArgs {
  reactionManager?: ReactionManager;
  interactivityController?: CardInteractivityController;
  registeredEvents: (keyof ServerListenEvents)[];
}

// Owns end-of-match teardown and summary generation so MatchController can stay orchestration-focused.
export class MatchEndService {
  constructor(
    private readonly socketMap: Map<PlayerId, AppSocket>,
    private readonly match: Match,
    private readonly cardSourceController: CardSourceController,
    private readonly findCardService: FindCardService,
    private readonly actionService: ActionService,
    private readonly loggerService: LoggerService,
  ) {}

  // Tears down runtime listeners/state and broadcasts final match summary.
  public async endMatch({
    reactionManager,
    interactivityController,
    registeredEvents,
  }: EndMatchArgs): Promise<MatchSummary> {
    reactionManager?.endGame();
    interactivityController?.endGame();

    this.loggerService.debug(`[match] removing socket listeners for 'nextPhase'`);
    this.socketMap.forEach((s) => s.off('nextPhase'));

    // Restore all set-aside cards to owners' decks before final scoring/deck snapshot.
    for (const player of this.match.players) {
      const setAsideCardIds = this.cardSourceController.getSource('set-aside', player.id);
      // Iterate over a snapshot since move actions mutate the source array.
      for (const cardId of [...setAsideCardIds]) {
        await this.actionService.run('moveCard', {
          toPlayerId: player.id,
          cardId,
          to: { location: 'playerDeck' },
        });
      }
    }

    for (const event of registeredEvents) {
      this.socketMap.forEach((s) => s.off(event));
    }

    const summary = this.buildMatchSummary();

    this.loggerService.info(`[match] match summary created`);
    this.loggerService.debug(summary);

    this.socketMap.forEach((s) => s.emit('gameOver', summary));
    return summary;
  }

  // Builds final player ordering using score, then turns, then original seat order.
  private buildMatchSummary(): MatchSummary {
    return {
      playerSummary: this.match.players.reduce((prev, player) => {
        const playerId = player.id;
        // Tiebreaker turns are counted from recorded turn history.
        // Seize the Day turns are excluded from this count per event FAQ.
        const turnsTaken = this.match.stats.turns.filter((turnStats) => {
          if (turnStats.playerId !== playerId) {
            return false;
          }

          const sourceId = turnStats.sourceId;
          if (sourceId === undefined) {
            return true;
          }

          const sourceEvent = this.match.events.find((event) => event.id === sourceId);
          if (!sourceEvent) {
            return true;
          }

          return sourceEvent.cardKey !== 'seize-the-day';
        }).length;

        prev.push({
          playerId,
          turnsTaken,
          score: this.match.scores[playerId],
          deck: this.findCardService.findCards({ all: [{ owner: playerId }] }).map((card) => card.id),
        });
        return prev;
      }, [] as MatchSummary['playerSummary'])
        .sort((a, b) => {
          if (a.score < b.score) return 1;
          if (b.score < a.score) return -1;
          if (a.turnsTaken < b.turnsTaken) return -1;
          if (b.turnsTaken < a.turnsTaken) return 1;
          const aIdx = this.match.players.findIndex((player) => player.id === a.playerId);
          const bIdx = this.match.players.findIndex((player) => player.id === b.playerId);
          if (aIdx < bIdx) return -1;
          if (bIdx < aIdx) return 1;
          return 0;
        }),
    };
  }
}
