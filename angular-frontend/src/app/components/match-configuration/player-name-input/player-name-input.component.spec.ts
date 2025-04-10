import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlayerNameInputComponent } from './player-name-input.component';

describe('PlayerNameInputComponent', () => {
  let component: PlayerNameInputComponent;
  let fixture: ComponentFixture<PlayerNameInputComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlayerNameInputComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlayerNameInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
