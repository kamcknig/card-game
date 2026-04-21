import { provideExperimentalZonelessChangeDetection } from '@angular/core';
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
      // App uses provideExperimentalZonelessChangeDetection; TestBed must match.
      providers: [provideExperimentalZonelessChangeDetection()],
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
});
