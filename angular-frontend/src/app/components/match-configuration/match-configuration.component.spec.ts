import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MatchConfigurationComponent } from './match-configuration.component';

describe('MatchConfigurationComponent', () => {
  let component: MatchConfigurationComponent;
  let fixture: ComponentFixture<MatchConfigurationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MatchConfigurationComponent],
      // App uses provideZonelessChangeDetection; TestBed must match.
      providers: [provideZonelessChangeDetection()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(MatchConfigurationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
