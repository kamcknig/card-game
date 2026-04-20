import { provideExperimentalZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatchSummary } from 'shared/types';

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

    fixture = TestBed.createComponent(GameSummaryComponent);
    component = fixture.componentInstance;
    // Provide the required matchSummary input before triggering change detection.
    const minimalSummary: MatchSummary = { playerSummary: [] };
    fixture.componentRef.setInput('matchSummary', minimalSummary);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
