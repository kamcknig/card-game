import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MatchHudComponent } from './match-hud.component';

describe('MatchHudComponent', () => {
  let component: MatchHudComponent;
  let fixture: ComponentFixture<MatchHudComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MatchHudComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MatchHudComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
