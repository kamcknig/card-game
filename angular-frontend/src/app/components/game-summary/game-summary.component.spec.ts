import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatchSummary } from 'shared/types';

import { matchSummaryStore } from '../../state/match-state';
import { GameSummaryComponent } from './game-summary.component';

describe('GameSummaryComponent', () => {
  let component: GameSummaryComponent;
  let fixture: ComponentFixture<GameSummaryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameSummaryComponent],
      // App uses provideZonelessChangeDetection; TestBed must match.
      providers: [provideZonelessChangeDetection()],
    })
    .compileComponents();

    // Populate the store before instantiation — the component reads
    // matchSummaryStore via a computed signal rather than an Input.
    const minimalSummary: MatchSummary = { playerSummary: [] };
    matchSummaryStore.set(minimalSummary);

    fixture = TestBed.createComponent(GameSummaryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('winnerFlags', () => {
    /** Builds a minimal MatchSummary with the given (playerId, score, turnsTaken) rows, already server-sorted. */
    function summaryWith(rows: { playerId: number; score: number; turnsTaken: number }[]): MatchSummary {
      return {
        playerSummary: rows.map((row) => ({
          playerId: row.playerId,
          score: row.score,
          turnsTaken: row.turnsTaken,
          deck: [],
        })),
      };
    }

    // matchSummary() reads matchSummaryStore.get() directly (not via a
    // reactive nanostore signal), so it only reflects the store's value at
    // component construction time — matching production, where a fresh
    // component instance is created per route activation. Each case here
    // therefore sets the store before creating its own component instance
    // rather than mutating the store under the shared beforeEach instance.
    function createComponentWithSummary(summary: MatchSummary): GameSummaryComponent {
      matchSummaryStore.set(summary);
      const localFixture = TestBed.createComponent(GameSummaryComponent);
      localFixture.detectChanges();
      return localFixture.componentInstance;
    }

    it('flags the sole row as winner for a single player', () => {
      const localComponent = createComponentWithSummary(
        summaryWith([{ playerId: 1, score: 10, turnsTaken: 12 }]));

      expect(localComponent.winnerFlags()).toEqual([true]);
    });

    it('flags only the higher-score row when there is a clear winner', () => {
      const localComponent = createComponentWithSummary(summaryWith([
        { playerId: 1, score: 15, turnsTaken: 12 },
        { playerId: 2, score: 10, turnsTaken: 12 },
      ]));

      expect(localComponent.winnerFlags()).toEqual([true, false]);
    });

    it('flags both rows when tied on score and turns', () => {
      const localComponent = createComponentWithSummary(summaryWith([
        { playerId: 1, score: 10, turnsTaken: 12 },
        { playerId: 2, score: 10, turnsTaken: 12 },
      ]));

      expect(localComponent.winnerFlags()).toEqual([true, true]);
    });

    it('does not flag a row tied on score but with more turns taken', () => {
      const localComponent = createComponentWithSummary(summaryWith([
        { playerId: 1, score: 10, turnsTaken: 12 },
        { playerId: 2, score: 10, turnsTaken: 13 },
      ]));

      expect(localComponent.winnerFlags()).toEqual([true, false]);
    });
  });
});
