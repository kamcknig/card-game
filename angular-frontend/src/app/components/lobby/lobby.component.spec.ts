import { provideExperimentalZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NanostoresService } from '@nanostores/angular';
import { of } from 'rxjs';

import { SocketService } from '../../core/socket-service/socket.service';
import { LobbyComponent } from './lobby.component';

/**
 * Stub NanostoresService that skips the real subscription path and returns
 * static observables per store. Used by LobbyComponent (game stores) and
 * SceneBannerComponent (auth username store).
 */
class NanostoresServiceStub {
  useStore = jest.fn().mockImplementation(() => of(undefined));
  ngOnDestroy = () => {};
}

/**
 * Stub SocketService — LobbyComponent calls `emit` on init and on game
 * actions. Tracking the calls is sufficient for assertions.
 */
class SocketServiceStub {
  emit = jest.fn();
  disconnect = jest.fn();
}

describe('LobbyComponent', () => {
  let component: LobbyComponent;
  let fixture: ComponentFixture<LobbyComponent>;
  let socketStub: SocketServiceStub;

  beforeEach(async () => {
    socketStub = new SocketServiceStub();

    await TestBed.configureTestingModule({
      imports: [LobbyComponent],
      providers: [
        // App uses provideExperimentalZonelessChangeDetection; TestBed must match.
        provideExperimentalZonelessChangeDetection(),
        { provide: NanostoresService, useClass: NanostoresServiceStub },
        { provide: SocketService, useValue: socketStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LobbyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('ngOnInit requests a lobby snapshot', () => {
    // LobbyComponent calls emit('requestLobbySnapshot') at init — the
    // beforeEach detectChanges() already triggered it.
    expect(socketStub.emit).toHaveBeenCalledWith('requestLobbySnapshot');
  });
});
